/**
 * Middleware de sécurité pour le serveur Express
 * Inclut: Rate limiting, validation, sanitization, headers sécurisés
 */

// ===================
// RATE LIMITER
// ===================
class RateLimiter {
  constructor(windowMs = 60000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();
    
    // Nettoyer les entrées expirées toutes les minutes
    setInterval(() => this.cleanup(), 60000);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.requests.entries()) {
      if (now - data.windowStart > this.windowMs) {
        this.requests.delete(key);
      }
    }
  }

  isAllowed(ip) {
    const now = Date.now();
    const data = this.requests.get(ip);

    if (!data || now - data.windowStart > this.windowMs) {
      this.requests.set(ip, { count: 1, windowStart: now });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    if (data.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, retryAfter: Math.ceil((data.windowStart + this.windowMs - now) / 1000) };
    }

    data.count++;
    return { allowed: true, remaining: this.maxRequests - data.count };
  }
}

// Instances de rate limiter
const generalLimiter = new RateLimiter(60000, 500); // 500 req/min (évite les blocages en frontend)
const authLimiter = new RateLimiter(60000, 10); // 10 req/min pour auth
const strictLimiter = new RateLimiter(60000, 5); // 5 req/min pour opérations sensibles

// ===================
// INPUT SANITIZATION
// ===================
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[<>]/g, '') // Supprimer < et >
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/data:/gi, '')
    .trim()
    .slice(0, 10000); // Limite de longueur
};

const sanitizeObject = (obj, maxDepth = 5, currentDepth = 0) => {
  if (currentDepth > maxDepth) return {};
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.slice(0, 1000).map(item => sanitizeObject(item, maxDepth, currentDepth + 1));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    const keys = Object.keys(obj).slice(0, 100); // Limite le nombre de clés
    for (const key of keys) {
      const sanitizedKey = sanitizeString(key).slice(0, 100);
      sanitized[sanitizedKey] = sanitizeObject(obj[key], maxDepth, currentDepth + 1);
    }
    return sanitized;
  }
  
  return obj;
};

// ===================
// VALIDATION
// ===================
const validators = {
  email: (email) => {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email) && email.length <= 255;
  },
  
  phone: (phone) => {
    const regex = /^[0-9+\-\s()]{6,20}$/;
    return regex.test(phone);
  },
  
  password: (password) => {
    return password && password.length >= 6 && password.length <= 128;
  },
  
  id: (id) => {
    const regex = /^[a-zA-Z0-9_-]{1,50}$/;
    return regex.test(id);
  },
  
  text: (text, maxLength = 1000) => {
    return typeof text === 'string' && text.length <= maxLength;
  },
  
  number: (num, min = -Infinity, max = Infinity) => {
    const n = Number(num);
    return !isNaN(n) && n >= min && n <= max;
  },
  
  date: (date) => {
    const d = new Date(date);
    return !isNaN(d.getTime());
  }
};

// ===================
// MIDDLEWARES
// ===================

// Rate limiting middleware
const rateLimitMiddleware = (limiterType = 'general') => {
  const limiters = {
    general: generalLimiter,
    auth: authLimiter,
    strict: strictLimiter
  };
  
  const limiter = limiters[limiterType] || generalLimiter;
  
  return (req, res, next) => {
    // Ne pas rate-limit les préflights CORS
    if (req.method === 'OPTIONS') {
      return next();
    }

    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const result = limiter.isAllowed(ip);

    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
      return res.status(429).json({
        error: 'Trop de requêtes',
        message: `Veuillez réessayer dans ${result.retryAfter} secondes`,
        retryAfter: result.retryAfter
      });
    }

    next();
  };
};

// Sanitization middleware
const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};

// Security headers middleware
const securityHeadersMiddleware = (req, res, next) => {
  // Protection XSS
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy (ajustée pour API)
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'");
  
  // Strict Transport Security
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

// Request validation middleware factory
const validateRequest = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];
      
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} est requis`);
        continue;
      }
      
      if (value !== undefined && value !== null && value !== '') {
        if (rules.type === 'email' && !validators.email(value)) {
          errors.push(`${field} doit être un email valide`);
        }
        if (rules.type === 'phone' && !validators.phone(value)) {
          errors.push(`${field} doit être un numéro de téléphone valide`);
        }
        if (rules.type === 'password' && !validators.password(value)) {
          errors.push(`${field} doit contenir entre 6 et 128 caractères`);
        }
        if (rules.type === 'number' && !validators.number(value, rules.min, rules.max)) {
          errors.push(`${field} doit être un nombre valide`);
        }
        if (rules.type === 'text' && !validators.text(value, rules.maxLength)) {
          errors.push(`${field} dépasse la longueur maximale`);
        }
        if (rules.type === 'date' && !validators.date(value)) {
          errors.push(`${field} doit être une date valide`);
        }
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation échouée', 
        details: errors 
      });
    }
    
    next();
  };
};

// Log des requêtes suspectes
const suspiciousActivityLogger = (req, res, next) => {
  const suspiciousPatterns = [
    /(\.\.)\//, // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JS injection
    /\$where/i, // NoSQL injection
    /\$gt|\$lt|\$ne/i // MongoDB operators
  ];
  
  const checkString = (str) => {
    if (typeof str !== 'string') return false;
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };
  
  const isSuspicious = 
    checkString(req.url) ||
    checkString(JSON.stringify(req.body)) ||
    checkString(JSON.stringify(req.query));
  
  if (isSuspicious) {
    console.warn('⚠️ Activité suspecte détectée:', {
      ip: req.ip,
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// ===================
// EXPORTS
// ===================
module.exports = {
  rateLimitMiddleware,
  sanitizeMiddleware,
  securityHeadersMiddleware,
  validateRequest,
  suspiciousActivityLogger,
  validators,
  sanitizeString,
  sanitizeObject,
  RateLimiter
};
