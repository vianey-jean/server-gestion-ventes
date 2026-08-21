/**
 * =============================================================================
 * threatShield.js — Bouclier adaptatif anti-intrusion (moteur heuristique)
 * =============================================================================
 *
 * Couche ADDITIVE : n'altère aucune logique métier existante.
 * Elle s'insère en amont des routes et décide d'autoriser / ralentir / bannir.
 *
 * Défenses couvertes :
 *  1. Signatures d'attaque    : SQLi, NoSQLi, XSS, path traversal, LFI/RFI,
 *                               RCE (shell), SSTI, désérialisation, CRLF,
 *                               pollution de prototype, injection d'en-têtes.
 *  2. Honeypots               : chemins de scan connus (WordPress, .env,
 *                               phpMyAdmin, .git…) → bannissement immédiat.
 *  3. Moteur comportemental   : apprentissage en ligne (EWMA + z-score) du
 *                               rythme normal des requêtes par empreinte, et
 *                               détection d'anomalie (scan de surface, brute
 *                               force, fuzzing, énumération d'IDs, scraping).
 *  4. Réponse graduée         : score → délai artificiel (tarpit) → 403 →
 *                               bannissement progressif (1 min → 24 h).
 *  5. Mémoire persistante     : /server/security/threat-shield.json
 *                               (hors /db : non affecté par « supprimer tout »).
 *  6. Journal d'incidents     : /server/security/threat-log.json (rotatif).
 *
 * @module middleware/threatShield
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Stockage
// ---------------------------------------------------------------------------
const SECURITY_DIR = path.join(__dirname, '..', 'security');
const STATE_FILE = path.join(SECURITY_DIR, 'threat-shield.json');
const LOG_FILE = path.join(SECURITY_DIR, 'threat-log.json');
const MAX_LOG_ENTRIES = 500;

const ensureDir = () => {
  try {
    if (!fs.existsSync(SECURITY_DIR)) fs.mkdirSync(SECURITY_DIR, { recursive: true });
  } catch (_) { /* silencieux */ }
};

const readJson = (file, fallback) => {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw || 'null');
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (_) {
    return fallback;
  }
};

const writeJsonSafe = (file, data) => {
  try {
    ensureDir();
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } catch (_) { /* silencieux */ }
};

// ---------------------------------------------------------------------------
// État en mémoire (persisté périodiquement)
// ---------------------------------------------------------------------------
/**
 * profiles: Map<fingerprint, {
 *   score, rate, ratePeak, paths:Set, notFound, authFails, lastSeen,
 *   firstSeen, hits, banUntil, banLevel, ua, ip
 * }>
 */
const profiles = new Map();

const persisted = readJson(STATE_FILE, { bans: {}, updatedAt: null });
const bans = new Map(Object.entries(persisted.bans || {}));

const BAN_LADDER = [60_000, 5 * 60_000, 30 * 60_000, 6 * 3600_000, 24 * 3600_000];

const IS_DEV = process.env.NODE_ENV !== 'production';

