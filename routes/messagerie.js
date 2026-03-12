const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const DB_PATH = path.join(__dirname, '../db/messagerie.json');

// Helpers
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, '[]');
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
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
router.options('/events', (req, res) => {
  res.sendStatus(204);
});

router.get('/events', (req, res) => {
  // Laisser le middleware CORS global gérer les headers CORS
  // et définir ici uniquement les headers SSE.
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
  // Check if any admin user is connected (has role administrateur in users.json)
  const usersPath = path.join(__dirname, '../db/users.json');
  try {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    const admins = users.filter(u => u.role === 'administrateur');
    const adminIds = admins.map(a => a.id);
    
    let online = false;
    for (const [, client] of sseClients) {
      if (client.adminId && adminIds.includes(client.adminId)) {
        online = true;
        break;
      }
    }
    res.json({ online });
  } catch {
    res.json({ online: false });
  }
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
// Mark messages as read
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

module.exports = router;
