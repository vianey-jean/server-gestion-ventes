/**
 * Routes Maintenance
 * - GET  /api/maintenance/status      : public, retourne { maintenant, message }
 * - PUT  /api/maintenance/toggle      : admin principale, active/désactive maintenance
 * - POST /api/maintenance/check-admin : public, vérifie qu'un email correspond à un admin principal
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
  message: 'Le site est en maintenance. Seul un administrateur principal peut se connecter.'
};

const readData = () => {
  try {
    if (!fs.existsSync(maintenancePath)) {
      fs.writeFileSync(maintenancePath, JSON.stringify(defaultData, null, 2));
      return { ...defaultData };
    }
    return JSON.parse(fs.readFileSync(maintenancePath, 'utf8'));
  } catch (e) {
    return { ...defaultData };
  }
};

const writeData = (data) => {
  fs.writeFileSync(maintenancePath, JSON.stringify(data, null, 2));
};

// PUBLIC : statut de maintenance
router.get('/status', (req, res) => {
  try {
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

// PUBLIC : vérifie qu'un email appartient à un admin principal (pour la page login maintenance)
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

// PROTÉGÉ : toggle maintenance (admin principal uniquement)
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

module.exports = router;
