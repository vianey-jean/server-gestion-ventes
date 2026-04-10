const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

const commentsPath = path.join(__dirname, '..', 'db', 'lienpartagecommente.json');
const shareTokensPath = path.join(__dirname, '..', 'db', 'shareTokens.json');

const readJSON = (filePath) => {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return []; }
};

const writeJSON = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

if (!fs.existsSync(commentsPath)) writeJSON(commentsPath, []);

// Public: Submit comments for a shared link
router.post('/submit/:token', (req, res) => {
  try {
    const { token } = req.params;
    const { nom, prenom, telephone, email, comments, generalComment } = req.body;

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
      comments: comments || [], // Array of { index, text } for inline comments
      generalComment: generalComment || '',
      status: 'validated', // validated but not yet sent
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
    writeJSON(commentsPath, allComments);

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

module.exports = router;
