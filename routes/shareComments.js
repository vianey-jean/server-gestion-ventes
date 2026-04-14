const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

const commentsPath = path.join(__dirname, '..', 'db', 'lienpartagecommente.json');
const commentSharePath = path.join(__dirname, '..', 'db', 'comment-share.json');
const shareTokensPath = path.join(__dirname, '..', 'db', 'shareTokens.json');
const snapshotDir = path.join(__dirname, '..', 'db', 'upload', 'lienPartage');

// Ensure directories exist
if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });

const readJSON = (filePath) => {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return []; }
};

const writeJSON = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

if (!fs.existsSync(commentsPath)) writeJSON(commentsPath, []);
if (!fs.existsSync(commentSharePath)) writeJSON(commentSharePath, []);

// Save a comment entry to comment-share.json (JSON backup)
const saveToCommentShare = (commentEntry) => {
  const allShared = readJSON(commentSharePath);
  const existingIdx = allShared.findIndex(c => c.id === commentEntry.id);
  if (existingIdx >= 0) {
    allShared[existingIdx] = commentEntry;
  } else {
    allShared.push(commentEntry);
  }
  writeJSON(commentSharePath, allShared);
};

// Compare comment-share.json with existing HTML files and regenerate missing ones
const syncJsonToHtml = () => {
  const allShared = readJSON(commentSharePath);
  const sentComments = allShared.filter(c => c.status === 'sent');
  let regenerated = 0;

  sentComments.forEach(entry => {
    const expectedFilename = `comment_${entry.type}_${entry.id}.html`;
    const filepath = path.join(snapshotDir, expectedFilename);
    if (!fs.existsSync(filepath)) {
      generateSnapshot(entry);
      regenerated++;
    }
  });

  return { total: sentComments.length, regenerated };
};

// Run sync on startup
setTimeout(() => {
  try { syncJsonToHtml(); } catch (e) { /* silent */ }
}, 2000);

