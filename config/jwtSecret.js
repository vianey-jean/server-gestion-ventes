/**
 * =============================================================================
 * jwtSecret.js — Secret JWT fort, généré et persisté automatiquement
 * =============================================================================
 *
 * Remplace l'ancien secret de repli codé en dur ('defaultsecretkey'), qui
 * permettait à quiconque connaissant le code de forger un token valide.
 *
 * Ordre de résolution :
 *   1. process.env.JWT_SECRET (recommandé en production)
 *   2. server/security/jwt.json  (secret aléatoire 512 bits persisté)
 *   3. génération d'un nouveau secret aléatoire + persistance
 *
 * Le dossier `server/security/` est volontairement hors de `server/db/` :
 * il n'est donc pas affecté par la fonction « supprimer toutes les données ».
 *
 * @module config/jwtSecret
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECURITY_DIR = path.join(__dirname, '..', 'security');
const SECRET_FILE = path.join(SECURITY_DIR, 'jwt.json');

let cached = null;

// Valeurs historiques trop faibles : ignorées au profit d'un secret aléatoire
const WEAK = new Set(['defaultsecretkey', 'gestion_vente_secret_key', 'secret', 'changeme']);

const generate = () => crypto.randomBytes(64).toString('hex');

/**
 * Retourne le secret de signature JWT (mise en cache après le premier appel).
 * @returns {string} secret d'au moins 128 caractères hexadécimaux
 */
const getJwtSecret = () => {
  if (cached) return cached;

  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 24 && !WEAK.has(fromEnv)) {
    cached = fromEnv;
    return cached;
  }

  // Lecture du secret persisté
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf8') || 'null');
      if (parsed && typeof parsed.secret === 'string' && parsed.secret.length >= 64) {
        cached = parsed.secret;
        return cached;
      }
    }
  } catch (_) { /* on régénère ci-dessous */ }

  // Génération + persistance
  const secret = generate();
  try {
    if (!fs.existsSync(SECURITY_DIR)) fs.mkdirSync(SECURITY_DIR, { recursive: true });
    fs.writeFileSync(
      SECRET_FILE,
      JSON.stringify({ secret, createdAt: new Date().toISOString() }, null, 2),
      { encoding: 'utf8', mode: 0o600 }
    );
  } catch (err) {
    console.warn('⚠️ Secret JWT non persisté (mémoire uniquement):', err.message);
  }

  cached = secret;
  return cached;
};

module.exports = { getJwtSecret };
