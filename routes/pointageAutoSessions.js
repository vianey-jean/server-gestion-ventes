/**
 * =============================================================================
 * Routes Pointage Auto Sessions — Synchronisation multi-admin
 * =============================================================================
 * Permet à plusieurs admins connectés de voir/valider/annuler la MÊME
 * notification de pointage automatique en temps réel.
 *
 * Une session représente une notification en cours pour (ruleId + date).
 * Toutes les actions sont persistées dans pointageAutoSessions.json.
 *
 * Entrée :
 *   {
 *     id, ruleId, date (YYYY-MM-DD),
 *     travailleurId, entrepriseId,
 *     startedAt (ISO), expiresAt (ISO),
 *     status: 'pending' | 'validated' | 'cancelled',
 *     closedAt, closedBy
 *   }
 *
 * Annulation : marque la session comme cancelled ET ajoute une empreinte
 * dans pointageDeleted.json. Conséquence : plus aucun pointage auto ne sera
 * recréé pour ce (date+travailleur+entreprise), même après reconnexion ou
 * ré-injection des données. Seul un pointage MANUEL est possible.
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const { addFingerprint } = require('./pointageDeleted');

const dbFile = path.join(__dirname, '../db/pointageAutoSessions.json');

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

/** GET toutes les sessions (pending seulement par défaut) */
router.get('/', authMiddleware, (req, res) => {
  try {
    const items = readAll();
    const { status } = req.query;
    if (status) return res.json(items.filter(s => s.status === status));
    res.json(items);
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

/**
 * POST — Crée une session OU retourne l'existante (idempotent)
 * Body: { ruleId, date, travailleurId, entrepriseId, durationMs }
 */
router.post('/', authMiddleware, (req, res) => {
  try {
    const { ruleId, date, travailleurId, entrepriseId, durationMs } = req.body || {};
    if (!ruleId || !date) return res.status(400).json({ message: 'ruleId et date requis' });
    const items = readAll();
    // Session existante (pending) pour cette règle+date ?
    const existing = items.find(s =>
      s.ruleId === ruleId && s.date === date && s.status === 'pending'
    );
    if (existing) return res.json(existing);

    const now = Date.now();
    const duration = Number(durationMs) > 0 ? Number(durationMs) : 5 * 60 * 1000;
    const session = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ruleId,
      date,
      travailleurId: travailleurId || '',
      entrepriseId: entrepriseId || '',
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + duration).toISOString(),
      status: 'pending',
      closedAt: null,
      closedBy: null,
    };
    items.push(session);
    writeAll(items);
    res.status(201).json(session);
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

/**
 * PATCH /:id — Met à jour le statut (validated / cancelled)
 * Body: { status, closedBy }
 * Si cancelled → ajoute une empreinte dans pointageDeleted.json
 */
router.patch('/:id', authMiddleware, (req, res) => {
  try {
    const { status, closedBy } = req.body || {};
    if (!['validated', 'cancelled', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }
    const items = readAll();
    const idx = items.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Non trouvé' });

    // Idempotence : si déjà fermée, on retourne tel quel
    if (items[idx].status !== 'pending' && status !== 'pending') {
      return res.json(items[idx]);
    }

    items[idx].status = status;
    items[idx].closedAt = new Date().toISOString();
    items[idx].closedBy = closedBy || (req.user && (req.user.username || req.user.id)) || 'system';

    // Annulation : bloque l'auto pour cette date/travailleur/entreprise
    if (status === 'cancelled') {
      try {
        addFingerprint({
          date: items[idx].date,
          travailleurId: items[idx].travailleurId,
          entrepriseId: items[idx].entrepriseId,
        });
      } catch { /* silencieux */ }
    }

    writeAll(items);
    res.json(items[idx]);
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

/** DELETE — purge anciennes sessions fermées (optionnel) */
router.delete('/cleanup', authMiddleware, (req, res) => {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24h
    const items = readAll().filter(s =>
      s.status === 'pending' || new Date(s.closedAt || s.startedAt).getTime() > cutoff
    );
    writeAll(items);
    res.json({ ok: true, remaining: items.length });
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
