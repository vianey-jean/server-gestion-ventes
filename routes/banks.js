/**
 * banks.js - Routes API pour la gestion des banques (bank.json)
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const auth = require('../middleware/auth');

const DB_FILE = path.join(__dirname, '..', 'db', 'bank.json');

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
      return [];
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(raw || '[]');
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('banks readDb:', e);
    return [];
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

router.get('/', auth, (_req, res) => {
  try { res.json(readDb()); } catch { res.status(500).json({ message: 'Erreur' }); }
});

router.post('/', auth, (req, res) => {
  try {
    const name = (req.body?.name || '').toString().trim();
    if (!name) return res.status(400).json({ message: 'Nom requis' });
    const db = readDb();
    if (db.some(b => (b.name || '').toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ message: 'Banque déjà existante' });
    }
    const bank = { id: genId(), name, createdAt: new Date().toISOString() };
    db.push(bank);
    writeDb(db);
    res.status(201).json(bank);
  } catch (e) {
    res.status(500).json({ message: 'Erreur' });
  }
});

router.delete('/:id', auth, (req, res) => {
  try {
    const db = readDb();
    const next = db.filter(b => b.id !== req.params.id);
    if (next.length === db.length) return res.status(404).json({ message: 'Non trouvée' });
    writeDb(next);
    res.json({ message: 'Supprimée' });
  } catch { res.status(500).json({ message: 'Erreur' }); }
});

module.exports = router;
