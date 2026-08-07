/**
 * =============================================================================
 * Model — ConnecteProfilUnique (db/connecte-profil-unique.json)
 * =============================================================================
 *
 * Couche MODEL (MVC) : accès unique au fichier connecte-profil-unique.json.
 * Aucune logique HTTP ici, uniquement la persistance et les helpers de données.
 *
 * Structure d'une entrée (1 entrée = 1 profil + 1 empreinte navigateur/IP) :
 * {
 *   id, userId, email, nom, role, ip, browser, os, device, userAgent,
 *   timezone, deviceKey, active, currentSessionId,
 *   firstSeenAt, lastSeenAt,
 *   historique: [{ sessionId, dateConnexion, heureConnexion, connecteAt,
 *                  dateDeconnexion, heureDeconnexion, deconnecteAt, motif }],
 *   logoutRequest: { requestId, status, mode, requestedAt, expiresAt,
 *                    fromIp, fromBrowser, respondedAt } | null,
 *   notifications: [{ id, type, message, details, createdAt, delivered }]
 * }
 *
 * @module models/ConnecteProfilUnique
 */

const path = require('path');
const { readJsonDecrypted, writeJsonEncrypted } = require('../middleware/encryption');

const FILE = path.join(__dirname, '../db/connecte-profil-unique.json');

/** Délai (ms) avant révocation automatique d'une demande manuelle sans réponse */
const MANUAL_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
/** Une session est considérée morte si aucun poll depuis ce délai */
const SESSION_STALE_MS = 60 * 1000;
const MAX_ENTRIES = 3000;

const ROLE_PRINCIPAL = 'administrateur principale';

const readAll = () => {
  try {
    const data = readJsonDecrypted(FILE);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const writeAll = (data) => {
  try {
    const safe = Array.isArray(data) ? data : [];
    writeJsonEncrypted(FILE, safe.length > MAX_ENTRIES ? safe.slice(-MAX_ENTRIES) : safe);
    return true;
  } catch (e) {
    console.error('connecte-profil-unique write error:', e.message);
    return false;
  }
};

/** Un administrateur principal peut se connecter à plusieurs endroits */
const isPrincipal = (role = '') =>
  String(role).trim().toLowerCase().includes('administrateur principale') ||
  String(role).trim().toLowerCase() === 'admin principal';

const newId = (prefix = 'cpu') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const parseUA = (ua = '') => {
  let browser = 'Inconnu';
  let os = 'Inconnu';
  let device = 'Desktop';
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

/** Empreinte "endroit" = IP + navigateur + OS + type d'appareil (+ clé client) */
const buildContext = (req, body = {}) => {
  const userAgent = req.headers['user-agent'] || '';
  const { browser, os, device } = parseUA(userAgent);
  const ip = getClientIp(req);
  const clientKey = body.clientKey ? String(body.clientKey) : '';
  return {
    ip,
    browser: body.browser || browser,
    os: body.os || os,
    device: body.device || device,
    userAgent,
    timezone: body.timezone || '',
    clientKey,
    deviceKey: `${ip}|${body.browser || browser}|${body.os || os}|${body.device || device}|${clientKey}`,
  };
};

const nowParts = () => {
  const d = new Date();
  return {
    iso: d.toISOString(),
    date: d.toISOString().slice(0, 10),
    heure: d.toTimeString().slice(0, 8),
  };
};

/** Une entrée est-elle réellement encore connectée ? */
const isEntryActive = (entry) => {
  if (!entry || !entry.active) return false;
  const last = entry.lastSeenAt ? new Date(entry.lastSeenAt).getTime() : 0;
  // Une session sans heartbeat depuis SESSION_STALE_MS est considérée fermée
  return Date.now() - last < SESSION_STALE_MS;
};

const findEntry = (data, userId, deviceKey) =>
  data.find((e) => String(e.userId) === String(userId) && e.deviceKey === deviceKey);

const closeSession = (entry, motif = 'déconnexion') => {
  if (!entry) return;
  const { iso, date, heure } = nowParts();
  const session = (entry.historique || []).find((s) => s.sessionId === entry.currentSessionId && !s.deconnecteAt);
  if (session) {
    session.dateDeconnexion = date;
    session.heureDeconnexion = heure;
    session.deconnecteAt = iso;
    session.motif = motif;
  }
  entry.active = false;
  entry.currentSessionId = null;
  entry.forceLogout = false;
  entry.lastSeenAt = iso;
};

module.exports = {
  FILE,
  ROLE_PRINCIPAL,
  MANUAL_REQUEST_TIMEOUT_MS,
  SESSION_STALE_MS,
  readAll,
  writeAll,
  isPrincipal,
  newId,
  parseUA,
  getClientIp,
  buildContext,
  nowParts,
  isEntryActive,
  findEntry,
  closeSession,
};