// ---------------------------------------------------------------------------
// Signatures d'attaque
// ---------------------------------------------------------------------------
const ATTACK_SIGNATURES = [
  { w: 45, re: /(\bunion\b[\s\S]{0,20}\bselect\b)|(\bselect\b[\s\S]{0,40}\bfrom\b[\s\S]{0,40}\bwhere\b)/i, tag: 'sqli' },
  { w: 45, re: /(\bor\b|\band\b)\s+['"`]?\d+['"`]?\s*=\s*['"`]?\d+/i, tag: 'sqli-tauto' },
  { w: 40, re: /;\s*(drop|truncate|alter|insert|update|delete)\s+(table|from|into)\b/i, tag: 'sqli-ddl' },
  { w: 35, re: /(sleep\s*\(|benchmark\s*\(|pg_sleep\s*\(|waitfor\s+delay)/i, tag: 'sqli-time' },
  { w: 40, re: /\$(where|ne|gt|lt|gte|lte|regex|expr|function)\b/i, tag: 'nosqli' },
  { w: 40, re: /<\s*script|onerror\s*=|onload\s*=|javascript\s*:|srcdoc\s*=|<\s*iframe|<\s*svg[^>]*on/i, tag: 'xss' },
  { w: 45, re: /(\.\.(\/|\\|%2f|%5c)){1,}/i, tag: 'path-traversal' },
  { w: 45, re: /(etc\/passwd|proc\/self\/environ|windows\/win\.ini|boot\.ini)/i, tag: 'lfi' },
  { w: 50, re: /(\|\s*(sh|bash|curl|wget|nc)\b)|(\$\((\s*\w+)+\))|(`[^`]{2,}`)|(;\s*(cat|ls|id|whoami|uname)\b)/i, tag: 'rce' },
  { w: 45, re: /(\{\{.*\}\})|(\$\{.*\})|(<%=.*%>)/, tag: 'ssti' },
  { w: 50, re: /(__proto__|constructor\s*\[\s*['"]prototype|prototype\s*\[)/i, tag: 'proto-pollution' },
  { w: 40, re: /(%0d%0a|\r\n)(set-cookie|location|content-length)\s*:/i, tag: 'crlf' },
  { w: 35, re: /(_\$\$ND_FUNC\$\$_|rO0AB|__import__|pickle\.loads)/i, tag: 'deserialization' },
  { w: 30, re: /(\bxp_cmdshell\b|\bLOAD_FILE\b|\binto\s+outfile\b)/i, tag: 'sqli-file' },
  { w: 30, re: /<!ENTITY|SYSTEM\s+["']file:\/\//i, tag: 'xxe' },
];

const HONEYPOT_PATHS = [
  '/wp-login.php', '/wp-admin', '/xmlrpc.php', '/wp-content', '/wordpress',
  '/.env', '/.env.local', '/.git', '/.git/config', '/.svn', '/.aws/credentials',
  '/phpmyadmin', '/pma', '/adminer.php', '/admin.php', '/administrator',
  '/config.php', '/shell.php', '/cgi-bin', '/vendor/phpunit', '/actuator/env',
  '/server-status', '/.ssh/id_rsa', '/backup.sql', '/db.sql', '/composer.json',
  '/.DS_Store', '/etc/passwd', '/solr/admin', '/manager/html', '/struts',
];

const SCANNER_UA = /(sqlmap|nikto|nmap|masscan|acunetix|nessus|dirbuster|gobuster|feroxbuster|wpscan|hydra|zgrab|zmap|nuclei|havij|metasploit|arachni|whatweb|xsser|commix|joomscan)/i;
const HEADLESS_UA = /(headlesschrome|phantomjs|puppeteer|playwright|selenium|scrapy|python-requests|go-http-client|libwww-perl|curl\/|wget\/|httpclient|okhttp)/i;

// Chemins de l'application exemptés du moteur comportemental (flux longs)
const STREAM_PATHS = ['/api/sync/events', '/api/messagerie/events'];

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------
const clientIp = (req) => {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
};

const fingerprintOf = (req) => {
  const ip = clientIp(req);
  const ua = String(req.headers['user-agent'] || '');
  const lang = String(req.headers['accept-language'] || '');
  const hash = crypto.createHash('sha256').update(`${ip}|${ua}|${lang}`).digest('hex').slice(0, 24);
  return { id: hash, ip, ua };
};

const isLoopback = (ip) =>
  ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'unknown';

const safeStringify = (value) => {
  try {
    const s = JSON.stringify(value);
    return typeof s === 'string' ? s.slice(0, 20_000) : '';
  } catch (_) {
    return '';
  }
};

const getProfile = (id, ip, ua) => {
  let p = profiles.get(id);
  if (!p) {
    p = {
      id, ip, ua,
      score: 0,
      hits: 0,
      ewmaRate: 0,       // requêtes / seconde lissées (apprentissage en ligne)
      ewmaVar: 0,
      paths: new Set(),
      notFound: 0,
      authFails: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      banLevel: 0,
    };
    profiles.set(id, p);
  }
  p.ip = ip;
  p.ua = ua;
  return p;
};

const incidents = [];
const logIncident = (entry) => {
  incidents.push({ ...entry, at: new Date().toISOString() });
  if (incidents.length > 50) flushLog();
};

const flushLog = () => {
  if (!incidents.length) return;
  const current = readJson(LOG_FILE, []);
  const merged = (Array.isArray(current) ? current : []).concat(incidents.splice(0));
  writeJsonSafe(LOG_FILE, merged.slice(-MAX_LOG_ENTRIES));
};

const persistState = () => {
  const now = Date.now();
  for (const [k, until] of bans.entries()) if (until < now) bans.delete(k);
  writeJsonSafe(STATE_FILE, { bans: Object.fromEntries(bans), updatedAt: new Date().toISOString() });
};

const applyBan = (profile, reason, tags) => {
  const level = Math.min(profile.banLevel, BAN_LADDER.length - 1);
  const duration = BAN_LADDER[level];
  profile.banLevel = Math.min(profile.banLevel + 1, BAN_LADDER.length - 1);
  const until = Date.now() + duration;
  bans.set(profile.id, until);
  bans.set(`ip:${profile.ip}`, until);
  logIncident({ type: 'ban', reason, tags, ip: profile.ip, ua: profile.ua, durationMs: duration, score: profile.score });
  persistState();
  return until;
};

const bannedUntil = (profile) => {
  const now = Date.now();
  const a = Number(bans.get(profile.id) || 0);
  const b = Number(bans.get(`ip:${profile.ip}`) || 0);
  const until = Math.max(a, b);
  if (until > now) return until;
  if (until) { bans.delete(profile.id); bans.delete(`ip:${profile.ip}`); }
  return 0;
};

// Décroissance périodique : le moteur « pardonne » un trafic redevenu normal
setInterval(() => {
  const now = Date.now();
  for (const [id, p] of profiles.entries()) {
    p.score = Math.max(0, p.score - 12);
    if (p.paths.size > 400) p.paths = new Set();
    if (now - p.lastSeen > 30 * 60_000) profiles.delete(id);
  }
  flushLog();
  persistState();
}, 60_000).unref?.();

// ---------------------------------------------------------------------------
// Analyse d'une requête → score + tags
// ---------------------------------------------------------------------------
const analyze = (req, profile) => {
  const tags = [];
  let score = 0;

  const url = String(req.originalUrl || req.url || '');
  const lowerPath = url.split('?')[0].toLowerCase();
  const ua = profile.ua;
  const haystack = `${url} ${safeStringify(req.body)} ${safeStringify(req.query)} ${safeStringify(req.params)}`;

  // 1) Honeypots
  if (HONEYPOT_PATHS.some((h) => lowerPath === h || lowerPath.startsWith(`${h}/`) || lowerPath.includes(h))) {
    tags.push('honeypot');
    score += 100;
  }

  // 2) Signatures
  for (const sig of ATTACK_SIGNATURES) {
    if (sig.re.test(haystack)) { tags.push(sig.tag); score += sig.w; }
  }

  // 3) Outils offensifs / clients automatisés
  if (SCANNER_UA.test(ua)) { tags.push('scanner-ua'); score += 100; }
  else if (!ua) { tags.push('no-ua'); score += 12; }
  else if (HEADLESS_UA.test(ua) && lowerPath.startsWith('/api/')) { tags.push('automated-client'); score += 6; }

  // 4) En-têtes anormaux (tentative de spoof / smuggling)
  if (req.headers['x-forwarded-host'] && !IS_DEV) { tags.push('host-spoof'); score += 10; }
  if (req.headers['transfer-encoding'] && req.headers['content-length']) { tags.push('request-smuggling'); score += 60; }
  const cl = Number(req.headers['content-length'] || 0);
  if (cl > 12 * 1024 * 1024) { tags.push('oversized-body'); score += 25; }

  // 5) Extensions de fichiers serveur inexistantes ici (site 100 % JS)
  if (/\.(php|asp|aspx|jsp|cgi|pl|sh|env|sql|bak|old|swp)$/i.test(lowerPath)) {
    tags.push('probe-extension'); score += 45;
  }

  // 6) Moteur comportemental (apprentissage en ligne)
  const now = Date.now();
  const dt = Math.max(1, now - profile.lastSeen) / 1000;
  const instRate = 1 / dt;
  const alpha = 0.2;
  const prev = profile.ewmaRate;
  profile.ewmaRate = prev === 0 ? instRate : prev + alpha * (instRate - prev);
  profile.ewmaVar = profile.ewmaVar + alpha * (Math.pow(instRate - profile.ewmaRate, 2) - profile.ewmaVar);
  const sigma = Math.sqrt(Math.max(profile.ewmaVar, 0.0001));
  const z = (instRate - profile.ewmaRate) / sigma;

  profile.hits += 1;
  profile.paths.add(lowerPath);

  // Rafale anormale par rapport au comportement appris de CE client
  if (profile.hits > 30 && z > 6 && profile.ewmaRate > 8) { tags.push('burst-anomaly'); score += 18; }

  // Scan de surface : beaucoup de chemins distincts en peu de temps
  const windowMin = Math.max(1, (now - profile.firstSeen) / 60_000);
  const pathsPerMin = profile.paths.size / windowMin;
  if (profile.paths.size > 60 && pathsPerMin > 40) { tags.push('surface-scan'); score += 35; }

  // Énumération : nombreux 404 déjà observés
  if (profile.notFound > 25) { tags.push('enumeration'); score += 30; }

  // Brute force d'authentification
  if (profile.authFails >= 8) { tags.push('bruteforce'); score += 40; }

  profile.lastSeen = now;
  return { score, tags };
};

// ---------------------------------------------------------------------------
// Middleware principal
// ---------------------------------------------------------------------------
const threatShield = (options = {}) => {
  const tarpitMs = options.tarpitMs ?? 700;

  return (req, res, next) => {
    if (req.method === 'OPTIONS') return next();

    const { id, ip, ua } = fingerprintOf(req);
    const profile = getProfile(id, ip, ua);
    const isStream = STREAM_PATHS.includes(req.path);

    // Développement local : on observe sans jamais bloquer
    const observeOnly = IS_DEV && isLoopback(ip);

    // Bannissement actif
    const until = bannedUntil(profile);
    if (until && !observeOnly) {
      const retryAfter = Math.ceil((until - Date.now()) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(403).json({
        error: 'Accès bloqué',
        message: 'Comportement à risque détecté. Accès temporairement suspendu.',
        retryAfter,
      });
    }

    const { score, tags } = analyze(req, profile);
    profile.score += score;

    // Compteurs de sortie (404 / échecs d'auth) pour l'apprentissage
    res.on('finish', () => {
      if (res.statusCode === 404) profile.notFound += 1;
      if (res.statusCode === 401 || res.statusCode === 403) {
        if (req.path.includes('/auth/')) profile.authFails += 1;
      }
      if (res.statusCode >= 200 && res.statusCode < 400 && req.path.includes('/auth/login')) {
        profile.authFails = 0;
      }
    });

    res.setHeader('X-Shield', 'active');

    if (tags.length) {
      logIncident({ type: 'signal', tags, ip, ua, path: req.path, method: req.method, score: profile.score });
    }

    if (observeOnly) return next();

    // Réponse graduée
    if (profile.score >= 100 || tags.includes('honeypot') || tags.includes('scanner-ua')) {
      applyBan(profile, 'seuil critique atteint', tags);
      return res.status(403).json({ error: 'Accès bloqué', message: 'Tentative d’intrusion détectée.' });
    }

    if (profile.score >= 60) {
      return res.status(400).json({ error: 'Requête rejetée', message: 'Contenu de requête non autorisé.' });
    }

    if (profile.score >= 35 && !isStream) {
      // Tarpit : ralentit fuzzers et brute force sans gêner l'usage normal
      return setTimeout(next, tarpitMs);
    }

    return next();
  };
};

// Signalement manuel depuis les routes métier (ex. mot de passe invalide)
const reportSuspiciousAuth = (req) => {
  try {
    const { id, ip, ua } = fingerprintOf(req);
    const p = getProfile(id, ip, ua);
    p.authFails += 1;
    p.score += 10;
    if (p.authFails >= 12) applyBan(p, 'brute force authentification', ['bruteforce']);
  } catch (_) { /* silencieux */ }
};

const getShieldStats = () => ({
  profiles: profiles.size,
  bans: Array.from(bans.entries())
    .filter(([k]) => !k.startsWith('ip:'))
    .map(([k, until]) => ({ fingerprint: k, until: new Date(Number(until)).toISOString() })),
  recentIncidents: readJson(LOG_FILE, []).slice(-50),
});

process.on('exit', () => { flushLog(); persistState(); });

module.exports = { threatShield, reportSuspiciousAuth, getShieldStats };
