const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const auth = require('../middleware/auth');

const tokensPath = path.join(__dirname, '..', 'db', 'noteShareTokens.json');
const notesPath = path.join(__dirname, '..', 'db', 'notes.json');
const columnsPath = path.join(__dirname, '..', 'db', 'noteColumns.json');

const readJSON = (filePath) => {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return []; }
};

const writeJSON = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Generate or get existing share token (authenticated)
router.post('/generate', auth, (req, res) => {
  try {
    let tokens = readJSON(tokensPath);
    
    // Return existing active token if any
    const existing = tokens.find(t => t.active);
    if (existing) {
      return res.json({ token: existing.token, createdAt: existing.createdAt });
    }

    // Generate new secure token
    const token = crypto.randomBytes(32).toString('hex');
    const entry = {
      id: Date.now().toString(),
      token,
      active: true,
      createdAt: new Date().toISOString()
    };
    tokens.push(entry);
    writeJSON(tokensPath, tokens);

    res.json({ token: entry.token, createdAt: entry.createdAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke share token (authenticated)
router.delete('/revoke', auth, (req, res) => {
  try {
    let tokens = readJSON(tokensPath);
    tokens = tokens.map(t => ({ ...t, active: false }));
    writeJSON(tokensPath, tokens);
    res.json({ message: 'Lien de partage révoqué' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: view shared notes (NO auth required)
router.get('/view/:token', (req, res) => {
  try {
    const { token } = req.params;
    const tokens = readJSON(tokensPath);
    
    const valid = tokens.find(t => t.token === token && t.active);
    if (!valid) {
      return res.status(403).json({ error: 'Lien de partage invalide ou expiré' });
    }

    // Return read-only data (no IDs that could be used for mutations)
    const notes = readJSON(notesPath).map(n => ({
      title: n.title,
      content: n.content,
      columnId: n.columnId,
      order: n.order,
      color: n.color,
      bold: n.bold,
      boldLines: n.boldLines || [],
      underlineLines: n.underlineLines || [],
      drawing: n.drawing,
      voiceText: n.voiceText || '',
      createdAt: n.createdAt
    }));

    const columns = readJSON(columnsPath).map(c => ({
      title: c.title,
      color: c.color,
      order: c.order,
      id: c.id // needed for matching columnId
    }));

    res.json({ notes, columns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