// Generate an HTML snapshot document for the comment
const generateSnapshot = (commentEntry) => {
  const { type, comments, generalComment, allItems, nom, prenom, sentAt, createdAt } = commentEntry;
  const date = sentAt || createdAt;
  
  const typeLabels = { pointage: 'Pointage', taches: 'Tâches', notes: 'Notes' };
  const typeLabel = typeLabels[type] || type;

  let itemsHtml = '';
  
  if (allItems && allItems.length > 0) {
    allItems.forEach((item, idx) => {
      const comment = comments.find(c => c.index === idx);
      const highlighted = comment ? 'border-left: 4px solid #3b82f6; background: #eff6ff;' : '';
      
      let itemContent = '';
      if (type === 'pointage') {
        itemContent = `
          <div style="padding: 12px; margin: 8px 0; border: 1px solid #e5e7eb; border-radius: 8px; ${highlighted}">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: bold; color: #0891b2;">📅 ${item.date || ''}</span>
              <span style="font-weight: bold; color: #059669;">${(item.montantTotal || 0).toFixed(2)}€</span>
            </div>
            <div style="font-weight: bold; font-size: 14px;">${item.entrepriseNom || ''}</div>
            <div style="color: #6b7280; font-size: 12px;">
              ${item.typePaiement === 'journalier' ? '📋 Journalier' : `⏱️ ${item.heures || 0}h`}
              ${item.travailleurNom ? ` • 👤 ${item.travailleurNom}` : ''}
            </div>
            ${comment ? `<div style="margin-top: 8px; padding: 8px; background: #dbeafe; border-radius: 6px; font-size: 12px;">
              <strong style="color: #2563eb;">💬 Commentaire:</strong> ${comment.text}
            </div>` : ''}
          </div>`;
      } else if (type === 'taches') {
        itemContent = `
          <div style="padding: 12px; margin: 8px 0; border: 1px solid #e5e7eb; border-radius: 8px; ${highlighted}">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: bold; color: #7c3aed;">📅 ${item.date || ''}</span>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; ${
                item.importance === 'pertinent' ? 'background: #fee2e2; color: #dc2626;' : 'background: #d1fae5; color: #059669;'
              }">${item.importance === 'pertinent' ? '🔴 Pertinent' : '🟢 Optionnel'}</span>
            </div>
            <div style="font-weight: bold; font-size: 14px; ${item.completed ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${item.description || ''}</div>
            <div style="color: #6b7280; font-size: 12px;">
              ⏰ ${item.heureDebut || ''} - ${item.heureFin || ''}
              ${item.travailleurNom ? ` • 👤 ${item.travailleurNom}` : ''}
            </div>
            ${comment ? `<div style="margin-top: 8px; padding: 8px; background: #dbeafe; border-radius: 6px; font-size: 12px;">
              <strong style="color: #2563eb;">💬 Commentaire:</strong> ${comment.text}
            </div>` : ''}
          </div>`;
      } else if (type === 'notes') {
        itemContent = `
          <div style="padding: 12px; margin: 8px 0; border: 1px solid #e5e7eb; border-radius: 8px; ${highlighted}">
            ${item.title ? `<div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${item.title}</div>` : ''}
            ${item.content ? `<div style="font-size: 12px; color: #4b5563; white-space: pre-wrap;">${item.content}</div>` : ''}
            ${comment ? `<div style="margin-top: 8px; padding: 8px; background: #dbeafe; border-radius: 6px; font-size: 12px;">
              <strong style="color: #2563eb;">💬 Commentaire:</strong> ${comment.text}
            </div>` : ''}
          </div>`;
      }
      
      itemsHtml += itemContent;
    });
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commentaires - ${typeLabel}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f9fafb; color: #1f2937; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { margin: 0 0 4px; font-size: 20px; }
    .header p { margin: 0; opacity: 0.9; font-size: 13px; }
    .contact { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
    .contact h3 { margin: 0 0 8px; font-size: 14px; color: #374151; }
    .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; color: #6b7280; }
    .items { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
    .items h3 { margin: 0 0 12px; font-size: 14px; color: #374151; }
    .general { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
    .general h3 { margin: 0 0 8px; font-size: 14px; color: #374151; }
    .general p { margin: 0; font-size: 13px; color: #4b5563; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Commentaires - ${typeLabel}</h1>
      <p>Par ${prenom} ${nom} • ${new Date(date).toLocaleString('fr-FR')}</p>
    </div>
    
    <div class="contact">
      <h3>👤 Informations de contact</h3>
      <div class="contact-grid">
        <div>Prénom: ${commentEntry.prenom}</div>
        <div>Nom: ${commentEntry.nom}</div>
        ${commentEntry.telephone ? `<div>📞 ${commentEntry.telephone}</div>` : ''}
        ${commentEntry.email ? `<div>📧 ${commentEntry.email}</div>` : ''}
      </div>
    </div>

    <div class="items">
      <h3>📋 Éléments partagés (${(allItems || []).length}) - Commentaires en surbrillance</h3>
      ${itemsHtml || '<p style="color: #9ca3af;">Aucun élément</p>'}
    </div>

    ${generalComment ? `
    <div class="general">
      <h3>💬 Commentaire général</h3>
      <p>${generalComment}</p>
    </div>` : ''}
  </div>
</body>
</html>`;

  const filename = `comment_${type}_${commentEntry.id}.html`;
  const filepath = path.join(snapshotDir, filename);
  fs.writeFileSync(filepath, html, 'utf8');
  return filename;
};

// Public: Submit comments for a shared link
router.post('/submit/:token', (req, res) => {
  try {
    const { token } = req.params;
    const { nom, prenom, telephone, email, comments, generalComment, allItems } = req.body;

    // Validate token exists and is active
    const tokens = readJSON(shareTokensPath);
    const entry = tokens.find(t => t.token === token && t.active);
    if (!entry) {
      return res.status(403).json({ error: 'Lien invalide ou révoqué' });
    }

    // Check if this token already has a comment submission
    const allComments = readJSON(commentsPath);
    const existing = allComments.find(c => c.token === token && c.status === 'sent');
    if (existing) {
      return res.status(400).json({ error: 'Des commentaires ont déjà été envoyés pour ce lien' });
    }

    const commentEntry = {
      id: Date.now().toString(),
      token,
      tokenId: entry.id,
      type: entry.type,
      nom: nom || '',
      prenom: prenom || '',
      telephone: telephone || '',
      email: email || '',
      comments: comments || [],
      generalComment: generalComment || '',
      allItems: allItems || [],
      status: 'validated',
      createdAt: new Date().toISOString(),
      read: false
    };

    allComments.push(commentEntry);
    writeJSON(commentsPath, allComments);

    res.json({ id: commentEntry.id, message: 'Commentaires enregistrés' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: Send (finalize) comments
router.post('/send/:id', (req, res) => {
  try {
    const { id } = req.params;
    const allComments = readJSON(commentsPath);
    const idx = allComments.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Commentaire non trouvé' });

    allComments[idx].status = 'sent';
    allComments[idx].sentAt = new Date().toISOString();

    // Generate snapshot HTML document
    const snapshotFile = generateSnapshot(allComments[idx]);
    allComments[idx].snapshotFile = snapshotFile;

    writeJSON(commentsPath, allComments);

    // Also save full data to comment-share.json (JSON backup)
    saveToCommentShare(allComments[idx]);

    // Sync: regenerate any missing HTML files from JSON backup
    syncJsonToHtml();

    // Notify SSE clients for real-time sync
    try {
      const syncManager = require('../middleware/sync');
      syncManager.notifyClients('share-comment-received', {
        type: allComments[idx].type,
        comment: {
          id: allComments[idx].id,
          type: allComments[idx].type,
          nom: allComments[idx].nom,
          prenom: allComments[idx].prenom,
          snapshotFile,
          sentAt: allComments[idx].sentAt,
        }
      });
    } catch (e) {
      // SSE notification is best-effort
    }

    res.json({ message: 'Commentaires envoyés' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: Check if comments already submitted for this token
router.get('/check/:token', (req, res) => {
  try {
    const { token } = req.params;
    const allComments = readJSON(commentsPath);
    const existing = allComments.find(c => c.token === token);
    res.json({ hasCommented: !!existing, status: existing?.status || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticated: Get all comments (with optional type filter)
router.get('/list', auth, (req, res) => {
  try {
    const { type } = req.query;
    let comments = readJSON(commentsPath).filter(c => c.status === 'sent');
    if (type) comments = comments.filter(c => c.type === type);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticated: Get unread count by type
router.get('/unread', auth, (req, res) => {
  try {
    const comments = readJSON(commentsPath).filter(c => c.status === 'sent' && !c.read);
    const counts = {
      notes: comments.filter(c => c.type === 'notes').length,
      pointage: comments.filter(c => c.type === 'pointage').length,
      taches: comments.filter(c => c.type === 'taches').length,
      total: comments.length
    };
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticated: Mark comment as read
router.patch('/read/:id', auth, (req, res) => {
  try {
    const { id } = req.params;
    const allComments = readJSON(commentsPath);
    const idx = allComments.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Non trouvé' });
    allComments[idx].read = true;
    writeJSON(commentsPath, allComments);
    res.json({ message: 'Marqué comme lu' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticated: Get a specific comment detail
router.get('/detail/:id', auth, (req, res) => {
  try {
    const { id } = req.params;
    const allComments = readJSON(commentsPath);
    const comment = allComments.find(c => c.id === id);
    if (!comment) return res.status(404).json({ error: 'Non trouvé' });
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve snapshot HTML files (authenticated) - auto-regenerate from JSON if missing
router.get('/snapshot/:filename', auth, (req, res) => {
  try {
    const { filename } = req.params;
    const safeName = path.basename(filename);
    let filepath = path.join(snapshotDir, safeName);

    // If HTML file doesn't exist, try to regenerate from comment-share.json
    if (!fs.existsSync(filepath)) {
      const match = safeName.match(/^comment_(\w+)_(\d+)\.html$/);
      if (match) {
        const [, type, id] = match;
        const allShared = readJSON(commentSharePath);
        const entry = allShared.find(c => c.id === id && c.type === type);
        if (entry) {
          generateSnapshot(entry);
        }
      }
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(filepath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticated: Trigger sync - regenerate all missing HTML from comment-share.json
router.post('/sync-html', auth, (req, res) => {
  try {
    const result = syncJsonToHtml();
    res.json({ message: `Synchronisation terminée`, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticated: Import comments from JSON (inject data into comment-share.json)
router.post('/import-json', auth, (req, res) => {
  try {
    const { comments } = req.body;
    if (!Array.isArray(comments)) {
      return res.status(400).json({ error: 'Format invalide: attendu { comments: [...] }' });
    }

    const allShared = readJSON(commentSharePath);
    const mainComments = readJSON(commentsPath);
    let imported = 0;

    comments.forEach(entry => {
      if (!entry.id || !entry.type) return;

      // Save to comment-share.json
      const existingIdx = allShared.findIndex(c => c.id === entry.id);
      if (existingIdx >= 0) {
        allShared[existingIdx] = entry;
      } else {
        allShared.push(entry);
        imported++;
      }

      // Also sync to main comments DB
      const mainIdx = mainComments.findIndex(c => c.id === entry.id);
      if (mainIdx >= 0) {
        mainComments[mainIdx] = entry;
      } else {
        mainComments.push(entry);
      }
    });

    writeJSON(commentSharePath, allShared);
    writeJSON(commentsPath, mainComments);

    // Regenerate all missing HTML files
    const syncResult = syncJsonToHtml();

    res.json({ message: `${imported} commentaires importés`, ...syncResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticated: Export all comments as JSON
router.get('/export-json', auth, (req, res) => {
  try {
    const allShared = readJSON(commentSharePath);
    res.json({ comments: allShared, total: allShared.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
