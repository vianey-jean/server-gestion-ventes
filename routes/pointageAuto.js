/**
 * =============================================================================
 * Routes Pointage Automatique
 * =============================================================================
 * Gère les règles de pointage automatique configurées par l'admin.
 * Chaque règle contient :
 *  - id, travailleurId, travailleurNom (Personne)
 *  - jours: tableau de jours ['lundi','mardi',...] OU 'toute' pour toute la semaine
 *  - entrepriseId, entrepriseNom
 *  - typePaiement, heures, prixHeure, prixJournalier, montantTotal
 *  - active: boolean (activé/désactivé)
 *  - createdAt
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const dbFile = path.join(__dirname, '../db/pointageauto.json');

const readAll = () => {
  try {
    if (!fs.existsSync(dbFile)) {
      fs.writeFileSync(dbFile, '[]');
      return [];
    }
    const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
};

const writeAll = (data) => {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
};

// GET all
router.get('/', authMiddleware, (req, res) => {
  try {
    res.json(readAll());
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

// GET one
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const item = readAll().find(p => p.id === req.params.id);
    if (!item) return res.status(404).json({ message: 'Non trouvé' });
    res.json(item);
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST create
router.post('/', authMiddleware, (req, res) => {
  try {
    const items = readAll();
    const newItem = {
      id: Date.now().toString(),
      travailleurId: req.body.travailleurId || '',
      travailleurNom: req.body.travailleurNom || '',
      jours: req.body.jours || 'toute',
      entrepriseId: req.body.entrepriseId || '',
      entrepriseNom: req.body.entrepriseNom || '',
      typePaiement: req.body.typePaiement || 'journalier',
      heures: Number(req.body.heures) || 0,
      prixHeure: Number(req.body.prixHeure) || 0,
      prixJournalier: Number(req.body.prixJournalier) || 0,
      montantTotal: Number(req.body.montantTotal) || 0,
      active: req.body.active !== undefined ? !!req.body.active : true,
      createdAt: new Date().toISOString(),
    };
    items.push(newItem);
    writeAll(items);
    res.status(201).json(newItem);
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

// PUT update
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const items = readAll();
    const idx = items.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Non trouvé' });
    items[idx] = { ...items[idx], ...req.body, id: items[idx].id };
    writeAll(items);
    res.json(items[idx]);
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

// DELETE
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    let items = readAll();
    const idx = items.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Non trouvé' });
    items.splice(idx, 1);
    writeAll(items);
    res.json({ message: 'Supprimé' });
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
