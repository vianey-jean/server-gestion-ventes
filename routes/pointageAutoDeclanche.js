/**
 * =============================================================================
 * Routes Pointage Auto Déclenché — PERSISTENCE DU CHRONO MULTI-ADMIN
 * =============================================================================
 * Stocke l'état "chrono déclenché" pour chaque (ruleId + date).
 * Quand un admin se connecte plus tard, il récupère le `startedAt` initial
 * et reprend le chrono là où il en est (pas de remise à zéro).
 *
 * Persiste aussi quand TOUTES les données sont supprimées et réinjectées :
 * tant qu'une règle est `active` et que le pointage du jour n'existe pas,
 * une nouvelle entrée est créée (ou récupérée) et le chrono démarre.
 *
 * Schéma d'une entrée :
 *   {
 *     id,
 *     ruleId,
 *     date,                 // YYYY-MM-DD
 *     travailleurId,
 *     entrepriseId,
 *     active: true,         // chrono actif ?
 *     chronoDeclanche: true,
 *     startedAt: ISO,       // début du chrono (jamais réinitialisé)
 *     expiresAt: ISO,       // début + 5 min par défaut
 *     status: 'pending' | 'validated' | 'cancelled',
 *     closedAt, closedBy
 *   }
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const dbFile = path.join(__dirname, '../db/pointageautodeclanche.json');

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

/** GET tous (filtre status optionnel) */
router.get('/', authMiddleware, (req, res) => {
  try {
    const items = readAll();
    const { status, ruleId, date } = req.query;
    let out = items;
    if (status) out = out.filter(x => x.status === status);
    if (ruleId) out = out.filter(x => x.ruleId === ruleId);
    if (date) out = out.filter(x => x.date === date);
    res.json(out);
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

/**
 * POST — Crée OU retourne l'entrée existante (idempotent)
 * Body: { ruleId, date, travailleurId, entrepriseId, durationMs }
 * Si une entrée pending existe déjà pour (ruleId+date), on la retourne
 * SANS toucher startedAt → le chrono continue.
 */
router.post('/', authMiddleware, (req, res) => {
  try {
    const { ruleId, date, travailleurId, entrepriseId, durationMs } = req.body || {};
    if (!ruleId || !date) return res.status(400).json({ message: 'ruleId et date requis' });
    const items = readAll();
    const existing = items.find(x =>
      x.ruleId === ruleId && x.date === date && x.status === 'pending'
    );
    if (existing) return res.json(existing);

    const now = Date.now();
    const duration = Number(durationMs) > 0 ? Number(durationMs) : 5 * 60 * 1000;
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ruleId,
      date,
      travailleurId: travailleurId || '',
      entrepriseId: entrepriseId || '',
      active: true,
      chronoDeclanche: true,
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + duration).toISOString(),
      status: 'pending',
      closedAt: null,
      closedBy: null,
    };
    items.push(entry);
    writeAll(items);
    res.status(201).json(entry);
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

/** PATCH /:id — clôture (validated / cancelled) */
router.patch('/:id', authMiddleware, (req, res) => {
  try {
    const { status, closedBy } = req.body || {};
    if (!['validated', 'cancelled', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }
    const items = readAll();
    const idx = items.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Non trouvé' });
    if (items[idx].status !== 'pending' && status !== 'pending') {
      return res.json(items[idx]);
    }
    items[idx].status = status;
    items[idx].active = status === 'pending';
    items[idx].chronoDeclanche = status === 'pending';
    items[idx].closedAt = new Date().toISOString();
    items[idx].closedBy = closedBy || 'system';
    writeAll(items);
    res.json(items[idx]);
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

/** DELETE cleanup — purge entrées fermées > 24h */
router.delete('/cleanup', authMiddleware, (req, res) => {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const items = readAll().filter(x =>
      x.status === 'pending' || new Date(x.closedAt || x.startedAt).getTime() > cutoff
    );
    writeAll(items);
    res.json({ ok: true, remaining: items.length });
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
