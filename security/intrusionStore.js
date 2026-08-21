/**
 * intrusionStore — Base de données des intrusions détectées.
 *
 * Toutes les tentatives d'intrusion (signatures, honeypots, scanners,
 * anomalies comportementales, bannissements, blocages) sont enregistrées
 * dans `server/db/intrusions.json`, donc :
 *   - chiffrées automatiquement si le cryptage est activé (dbHelper),
 *   - incluses dans les sauvegardes / injections de données.
 *
 * Écritures tamponnées (flush toutes les 5 s ou tous les 20 évènements)
 * pour ne pas pénaliser le débit HTTP.
 *
 * @module security/intrusionStore
 */

const crypto = require('crypto');
const { readDb, writeDb } = require('../middleware/dbHelper');

const FILE = 'intrusions.json';
const MAX_ENTRIES = 3000;

let buffer = [];
let flushTimer = null;

const newId = () => `intr_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

/** Lecture brute (toujours un tableau) */
function readAll() {
  const data = readDb(FILE);
  return Array.isArray(data) ? data : [];
}

/** Vide le tampon vers la base */
function flush() {
  if (!buffer.length) return;
  const pending = buffer.splice(0);
  try {
    const all = readAll().concat(pending);
    writeDb(FILE, all.slice(-MAX_ENTRIES));
  } catch (e) {
    console.error('intrusionStore flush error:', e.message);
  }
}

function scheduleFlush() {
  if (buffer.length >= 20) return flush();
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 5000);
  flushTimer.unref?.();
}

/** Ajoute un évènement d'intrusion */
function record(entry) {
  try {
    buffer.push({
      id: newId(),
      at: new Date().toISOString(),
      ts: Date.now(),
      ...entry,
    });
    scheduleFlush();
  } catch (e) {
    console.error('intrusionStore record error:', e.message);
  }
}

/** Liste filtrée + statistiques agrégées */
function query({ limit = 200, severity, mode, ip, since } = {}) {
  flush();
  let items = readAll();

  if (severity) items = items.filter((i) => i.severity === severity);
  if (mode) items = items.filter((i) => Array.isArray(i.tags) && i.tags.includes(mode));
  if (ip) items = items.filter((i) => i.ip === ip);
  if (since) {
    const t = new Date(since).getTime();
    if (!Number.isNaN(t)) items = items.filter((i) => (i.ts || Date.parse(i.at) || 0) >= t);
  }

  const total = items.length;
  return { total, items: items.slice(-limit).reverse() };
}

/** Statistiques globales pour le tableau de bord */
function stats() {
  flush();
  const items = readAll();
  const byMode = {};
  const byIp = {};
  const bySeverity = { critique: 0, eleve: 0, moyen: 0, faible: 0 };
  const byPath = {};
  const byCountryUa = {};
  const dayMs = 86_400_000;
  const now = Date.now();
  let last24h = 0;
  let blocked = 0;

  items.forEach((i) => {
    (i.tags || []).forEach((t) => { byMode[t] = (byMode[t] || 0) + 1; });
    if (i.ip) byIp[i.ip] = (byIp[i.ip] || 0) + 1;
    if (i.severity && bySeverity[i.severity] !== undefined) bySeverity[i.severity] += 1;
    if (i.path) byPath[i.path] = (byPath[i.path] || 0) + 1;
    if (i.browser) byCountryUa[i.browser] = (byCountryUa[i.browser] || 0) + 1;
    const t = i.ts || Date.parse(i.at) || 0;
    if (now - t <= dayMs) last24h += 1;
    if (i.action && i.action !== 'observe' && i.action !== 'log') blocked += 1;
  });

  const top = (obj, n = 10) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));

  return {
    total: items.length,
    last24h,
    blocked,
    bySeverity,
    topModes: top(byMode),
    topIps: top(byIp),
    topPaths: top(byPath),
    topBrowsers: top(byCountryUa, 6),
    firstAt: items[0]?.at || null,
    lastAt: items[items.length - 1]?.at || null,
  };
}

/** Purge totale */
function reset() {
  buffer = [];
  writeDb(FILE, []);
  return true;
}

process.on('exit', flush);

module.exports = { record, query, stats, reset, readAll, flush };
