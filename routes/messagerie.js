/**
 * messagerie.js - Routes API pour le système de messagerie/chat en temps réel
 * 
 * Chat admin avec conversations, SSE pour temps réel, et historique des messages.
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const { readJsonDecrypted, writeJsonEncrypted } = require('../middleware/encryption');

const DB_PATH = path.join(__dirname, '../db/messagerie.json');

// CORS is handled by the global cors() middleware in server.js.

// Helpers
function readArrayFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      writeJsonEncrypted(filePath, []);
      return [];
    }

    const data = readJsonDecrypted(filePath);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeArrayFile(filePath, data) {
  writeJsonEncrypted(filePath, Array.isArray(data) ? data : []);
}

function readUsers() {
  const usersPath = path.join(__dirname, '../db/users.json');
  const data = readJsonDecrypted(usersPath);
  return Array.isArray(data) ? data : [];
}

function readDB() {
  return readArrayFile(DB_PATH);
}

function writeDB(data) {
  writeArrayFile(DB_PATH, data);
}

// SSE clients storage
const sseClients = new Map(); // clientId -> { res, visitorId?, adminId? }

// Typing indicators storage
const typingStatus = new Map(); // `${conversationKey}` -> { isTyping, from, timestamp }

// Helper: send SSE to specific clients
function broadcastToConversation(visitorId, adminId, event, data) {
  sseClients.forEach((client) => {
    const isVisitor = client.visitorId === visitorId;
    const isAdmin = client.adminId === adminId;
    if (isVisitor || isAdmin) {
      try {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch (e) {
        // client disconnected
      }
    }
  });
}

// Broadcast to all admin clients
function broadcastToAdmins(event, data) {
  sseClients.forEach((client) => {
    if (client.adminId) {
      try {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch (e) {}
    }
  });
}

// =====================
// SSE Endpoint
// =====================
// OPTIONS preflight handled by global cors() middleware

router.get('/events', (req, res) => {
  // Explicit CORS headers for SSE (belt-and-suspenders)
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  req.socket?.setKeepAlive?.(true, 15000);
  req.socket?.setNoDelay?.(true);

  const clientId = `livechat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const visitorId = req.query.visitorId || null;
  const adminId = req.query.adminId || null;

  sseClients.set(clientId, { res, visitorId, adminId });

  // Heartbeat
  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 15000);

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(clientId);
    
    // If admin disconnects, broadcast offline
    if (adminId) {
      broadcastAdminStatus();
    }
  });
});

// =====================
// Check if admin is online
// =====================
function isAdminOnline() {
  for (const [, client] of sseClients) {
    if (client.adminId) return true;
  }
  return false;
}

function broadcastAdminStatus() {
  const online = isAdminOnline();
  sseClients.forEach((client) => {
    if (client.visitorId) {
      try {
        client.res.write(`event: admin_status\ndata: ${JSON.stringify({ online })}\n\n`);
      } catch (e) {}
    }
  });
}

router.get('/admin-status', (req, res) => {
  try {
    const users = readUsers();
    
    // Priority 1: admin principale online
    const adminPrincipaux = users.filter(u => u.role === 'administrateur principale');
    for (const ap of adminPrincipaux) {
      for (const [, client] of sseClients) {
        if (client.adminId === ap.id) {
          return res.json({ online: true, adminId: ap.id });
        }
      }
    }
    
    // Priority 2: admin with specification "live"
    const adminsLive = users.filter(u => u.role === 'administrateur' && u.specification === 'live');
    for (const al of adminsLive) {
      for (const [, client] of sseClients) {
        if (client.adminId === al.id) {
          return res.json({ online: true, adminId: al.id });
        }
      }
    }
    
    res.json({ online: false, adminId: null });
  } catch {
    res.json({ online: false, adminId: null });
  }
});

// =====================
// Get all admin users with online status
// =====================
router.get('/admin-users', authMiddleware, (req, res) => {
  try {
    const users = readUsers();
    const admins = users.filter(u => u.role === 'administrateur' || u.role === 'administrateur principale');
    
    const adminList = admins.map(a => {
      let online = false;
      for (const [, client] of sseClients) {
        if (client.adminId === a.id) { online = true; break; }
      }
      return {
        id: a.id, firstName: a.firstName, lastName: a.lastName,
        role: a.role, specification: a.specification || null,
        profilePhoto: a.profilePhoto || null, online
      };
    });
    
    res.json(adminList);
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// =====================
// Admin-to-Admin messaging
// =====================
const ADMIN_MSG_PATH = path.join(__dirname, '../db/admin-messages.json');

function readAdminDB() {
  return readArrayFile(ADMIN_MSG_PATH);
}
function writeAdminDB(data) {
  writeArrayFile(ADMIN_MSG_PATH, data);
}

router.get('/admin-conversations', authMiddleware, (req, res) => {
  try {
    const messages = readAdminDB();
    const myId = req.user.id;
    const convMap = {};
    messages.filter(m => (m.senderId === myId || m.receiverId === myId) && (!m.hiddenFor || !m.hiddenFor.includes(myId))).forEach(m => {
      const otherId = m.senderId === myId ? m.receiverId : m.senderId;
      if (!convMap[otherId]) {
        convMap[otherId] = { adminId: otherId, adminName: m.senderId === myId ? m.receiverName : m.senderName, lastMessage: null, unreadCount: 0 };
      }
      convMap[otherId].lastMessage = m;
      if (!m.lu && m.receiverId === myId) convMap[otherId].unreadCount++;
    });
    const conversations = Object.values(convMap).sort((a, b) => new Date(b.lastMessage.date) - new Date(a.lastMessage.date));
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/admin-messages/:otherAdminId', authMiddleware, (req, res) => {
  try {
    const messages = readAdminDB();
    const myId = req.user.id;
    const otherId = req.params.otherAdminId;
    const convMessages = messages.filter(
      m => (m.senderId === myId && m.receiverId === otherId) || (m.senderId === otherId && m.receiverId === myId)
    ).filter(m => !m.hiddenFor || !m.hiddenFor.includes(myId))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(convMessages);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.post('/admin-send', authMiddleware, (req, res) => {
  try {
    const { receiverId, receiverName, contenu } = req.body;
    if (!receiverId || !contenu) return res.status(400).json({ message: 'Champs obligatoires manquants' });

    const messages = readAdminDB();
    const newMessage = {
      id: `amsg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: req.user.id,
      senderName: `${req.user.firstName} ${req.user.lastName}`,
      receiverId, receiverName: receiverName || 'Admin',
      contenu, date: new Date().toISOString(), lu: false
    };
    messages.push(newMessage);
    writeAdminDB(messages);

    // Broadcast via SSE to both admins
    sseClients.forEach((client) => {
      if (client.adminId === receiverId || client.adminId === req.user.id) {
        try { client.res.write(`event: admin_message\ndata: ${JSON.stringify(newMessage)}\n\n`); } catch (e) {}
      }
    });

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.put('/admin-mark-read/:otherAdminId', authMiddleware, (req, res) => {
  try {
    const messages = readAdminDB();
    const myId = req.user.id;
    const otherId = req.params.otherAdminId;
    let updated = false;
    messages.forEach(m => {
      if (m.senderId === otherId && m.receiverId === myId && !m.lu) { m.lu = true; updated = true; }
    });
    if (updated) writeAdminDB(messages);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/admin-unread-count', authMiddleware, (req, res) => {
  try {
    const messages = readAdminDB();
    const count = messages.filter(m => m.receiverId === req.user.id && !m.lu).length;
    res.json({ count });
  } catch { res.json({ count: 0 }); }
});

// =====================
// Get conversations for admin
// =====================
router.get('/conversations', authMiddleware, (req, res) => {
  try {
    const messages = readDB();
    const adminId = req.user.id;
    
    // Group by visitorId
    const convMap = {};
    messages.filter(m => m.adminId === adminId).forEach(m => {
      if (!convMap[m.visitorId]) {
        convMap[m.visitorId] = {
          visitorId: m.visitorId,
          visitorNom: m.visitorNom,
          messages: [],
          lastMessage: null,
          unreadCount: 0
        };
      }
      convMap[m.visitorId].messages.push(m);
      if (!m.lu && m.from === 'visitor') {
        convMap[m.visitorId].unreadCount++;
      }
    });
    
    // Set last message and sort
    const conversations = Object.values(convMap).map(conv => {
      conv.lastMessage = conv.messages[conv.messages.length - 1];
      return conv;
    }).sort((a, b) => new Date(b.lastMessage.date) - new Date(a.lastMessage.date));
    
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// =====================
// Get messages for a conversation (visitor side - no auth needed)
// =====================
router.get('/messages/:visitorId/:adminId', (req, res) => {
  try {
    const messages = readDB();
    const { visitorId, adminId } = req.params;
    const convMessages = messages.filter(
      m => m.visitorId === visitorId && m.adminId === adminId
    ).sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(convMessages);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// =====================
// Send message (visitor or admin)
// =====================
router.post('/send', (req, res) => {
  try {
    const { visitorId, visitorNom, adminId, contenu, from } = req.body;
    
    if (!visitorId || !adminId || !contenu || !from) {
      return res.status(400).json({ message: 'Champs obligatoires manquants' });
    }

    const messages = readDB();
    const newMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      visitorId,
      visitorNom: visitorNom || 'Visiteur',
      adminId,
      contenu,
      from, // 'visitor' or 'admin'
      date: new Date().toISOString(),
      lu: false
    };
    
    messages.push(newMessage);
    writeDB(messages);

    // Broadcast via SSE
    broadcastToConversation(visitorId, adminId, 'new_message', newMessage);
    
    // If from visitor, also notify admin of new conversation
    if (from === 'visitor') {
      broadcastToAdmins('new_conversation_message', newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// =====================
// Typing indicator
// =====================
router.post('/typing', (req, res) => {
  const { visitorId, adminId, from, isTyping } = req.body;
  broadcastToConversation(visitorId, adminId, 'typing', { visitorId, adminId, from, isTyping });
  res.json({ ok: true });
});

// =====================
// Admin-to-Admin Typing indicator
// =====================
router.post('/admin-typing', (req, res) => {
  const { senderId, receiverId, isTyping } = req.body;
  if (!senderId || !receiverId) return res.status(400).json({ message: 'Champs obligatoires manquants' });
  
  sseClients.forEach((client) => {
    if (client.adminId === receiverId || client.adminId === senderId) {
      try {
        client.res.write(`event: admin_typing\ndata: ${JSON.stringify({ senderId, receiverId, isTyping })}\n\n`);
      } catch (e) {}
    }
  });
  res.json({ ok: true });
});

// =====================
// =====================
router.put('/mark-read/:visitorId/:adminId', (req, res) => {
  try {
    const { visitorId, adminId } = req.params;
    const { reader } = req.body; // 'visitor' or 'admin'
    const messages = readDB();
    
    let updated = false;
    messages.forEach(m => {
      if (m.visitorId === visitorId && m.adminId === adminId && !m.lu) {
        // Mark as read only messages from the OTHER person
        if ((reader === 'admin' && m.from === 'visitor') || (reader === 'visitor' && m.from === 'admin')) {
          m.lu = true;
          updated = true;
        }
      }
    });
    
    if (updated) writeDB(messages);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// =====================
// Get total unread count for admin
// =====================
router.get('/unread-count/:adminId', (req, res) => {
  try {
    const messages = readDB();
    const count = messages.filter(
      m => m.adminId === req.params.adminId && m.from === 'visitor' && !m.lu
    ).length;
    res.json({ count });
  } catch {
    res.json({ count: 0 });
  }
});

// =====================
// Edit a message (only own messages)
// =====================
router.put('/edit/:messageId', (req, res) => {
  try {
    const { messageId } = req.params;
    const { contenu, from, visitorId, adminId } = req.body;
    if (!contenu || !contenu.trim()) {
      return res.status(400).json({ message: 'Contenu requis' });
    }
    const messages = readDB();
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return res.status(404).json({ message: 'Message non trouvé' });
    
    // Verify ownership
    if (messages[idx].from !== from) {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    
    messages[idx].contenu = contenu.trim();
    messages[idx].edited = true;
    messages[idx].editedAt = new Date().toISOString();
    writeDB(messages);
    
    broadcastToConversation(messages[idx].visitorId, messages[idx].adminId, 'message_edited', messages[idx]);
    res.json(messages[idx]);
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// =====================
// Delete a message (only own messages)
// =====================
router.delete('/delete/:messageId', (req, res) => {
  try {
    const { messageId } = req.params;
    const { from } = req.body;
    const messages = readDB();
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return res.status(404).json({ message: 'Message non trouvé' });
    
    if (messages[idx].from !== from) {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    
    // Replace content with deletion notice
    messages[idx].contenu = '';
    messages[idx].deleted = true;
    messages[idx].deletedAt = new Date().toISOString();
    writeDB(messages);
    
    broadcastToConversation(messages[idx].visitorId, messages[idx].adminId, 'message_deleted', messages[idx]);
    res.json(messages[idx]);
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// =====================
// Admin-to-Admin: Delete own message (removes for both parties)
// =====================
router.delete('/admin-delete-own/:messageId', authMiddleware, (req, res) => {
  try {
    const { messageId } = req.params;
    const myId = req.user.id;
    const messages = readAdminDB();
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return res.status(404).json({ message: 'Message non trouvé' });
    if (messages[idx].senderId !== myId) return res.status(403).json({ message: 'Non autorisé: ce n\'est pas votre message' });

    const deletedMsg = messages[idx];
    const receiverId = deletedMsg.receiverId;
    messages.splice(idx, 1);
    writeAdminDB(messages);

    // Broadcast deletion to both sender and receiver
    sseClients.forEach((client) => {
      if (client.adminId === myId || client.adminId === receiverId) {
        try {
          client.res.write(`event: admin_message_deleted\ndata: ${JSON.stringify({ id: messageId, type: 'full' })}\n\n`);
        } catch (e) {}
      }
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting admin message:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// =====================
// Admin-to-Admin: Hide other's message (only for self)
// =====================
router.delete('/admin-hide/:messageId', authMiddleware, (req, res) => {
  try {
    const { messageId } = req.params;
    const myId = req.user.id;
    const messages = readAdminDB();
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return res.status(404).json({ message: 'Message non trouvé' });

    if (!messages[idx].hiddenFor) messages[idx].hiddenFor = [];
    if (!messages[idx].hiddenFor.includes(myId)) {
      messages[idx].hiddenFor.push(myId);
    }
    writeAdminDB(messages);

    // Broadcast only to the requester
    sseClients.forEach((client) => {
      if (client.adminId === myId) {
        try {
          client.res.write(`event: admin_message_hidden\ndata: ${JSON.stringify({ id: messageId, hiddenFor: myId })}\n\n`);
        } catch (e) {}
      }
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Error hiding admin message:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// (WebRTC Call Signaling removed)

// =====================
// Like/unlike a message
// =====================
router.post('/like/:messageId', (req, res) => {
  try {
    const { messageId } = req.params;
    const { from } = req.body; // who is liking
    const messages = readDB();
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return res.status(404).json({ message: 'Message non trouvé' });
    
    if (!messages[idx].likes) messages[idx].likes = [];
    
    const likeIdx = messages[idx].likes.indexOf(from);
    if (likeIdx === -1) {
      messages[idx].likes.push(from);
    } else {
      messages[idx].likes.splice(likeIdx, 1);
    }
    
    writeDB(messages);
    broadcastToConversation(messages[idx].visitorId, messages[idx].adminId, 'message_liked', messages[idx]);
  res.json(messages[idx]);
  } catch (error) {
    console.error('Error liking message:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// =====================
// GROUP CHAT
// =====================
const GROUP_DB_PATH = path.join(__dirname, '../db/group-chats.json');
const GROUP_MSG_DB_PATH = path.join(__dirname, '../db/group-messages.json');

function readGroupDB() {
  return readArrayFile(GROUP_DB_PATH);
}
function writeGroupDB(data) { writeArrayFile(GROUP_DB_PATH, data); }

function readGroupMsgDB() {
  return readArrayFile(GROUP_MSG_DB_PATH);
}
function writeGroupMsgDB(data) { writeArrayFile(GROUP_MSG_DB_PATH, data); }

// Helper: broadcast SSE to a group member (checks both adminId AND visitorId)
function broadcastToGroupMember(memberId, event, data) {
  sseClients.forEach((client) => {
    if (client.adminId === memberId || client.visitorId === memberId) {
      try { client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
    }
  });
}

// Helper: resolve member name from users.json or messagerie.json (visitors)
function resolveMemberName(id) {
  const users = readUsers();
  const u = users.find(u => u.id === id);
  if (u) return { id, name: `${u.firstName} ${u.lastName}`, role: u.role || '', isVisitor: false };

  // Check visitor conversations in messagerie.json
  const messages = readDB();
  const visitorMsg = messages.find(m => m.visitorId === id);
  if (visitorMsg) return { id, name: visitorMsg.visitorNom || 'Visiteur', role: 'visiteur', isVisitor: true };

  return { id, name: 'Inconnu', role: '', isVisitor: id.startsWith('visitor_') };
}

// Create a group (admin principale only)
router.post('/group/create', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'administrateur principale') {
      return res.status(403).json({ message: 'Seul l\'administrateur principal peut créer un groupe' });
    }
    const { name, memberIds } = req.body;
    if (!name || !memberIds || !Array.isArray(memberIds) || memberIds.length < 2) {
      return res.status(400).json({ message: 'Nom et au moins 2 autres membres requis' });
    }
    // Always include creator
    const allMembers = Array.from(new Set([req.user.id, ...memberIds]));
    if (allMembers.length < 3) {
      return res.status(400).json({ message: 'Un groupe doit contenir au moins 3 personnes' });
    }

    // Resolve member names (supports both admin users AND visitors)
    const membersInfo = allMembers.map(id => resolveMemberName(id));

    const groups = readGroupDB();
    const newGroup = {
      id: `grp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      createdBy: req.user.id,
      members: membersInfo,
      createdAt: new Date().toISOString()
    };
    groups.push(newGroup);
    writeGroupDB(groups);

    // Notify all members via SSE (admin + visitor)
    allMembers.forEach(memberId => broadcastToGroupMember(memberId, 'group_created', newGroup));

    res.status(201).json(newGroup);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Get groups for current user
router.get('/groups', authMiddleware, (req, res) => {
  try {
    const groups = readGroupDB();
    const myGroups = groups.filter(g => g.members.some(m => m.id === req.user.id));
    
    // Add last message and unread count
    const allMsgs = readGroupMsgDB();
    const result = myGroups.map(g => {
      const groupMsgs = allMsgs.filter(m => m.groupId === g.id);
      const lastMessage = groupMsgs.length > 0 ? groupMsgs[groupMsgs.length - 1] : null;
      const unreadCount = groupMsgs.filter(m => m.senderId !== req.user.id && (!m.readBy || !m.readBy.includes(req.user.id))).length;
      return { ...g, lastMessage, unreadCount };
    }).sort((a, b) => {
      const da = a.lastMessage ? new Date(a.lastMessage.date) : new Date(a.createdAt);
      const db = b.lastMessage ? new Date(b.lastMessage.date) : new Date(b.createdAt);
      return db - da;
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// =====================
// VISITOR GROUP ENDPOINTS (no auth required, visitor identified by visitorId)
// =====================

// Get groups for a visitor
router.get('/visitor-groups/:visitorId', (req, res) => {
  try {
    const { visitorId } = req.params;
    if (!visitorId) return res.status(400).json({ message: 'visitorId requis' });

    const groups = readGroupDB();
    const myGroups = groups.filter(g => g.members.some(m => m.id === visitorId));

    const allMsgs = readGroupMsgDB();
    const result = myGroups.map(g => {
      const groupMsgs = allMsgs.filter(m => m.groupId === g.id);
      const lastMessage = groupMsgs.length > 0 ? groupMsgs[groupMsgs.length - 1] : null;
      const unreadCount = groupMsgs.filter(m => m.senderId !== visitorId && (!m.readBy || !m.readBy.includes(visitorId))).length;
      return { ...g, lastMessage, unreadCount };
    }).sort((a, b) => {
      const da = a.lastMessage ? new Date(a.lastMessage.date) : new Date(a.createdAt);
      const db = b.lastMessage ? new Date(b.lastMessage.date) : new Date(b.createdAt);
      return db - da;
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Get group messages for a visitor
router.get('/visitor-group-messages/:groupId/:visitorId', (req, res) => {
  try {
    const { groupId, visitorId } = req.params;
    const groups = readGroupDB();
    const group = groups.find(g => g.id === groupId);
    if (!group || !group.members.some(m => m.id === visitorId)) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    const allMsgs = readGroupMsgDB();
    const msgs = allMsgs.filter(m => m.groupId === groupId).sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(msgs);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Send group message as visitor
router.post('/visitor-group-send', (req, res) => {
  try {
    const { groupId, visitorId, visitorNom, contenu } = req.body;
    if (!groupId || !visitorId || !contenu) return res.status(400).json({ message: 'Champs obligatoires manquants' });

    const groups = readGroupDB();
    const group = groups.find(g => g.id === groupId);
    if (!group || !group.members.some(m => m.id === visitorId)) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    const msgs = readGroupMsgDB();
    const newMsg = {
      id: `gmsg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      groupId,
      senderId: visitorId,
      senderName: visitorNom || 'Visiteur',
      contenu: contenu.trim(),
      date: new Date().toISOString(),
      readBy: [visitorId]
    };
    msgs.push(newMsg);
    writeGroupMsgDB(msgs);

    // Broadcast to all group members (admin + visitor)
    group.members.forEach(member => broadcastToGroupMember(member.id, 'group_message', newMsg));

    res.status(201).json(newMsg);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Mark group messages as read (visitor)
router.put('/visitor-group-mark-read/:groupId/:visitorId', (req, res) => {
  try {
    const { groupId, visitorId } = req.params;
    const msgs = readGroupMsgDB();
    let updated = false;
    msgs.forEach(m => {
      if (m.groupId === groupId && m.senderId !== visitorId) {
        if (!m.readBy) m.readBy = [];
        if (!m.readBy.includes(visitorId)) {
          m.readBy.push(visitorId);
          updated = true;
        }
      }
    });
    if (updated) writeGroupMsgDB(msgs);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Visitor group typing indicator
router.post('/visitor-group-typing', (req, res) => {
  const { groupId, visitorId, visitorNom, isTyping } = req.body;
  if (!groupId || !visitorId) return res.status(400).json({ message: 'groupId et visitorId requis' });

  const groups = readGroupDB();
  const group = groups.find(g => g.id === groupId);
  if (!group) return res.json({ ok: true });

  group.members.forEach(member => {
    if (member.id !== visitorId) {
      broadcastToGroupMember(member.id, 'group_typing', {
        groupId, senderId: visitorId,
        senderName: visitorNom || 'Visiteur',
        isTyping
      });
    }
  });
  res.json({ ok: true });
});

// =====================
// EXISTING ADMIN GROUP ENDPOINTS (with auth)
// =====================

// Get group messages
router.get('/group-messages/:groupId', authMiddleware, (req, res) => {
  try {
    const groups = readGroupDB();
    const group = groups.find(g => g.id === req.params.groupId);
    if (!group || !group.members.some(m => m.id === req.user.id)) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    const allMsgs = readGroupMsgDB();
    const msgs = allMsgs.filter(m => m.groupId === req.params.groupId).sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(msgs);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Send group message
router.post('/group-send', authMiddleware, (req, res) => {
  try {
    const { groupId, contenu } = req.body;
    if (!groupId || !contenu) return res.status(400).json({ message: 'Champs obligatoires manquants' });

    const groups = readGroupDB();
    const group = groups.find(g => g.id === groupId);
    if (!group || !group.members.some(m => m.id === req.user.id)) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    const msgs = readGroupMsgDB();
    const newMsg = {
      id: `gmsg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      groupId,
      senderId: req.user.id,
      senderName: `${req.user.firstName} ${req.user.lastName}`,
      contenu: contenu.trim(),
      date: new Date().toISOString(),
      readBy: [req.user.id]
    };
    msgs.push(newMsg);
    writeGroupMsgDB(msgs);

    // Broadcast to all group members (admin + visitor)
    group.members.forEach(member => broadcastToGroupMember(member.id, 'group_message', newMsg));

    res.status(201).json(newMsg);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Mark group messages as read
router.put('/group-mark-read/:groupId', authMiddleware, (req, res) => {
  try {
    const msgs = readGroupMsgDB();
    let updated = false;
    msgs.forEach(m => {
      if (m.groupId === req.params.groupId && m.senderId !== req.user.id) {
        if (!m.readBy) m.readBy = [];
        if (!m.readBy.includes(req.user.id)) {
          m.readBy.push(req.user.id);
          updated = true;
        }
      }
    });
    if (updated) writeGroupMsgDB(msgs);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Rename group (admin principale only)
router.put('/group/rename/:groupId', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'administrateur principale') {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Nom requis' });
    
    const groups = readGroupDB();
    const idx = groups.findIndex(g => g.id === req.params.groupId);
    if (idx === -1) return res.status(404).json({ message: 'Groupe non trouvé' });
    
    groups[idx].name = name.trim();
    writeGroupDB(groups);
    
    // Notify all members (admin + visitor)
    groups[idx].members.forEach(member => broadcastToGroupMember(member.id, 'group_updated', groups[idx]));
    
    res.json(groups[idx]);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Group typing indicator
router.post('/group-typing', authMiddleware, (req, res) => {
  const { groupId, isTyping } = req.body;
  if (!groupId) return res.status(400).json({ message: 'groupId requis' });
  
  const groups = readGroupDB();
  const group = groups.find(g => g.id === groupId);
  if (!group) return res.json({ ok: true });
  
  group.members.forEach(member => {
    if (member.id !== req.user.id) {
      broadcastToGroupMember(member.id, 'group_typing', {
        groupId, senderId: req.user.id,
        senderName: `${req.user.firstName} ${req.user.lastName}`,
        isTyping
      });
    }
  });
  res.json({ ok: true });
});

module.exports = router;
