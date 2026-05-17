/**
 * Routes Maintenance
 * - GET  /api/maintenance/status      : public
 * - PUT  /api/maintenance/toggle      : admin principale
 * - POST /api/maintenance/check-admin : public
 * - CRUD /api/maintenance/scheduled   : admin principale (maintenances auto programmées)
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

const dbPath = path.join(__dirname, '../db');
const maintenancePath = path.join(dbPath, 'maintenance.json');

const defaultData = {
  maintenant: false,
  activatedAt: null,
  activatedBy: null,
  message: 'Le site est en maintenance. Seul un administrateur principal peut se connecter.',
  scheduled: [],
  autoActiveId: null
};

const readData = () => {
  try {
    if (!fs.existsSync(maintenancePath)) {
      fs.writeFileSync(maintenancePath, JSON.stringify(defaultData, null, 2));
      return { ...defaultData };
    }
    const raw = JSON.parse(fs.readFileSync(maintenancePath, 'utf8'));
    return {
      ...defaultData,
      ...raw,
      scheduled: Array.isArray(raw.scheduled) ? raw.scheduled : []
    };
  } catch (e) {
    return { ...defaultData };
  }
};

const writeData = (data) => {
  fs.writeFileSync(maintenancePath, JSON.stringify(data, null, 2));
};

// --- Scheduler: vérifie périodiquement les maintenances programmées ---
const tickScheduler = () => {
  try {
    const data = readData();
    const now = Date.now();
    let changed = false;

    // Activation
    for (const s of data.scheduled) {
      const start = new Date(s.startAt).getTime();
      const end = new Date(s.endAt).getTime();
      if (now >= start && now < end && !s.triggered) {
        s.triggered = true;
        data.maintenant = true;
        data.activatedAt = new Date().toISOString();
        data.activatedBy = `auto (${s.id})`;
        data.message = s.message || data.message;
        data.autoActiveId = s.id;
        changed = true;
      }
    }
    // Désactivation auto à la fin
    if (data.autoActiveId) {
      const active = data.scheduled.find(s => s.id === data.autoActiveId);
      if (active) {
        const end = new Date(active.endAt).getTime();
        if (now >= end) {
          data.maintenant = false;
          data.activatedAt = null;
          data.activatedBy = null;
          data.autoActiveId = null;
          changed = true;
        }
      } else {
        data.autoActiveId = null;
        changed = true;
      }
    }
    if (changed) writeData(data);
  } catch (e) {
    console.error('[maintenance scheduler]', e.message);
  }
};
setInterval(tickScheduler, 30 * 1000);
setTimeout(tickScheduler, 2000);

// PUBLIC : statut
router.get('/status', (req, res) => {
  try {
    tickScheduler();
    const data = readData();
    res.json({
      maintenant: !!data.maintenant,
      message: data.message || defaultData.message,
      activatedAt: data.activatedAt || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.post('/check-admin', (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ isAdminPrincipal: false, message: 'Email requis' });
    const users = User.getAll();
    const user = users.find(u => (u.email || '').toLowerCase() === String(email).toLowerCase());
    if (!user) return res.json({ isAdminPrincipal: false, exists: false });
    const isAdminPrincipal = user.role === 'administrateur principale';
    res.json({
      isAdminPrincipal,
      exists: true,
      user: isAdminPrincipal ? { firstName: user.firstName, lastName: user.lastName } : undefined
    });
  } catch (error) {
    res.status(500).json({ isAdminPrincipal: false, message: 'Erreur serveur' });
  }
});

router.put('/toggle', authMiddleware, (req, res) => {
  try {
    if (!req.user || req.user.role !== 'administrateur principale') {
      return res.status(403).json({ message: 'Accès réservé à l\'administrateur principal' });
    }
    const { maintenant, message } = req.body || {};
    const data = readData();
    if (typeof maintenant === 'boolean') {
      data.maintenant = maintenant;
      data.activatedAt = maintenant ? new Date().toISOString() : null;
      data.activatedBy = maintenant ? `${req.user.firstName} ${req.user.lastName}` : null;
      if (!maintenant) data.autoActiveId = null;
    }
    if (typeof message === 'string' && message.trim()) {
      data.message = message.trim();
    }
    writeData(data);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ===== Scheduled maintenances =====
const requireAdminPrincipal = (req, res, next) => {
  if (!req.user || req.user.role !== 'administrateur principale') {
    return res.status(403).json({ message: 'Accès réservé à l\'administrateur principal' });
  }
  next();
};

router.get('/scheduled', authMiddleware, requireAdminPrincipal, (req, res) => {
  const data = readData();
  res.json(data.scheduled || []);
});

router.post('/scheduled', authMiddleware, requireAdminPrincipal, (req, res) => {
  try {
    const { startAt, days = 0, hours = 0, message } = req.body || {};
    if (!startAt) return res.status(400).json({ message: 'startAt requis' });
    const d = Number(days) || 0;
    const h = Number(hours) || 0;
    if (d <= 0 && h <= 0) return res.status(400).json({ message: 'Durée requise (jours ou heures)' });
    const start = new Date(startAt);
    if (isNaN(start.getTime())) return res.status(400).json({ message: 'Date invalide' });
    const end = new Date(start.getTime() + (d * 24 + h) * 3600 * 1000);

    const data = readData();
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      days: d,
      hours: h,
      message: (message && String(message).trim()) || data.message || defaultData.message,
      createdAt: new Date().toISOString(),
      createdBy: `${req.user.firstName} ${req.user.lastName}`,
      triggered: false
    };
    data.scheduled.push(entry);
    writeData(data);
    res.json({ success: true, scheduled: entry });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.put('/scheduled/:id', authMiddleware, requireAdminPrincipal, (req, res) => {
  try {
    const { id } = req.params;
    const { startAt, days, hours, message } = req.body || {};
    const data = readData();
    const idx = data.scheduled.findIndex(s => s.id === id);
    if (idx === -1) return res.status(404).json({ message: 'Introuvable' });
    const cur = data.scheduled[idx];
    const d = days != null ? Number(days) : cur.days || 0;
    const h = hours != null ? Number(hours) : cur.hours || 0;
    const start = startAt ? new Date(startAt) : new Date(cur.startAt);
    if (isNaN(start.getTime())) return res.status(400).json({ message: 'Date invalide' });
    const end = new Date(start.getTime() + (d * 24 + h) * 3600 * 1000);
    data.scheduled[idx] = {
      ...cur,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      days: d,
      hours: h,
      message: message != null ? String(message) : cur.message,
      triggered: false
    };
    writeData(data);
    res.json({ success: true, scheduled: data.scheduled[idx] });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.delete('/scheduled/:id', authMiddleware, requireAdminPrincipal, (req, res) => {
  try {
    const { id } = req.params;
    const data = readData();
    data.scheduled = (data.scheduled || []).filter(s => s.id !== id);
    if (data.autoActiveId === id) {
      data.autoActiveId = null;
      data.maintenant = false;
      data.activatedAt = null;
      data.activatedBy = null;
    }
    writeData(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
