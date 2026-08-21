/**
 * keyVault — Coffre-fort local pour la clé de cryptage des données.
 *
 * Objectif : la VRAIE clé de cryptage ne doit JAMAIS apparaître en clair dans
 * `server/db/encryption.json`. Elle est scellée (AES-256-GCM) avec une clé
 * maître aléatoire de 512 bits stockée hors du dossier `db/`
 * (`server/security/master.key`, chmod 600, jamais sauvegardée ni exposée
 * par l'API).
 *
 * encryption.json ne contient donc que :
 *   { enabled, keySealed: { iv, tag, data }, keyHint, keyFingerprint, ... }
 *
 * @module security/keyVault
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECURITY_DIR = __dirname;
const MASTER_FILE = path.join(SECURITY_DIR, 'master.key');
const ALGO = 'aes-256-gcm';

let cachedMaster = null;

function ensureDir() {
  try {
    if (!fs.existsSync(SECURITY_DIR)) fs.mkdirSync(SECURITY_DIR, { recursive: true });
  } catch (_) { /* silencieux */ }
}

/** Clé maître (env MASTER_ENCRYPTION_KEY prioritaire, sinon fichier local) */
function getMasterKey() {
  if (cachedMaster) return cachedMaster;

  const fromEnv = process.env.MASTER_ENCRYPTION_KEY;
  if (fromEnv && fromEnv.length >= 16) {
    cachedMaster = crypto.createHash('sha256').update(fromEnv).digest();
    return cachedMaster;
  }

  ensureDir();
  try {
    if (fs.existsSync(MASTER_FILE)) {
      const raw = fs.readFileSync(MASTER_FILE, 'utf8').trim();
      if (raw.length >= 32) {
        cachedMaster = crypto.createHash('sha256').update(raw).digest();
        return cachedMaster;
      }
    }
  } catch (_) { /* régénération ci-dessous */ }

  const generated = crypto.randomBytes(64).toString('hex');
  try {
    fs.writeFileSync(MASTER_FILE, generated, { mode: 0o600 });
    try { fs.chmodSync(MASTER_FILE, 0o600); } catch (_) { /* windows */ }
  } catch (e) {
    console.error('keyVault: impossible d\'écrire la clé maître:', e.message);
  }
  cachedMaster = crypto.createHash('sha256').update(generated).digest();
  return cachedMaster;
}

/** Scelle une clé en clair → objet stockable sans révéler la valeur */
function sealKey(plainKey) {
  if (!plainKey) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getMasterKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plainKey), 'utf8'), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: enc.toString('hex'),
  };
}

/** Ouvre une clé scellée → clé en clair (mémoire uniquement) */
function openKey(sealed) {
  try {
    if (!sealed || !sealed.iv || !sealed.data || !sealed.tag) return null;
    const decipher = crypto.createDecipheriv(ALGO, getMasterKey(), Buffer.from(sealed.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(sealed.tag, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(sealed.data, 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch (e) {
    console.error('keyVault: déscellement impossible:', e.message);
    return null;
  }
}

/** Empreinte non réversible de la clé (contrôle d'intégrité côté admin) */
function fingerprint(plainKey) {
  if (!plainKey) return null;
  return crypto.createHash('sha256').update(`fp|${plainKey}`).digest('hex').slice(0, 16);
}

/** Indice masqué : premier caractère + longueur (jamais la clé) */
function hint(plainKey) {
  if (!plainKey) return null;
  const s = String(plainKey);
  return `${s.slice(0, 1)}${'•'.repeat(Math.max(3, Math.min(s.length - 1, 10)))}`;
}

module.exports = { sealKey, openKey, fingerprint, hint, getMasterKey };
