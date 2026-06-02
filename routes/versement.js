/**
 * versement.js - Routes API pour la gestion des versements espèce
 *
 * Stocke les versements espèce et le montant maximum mensuel autorisé.
 * Calcul "fenêtre glissante 30 jours" effectué côté client.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const auth = require('../middleware/auth');

const DB_FILE = path.join(__dirname, '..', 'db', 'montant-verser.json');

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const init = { maxMonthly: 0, versements: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2));
      return init;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(raw || '{}');
    return {
      maxMonthly: Number(data.maxMonthly) || 0,
      versements: Array.isArray(data.versements) ? data.versements : [],
    };
  } catch (e) {
    console.error('versement readDb error:', e);
    return { maxMonthly: 0, versements: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// GET tous les versements + config
router.get('/', auth, (req, res) => {
  try {
    res.json(readDb());
  } catch (e) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT update max mensuel
router.put('/max', auth, (req, res) => {
  try {
    const { maxMonthly } = req.body;
    const val = parseFloat(maxMonthly);
    if (isNaN(val) || val < 0) {
      return res.status(400).json({ message: 'Montant maximum invalide' });
    }
    const db = readDb();
    db.maxMonthly = val;
    writeDb(db);
    res.json(db);
  } catch (e) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST nouveau versement
router.post('/', auth, (req, res) => {
  try {
    const { date, montant, description } = req.body;
    const m = parseFloat(montant);
    if (!date || isNaN(m) || m <= 0) {
      return res.status(400).json({ message: 'Date et montant requis' });
    }
    const db = readDb();
    const v = {
      id: genId(),
      date,
      montant: m,
      description: (description || '').toString(),
      createdAt: new Date().toISOString(),
    };
    db.versements.push(v);
    writeDb(db);
    res.status(201).json(v);
  } catch (e) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT update versement
router.put('/:id', auth, (req, res) => {
  try {
    const db = readDb();
    const idx = db.versements.findIndex(v => v.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Versement non trouvé' });
    const { date, montant, description } = req.body;
    if (date !== undefined) db.versements[idx].date = date;
    if (montant !== undefined) {
      const m = parseFloat(montant);
      if (isNaN(m) || m <= 0) return res.status(400).json({ message: 'Montant invalide' });
      db.versements[idx].montant = m;
    }
    if (description !== undefined) db.versements[idx].description = description;
    writeDb(db);
    res.json(db.versements[idx]);
  } catch (e) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE versement
router.delete('/:id', auth, (req, res) => {
  try {
    const db = readDb();
    const before = db.versements.length;
    db.versements = db.versements.filter(v => v.id !== req.params.id);
    if (db.versements.length === before) {
      return res.status(404).json({ message: 'Versement non trouvé' });
    }
    writeDb(db);
    res.json({ message: 'Versement supprimé' });
  } catch (e) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
