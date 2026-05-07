/**
 * Routes Préparation Livraison
 * Stocke un snapshot des commandes/réservations (en_attente, valide, annule, reporter)
 * + l'état de préparation (termine, statut: 'en_cours' | 'fini').
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const dbPath = path.join(__dirname, '../db/prepa-livraison.json');

const PERSIST_STATUTS = ['en_attente', 'valide', 'annule', 'reporter'];

const readJson = () => {
  try {
    if (!fs.existsSync(dbPath)) return [];
    const raw = fs.readFileSync(dbPath, 'utf8');
    if (!raw || !raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeJson = (data) => {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};

// GET all
router.get('/', authMiddleware, (req, res) => {
  try {
    res.json(readJson());
  } catch (e) {
    console.error('prepa-livraison get error', e);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /sync : upsert snapshot for relevant statuts, preserve termine flag
router.post('/sync', authMiddleware, (req, res) => {
  try {
    const { entries } = req.body || {};
    if (!Array.isArray(entries)) {
      return res.status(400).json({ message: 'entries invalide' });
    }
    const existing = readJson();
    const byId = new Map(existing.map(e => [e.id, e]));
    const now = new Date().toISOString();

    entries.forEach(c => {
      if (!c || !c.id) return;
      if (!PERSIST_STATUTS.includes(c.statut)) return;
      const prev = byId.get(c.id) || {};
      byId.set(c.id, {
        id: c.id,
        clientNom: c.clientNom || '',
        clientPhone: c.clientPhone || '',
        clientAddress: c.clientAddress || '',
        type: c.type,
        produits: Array.isArray(c.produits) ? c.produits : [],
        dateArrivagePrevue: c.dateArrivagePrevue || null,
        dateEcheance: c.dateEcheance || null,
        horaire: c.horaire || null,
        horaireFin: c.horaireFin || null,
        statut: c.statut,
        clientCaracteristique: c.clientCaracteristique || null,
        termine: prev.termine === true,
        statutLivraison: prev.termine === true ? 'fini' : 'en_cours',
        createdAt: prev.createdAt || now,
        updatedAt: now,
      });
    });

    const merged = Array.from(byId.values());
    writeJson(merged);
    res.json(merged);
  } catch (e) {
    console.error('prepa-livraison sync error', e);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PATCH /:id  { termine: boolean }
router.patch('/:id', authMiddleware, (req, res) => {
  try {
    const { termine } = req.body || {};
    const data = readJson();
    const idx = data.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Non trouvé' });
    data[idx].termine = !!termine;
    data[idx].statutLivraison = termine ? 'fini' : 'en_cours';
    data[idx].updatedAt = new Date().toISOString();
    writeJson(data);
    res.json(data[idx]);
  } catch (e) {
    console.error('prepa-livraison patch error', e);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
