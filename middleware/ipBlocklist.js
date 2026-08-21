/**
 * =============================================================================
 * Middleware global de blocage d'IP
 * =============================================================================
 *
 * Refuse (403) toute requête provenant d'une IP listée dans
 * server/db/blockage-ip.json, sauf l'endpoint public de vérification
 * (/api/blockage-ip/check) et les pré-vols CORS (OPTIONS).
 *
 * @module middleware/ipBlocklist
 */

const BlockageIp = require('../models/BlockageIp');

const getClientIp = (req) => {
  const xf = req.headers['x-forwarded-for'];
  let ip;
  if (typeof xf === 'string' && xf.length) ip = xf.split(',')[0].trim();
  else ip = req.ip || req.connection?.remoteAddress || '';
  return BlockageIp.normalizeIp(ip);
};

// Chemins toujours accessibles (sinon le front ne peut pas savoir pourquoi
// il est bloqué)
const ALLOWED_PATHS = ['/api/blockage-ip/check'];

const ipBlocklistMiddleware = (req, res, next) => {
  try {
    if (req.method === 'OPTIONS') return next();
    if (ALLOWED_PATHS.includes(req.path)) return next();

    const ip = getClientIp(req);
    if (!ip) return next();

    const entry = BlockageIp.find(ip);
    if (!entry) return next();

    return res.status(403).json({
      error: 'IP bloquée',
      blocked: true,
      ip,
      reason: entry.reason || null,
      message: 'Vous ne pouvez pas entrer dans ce site.',
    });
  } catch (_) {
    return next();
  }
};

module.exports = { ipBlocklistMiddleware, getClientIp };
