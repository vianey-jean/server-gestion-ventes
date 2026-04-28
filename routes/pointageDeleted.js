/**
 * =============================================================================
 * Routes Pointage Deleted (empreintes)
 * =============================================================================
 * Conserve la trace des pointages supprimés (date + travailleurId + entrepriseId)
 * pour empêcher le pointage AUTOMATIQUE de recréer le même pointage.
 * Un pointage MANUEL (création directe via /api/pointages) reste autorisé.
 *
 * Format d'une entrée :
 *   { date: 'YYYY-MM-DD', travailleurId: '...', entrepriseId: '...', deletedAt: ISO }
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const dbFile = path.join(__dirname, '../db/pointageDeleted.json');

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

const addFingerprint = (fp) => {
  if (!fp || !fp.date) return;
  const items = readAll();
  const exists = items.some(x =>
    x.date === fp.date &&
    (x.travailleurId || '') === (fp.travailleurId || '') &&
    (x.entrepriseId || '') === (fp.entrepriseId || '')
  );
  if (!exists) {
    items.push({
      date: fp.date,
      travailleurId: fp.travailleurId || '',
      entrepriseId: fp.entrepriseId || '',
      deletedAt: new Date().toISOString(),
    });
    writeAll(items);
  }
};

// GET all
router.get('/', authMiddleware, (req, res) => {
  try { res.json(readAll()); }
  catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

// POST add fingerprint (usage interne possible)
router.post('/', authMiddleware, (req, res) => {
  try {
    addFingerprint({
      date: req.body.date,
      travailleurId: req.body.travailleurId,
      entrepriseId: req.body.entrepriseId,
    });
    res.status(201).json({ ok: true });
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

// DELETE one fingerprint (au cas où admin veut réautoriser l'auto)
router.delete('/', authMiddleware, (req, res) => {
  try {
    const { date, travailleurId, entrepriseId } = req.body || {};
    let items = readAll();
    items = items.filter(x => !(
      x.date === date &&
      (x.travailleurId || '') === (travailleurId || '') &&
      (x.entrepriseId || '') === (entrepriseId || '')
    ));
    writeAll(items);
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
module.exports.addFingerprint = addFingerprint;
