/**
 * =============================================================================
 * Routes Blocage IP
 * =============================================================================
 *  - GET    /api/blockage-ip/check   : public — IP appelante + statut
 *  - GET    /api/blockage-ip         : protégé — liste des IP bloquées
 *  - POST   /api/blockage-ip         : protégé — bloquer une IP
 *  - DELETE /api/blockage-ip/:id     : protégé — débloquer (id ou IP)
 *
 * @module routes/blockageIp
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const BlockageIp = require('../models/BlockageIp');
const { getClientIp } = require('../middleware/ipBlocklist');

// --- Public : vérification de l'IP appelante ------------------------------
router.get('/check', (req, res) => {
  const ip = getClientIp(req);
  const entry = BlockageIp.findActive(ip);
  res.json({
    ip,
    blocked: !!entry,
    reason: entry?.reason || null,
    blockedAt: entry?.createdAt || null,
  });
});

// --- Protégé ---------------------------------------------------------------
router.get('/', authMiddleware, (req, res) => {
  res.json({ ips: BlockageIp.getAll(), currentIp: getClientIp(req) });
});

router.post('/', authMiddleware, (req, res) => {
  const { ip, reason } = req.body || {};
  if (!ip || typeof ip !== 'string') {
    return res.status(400).json({ message: 'Adresse IP requise' });
  }

  const target = BlockageIp.normalizeIp(ip);
  const self = BlockageIp.normalizeIp(getClientIp(req));
  if (target === self) {
    return res.status(400).json({ message: 'Vous ne pouvez pas bloquer votre propre adresse IP' });
  }

  const result = BlockageIp.add({
    ip: target,
    reason,
    createdBy: req.user?.email || req.user?.id || null,
  });
  if (result.error) return res.status(400).json({ message: result.error });

  res.status(201).json({ success: true, entry: result.entry });
});

// --- Modification d'une IP bloquée ----------------------------------------
router.put('/:id', authMiddleware, (req, res) => {
  const { ip, reason } = req.body || {};
  if (ip !== undefined) {
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ message: 'Adresse IP requise' });
    }
    const self = BlockageIp.normalizeIp(getClientIp(req));
    if (BlockageIp.normalizeIp(ip) === self) {
      return res.status(400).json({ message: 'Vous ne pouvez pas bloquer votre propre adresse IP' });
    }
  }
  const result = BlockageIp.update(req.params.id, { ip, reason });
  if (result.error) return res.status(400).json({ message: result.error });
  res.json({ success: true, entry: result.entry });
});

// --- Activation / mise en pause d'un blocage --------------------------------
router.patch('/:id/active', authMiddleware, (req, res) => {
  const { active } = req.body || {};
  if (typeof active !== 'boolean') {
    return res.status(400).json({ message: 'Champ "active" (booléen) requis' });
  }
  const result = BlockageIp.setActive(req.params.id, active);
  if (result.error) return res.status(404).json({ message: result.error });
  res.json({ success: true, entry: result.entry });
});

router.delete('/:id', authMiddleware, (req, res) => {
  const ok = BlockageIp.remove(req.params.id);
  if (!ok) return res.status(404).json({ message: 'Adresse IP introuvable' });
  res.json({ success: true });
});

module.exports = router;
