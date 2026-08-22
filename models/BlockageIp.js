/**
 * =============================================================================
 * Modèle BlockageIp — liste des adresses IP bloquées
 * =============================================================================
 *
 * Stockage : server/db/blockage-ip.json
 * Structure : { ips: [ { id, ip, reason, createdAt, createdBy } ] }
 *
 * @module models/BlockageIp
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'db', 'blockage-ip.json');

const DEFAULT_DATA = { ips: [] };

const read = () => {
  try {
    if (!fs.existsSync(FILE)) {
      fs.writeFileSync(FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
      return { ips: [] };
    }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8') || 'null') || {};
    return { ips: Array.isArray(raw.ips) ? raw.ips : [] };
  } catch (_) {
    return { ips: [] };
  }
};

const write = (data) => {
  try {
    fs.writeFileSync(FILE, JSON.stringify({ ips: data.ips || [] }, null, 2), 'utf8');
    return true;
  } catch (_) {
    return false;
  }
};

/** Normalise une IP (retire le préfixe IPv4-mapped, espaces, casse). */
const normalizeIp = (ip) => {
  if (!ip) return '';
  let v = String(ip).trim().toLowerCase();
  if (v.startsWith('::ffff:')) v = v.slice(7);
  return v;
};

/** Un blocage est actif par défaut (compat. anciennes entrées sans champ `active`). */
const isActive = (entry) => entry?.active !== false;

const getAll = () => read().ips.map((e) => ({ ...e, active: isActive(e) }));

const isBlocked = (ip) => {
  const target = normalizeIp(ip);
  if (!target) return false;
  return read().ips.some((e) => normalizeIp(e.ip) === target && isActive(e));
};

/** Retourne l'entrée correspondante (active ou non). */
const find = (ip) => {
  const target = normalizeIp(ip);
  const entry = read().ips.find((e) => normalizeIp(e.ip) === target);
  return entry ? { ...entry, active: isActive(entry) } : null;
};

/** Retourne l'entrée uniquement si le blocage est actif. */
const findActive = (ip) => {
  const entry = find(ip);
  return entry && entry.active ? entry : null;
};

/** Modifie l'adresse IP et/ou le motif d'une entrée existante. */
const update = (id, { ip, reason } = {}) => {
  const data = read();
  const idx = data.ips.findIndex((e) => e.id === id);
  if (idx === -1) return { error: 'Adresse IP introuvable' };

  if (ip !== undefined) {
    const target = normalizeIp(ip);
    if (!target) return { error: 'Adresse IP invalide' };
    if (data.ips.some((e, i) => i !== idx && normalizeIp(e.ip) === target)) {
      return { error: 'Cette adresse IP est déjà bloquée' };
    }
    data.ips[idx].ip = target;
  }
  if (reason !== undefined) {
    data.ips[idx].reason = reason ? String(reason).slice(0, 300) : null;
  }
  data.ips[idx].updatedAt = new Date().toISOString();
  write(data);
  return { entry: { ...data.ips[idx], active: isActive(data.ips[idx]) } };
};

/** Active / désactive un blocage sans le supprimer. */
const setActive = (id, active) => {
  const data = read();
  const idx = data.ips.findIndex((e) => e.id === id);
  if (idx === -1) return { error: 'Adresse IP introuvable' };
  data.ips[idx].active = !!active;
  data.ips[idx].updatedAt = new Date().toISOString();
  write(data);
  return { entry: { ...data.ips[idx], active: !!active } };
};

const add = ({ ip, reason, createdBy }) => {
  const target = normalizeIp(ip);
  if (!target) return { error: 'Adresse IP invalide' };
  const data = read();
  if (data.ips.some((e) => normalizeIp(e.ip) === target)) {
    return { error: 'Cette adresse IP est déjà bloquée' };
  }
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ip: target,
    reason: reason ? String(reason).slice(0, 300) : null,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || null,
  };
  data.ips.push(entry);
  write(data);
  return { entry };
};

const remove = (idOrIp) => {
  const data = read();
  const target = normalizeIp(idOrIp);
  const before = data.ips.length;
  data.ips = data.ips.filter((e) => e.id !== idOrIp && normalizeIp(e.ip) !== target);
  if (data.ips.length === before) return false;
  write(data);
  return true;
};

module.exports = {
  getAll, isBlocked, find, findActive, add, update, setActive, remove, normalizeIp,
};
