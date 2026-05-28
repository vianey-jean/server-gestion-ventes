/**
 * historiqueConnexion.js - Historique des connexions et visites du site.
 * Enregistre chaque tentative de connexion (succès / échec / bloqué) et chaque
 * visite anonyme (sans authentification). Stocké dans db/historique-connexion.json.
 *
 * Champ : id, type ('login_success'|'login_failed'|'login_locked'|'visit'),
 *         userId, userEmail, userName, userRole, ip, userAgent, browser, os,
 *         device, statut, message, date (ISO).
 */
const express = require('express');
const path = require('path');
const router = express.Router();
const { readJsonDecrypted, writeJsonEncrypted } = require('../middleware/encryption');

const FILE = path.join(__dirname, '../db/historique-connexion.json');
const MAX_ENTRIES = 5000; // garde-fou taille fichier

const read = () => {
  try { return readJsonDecrypted(FILE) || []; } catch { return []; }
};
const write = (data) => {
  try { writeJsonEncrypted(FILE, data); } catch (e) { console.error('historique write error:', e.message); }
};

const parseUA = (ua = '') => {
  let browser = 'Inconnu', os = 'Inconnu', device = 'Desktop';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iOS/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  if (/Mobile|Android|iPhone/i.test(ua)) device = 'Mobile';
  else if (/Tablet|iPad/i.test(ua)) device = 'Tablet';
  return { browser, os, device };
};

const getClientIp = (req) => {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
};

const logEntry = (req, payload = {}) => {
  try {
    const ua = req.headers['user-agent'] || '';
    const { browser, os, device } = parseUA(ua);
    const entry = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
      type: payload.type || 'visit',
      userId: payload.userId || '',
      userEmail: payload.userEmail || '',
      userName: payload.userName || '',
      userRole: payload.userRole || (payload.type === 'visit' ? 'visiteur' : ''),
      ip: getClientIp(req),
      userAgent: ua,
      browser, os, device,
      statut: payload.statut || (payload.type === 'login_success' ? 'succès' : payload.type === 'login_failed' ? 'échec' : payload.type === 'login_locked' ? 'bloqué' : 'visite'),
      message: payload.message || '',
      page: payload.page || '',
      referrer: payload.referrer || req.headers['referer'] || '',
      sessionId: payload.sessionId || '',
      date: new Date().toISOString(),
    };
    const data = read();
    data.push(entry);
    // Trim if too large
    const trimmed = data.length > MAX_ENTRIES ? data.slice(-MAX_ENTRIES) : data;
    write(trimmed);
    return entry;
  } catch (e) {
    console.error('historique logEntry error:', e.message);
    return null;
  }
};


// Exporte pour usage par authController
router.logEntry = logEntry;

// GET — liste (admin principal recommandé côté front)
router.get('/', (req, res) => {
  try {
    const data = read().slice().reverse(); // plus récent en premier
    res.json(data);
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

// POST — log une visite (anonyme ou auth) + page consultée
router.post('/visit', (req, res) => {
  try {
    const entry = logEntry(req, {
      type: req.body?.type || (req.body?.userId ? 'login_success' : 'visit'),
      userId: req.body?.userId,
      userEmail: req.body?.userEmail,
      userName: req.body?.userName,
      userRole: req.body?.userRole,
      message: req.body?.message || 'Visite du site',
      page: req.body?.page || '',
      referrer: req.body?.referrer || '',
      sessionId: req.body?.sessionId || '',
    });
    res.json({ success: true, entry });
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});


// DELETE — réinitialise tout
router.delete('/', (_req, res) => {
  try {
    write([]);
    res.json({ success: true, message: 'Historique réinitialisé' });
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;
