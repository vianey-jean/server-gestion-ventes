/**
 * auth.js - Routes d'authentification
 * 
 * Gestion de la connexion, inscription et réinitialisation de mot de passe.
 * Inclut : rate limiting, blocage après N tentatives échouées, et gestion JWT.
 */
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { rateLimitMiddleware, validateRequest } = require('../middleware/security');
const validationSchemas = require('../middleware/validation');
const { readJsonDecrypted, writeJsonEncrypted } = require('../middleware/encryption');
const { sendMail, buildHtml } = require('../services/emailService');

// ============================================================
// Helpers pour les tokens de vérification email et reset password
// ============================================================
const PENDING_USERS_PATH = path.join(__dirname, '../db/pendingUsers.json');
const RESET_TOKENS_PATH = path.join(__dirname, '../db/passwordResetTokens.json');

function readList(p) {
  try {
    const data = readJsonDecrypted(p);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function writeList(p, list) {
  try { writeJsonEncrypted(p, list); } catch (e) { console.error('writeList error', e.message); }
}
function purgeExpired(list) {
  const now = Date.now();
  return list.filter(item => !item.expiresAt || item.expiresAt > now);
}
function getAppUrl(req) {
  return process.env.APP_URL || req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/') || 'http://localhost:8080';
}

// Rate limiting strict pour auth
router.use(rateLimitMiddleware('auth'));

// Verify token and user exists in database - FAST verification endpoint
router.get('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ valid: false, message: 'No token provided' });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecretkey');
    
    // CRITICAL: Verify user exists in database
    const user = User.getById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ 
        valid: false, 
        message: 'User account not found in database' 
      });
    }
    
    // Verify user profile is complete
    if (!user.email || !user.firstName || !user.lastName) {
      return res.status(401).json({ 
        valid: false, 
        message: 'User profile incomplete in database' 
      });
    }
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({ 
      valid: true, 
      user: userWithoutPassword,
      verified: true,
      verifiedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(401).json({ valid: false, message: 'Invalid or expired token' });
  }
});

// Fast health check for connection status
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    serverTime: new Date().toISOString()
  });
});

// Login route avec validation
router.post('/login', validateRequest(validationSchemas.login), (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists
    const user = User.getByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }
    
    // CRITICAL: Verify user profile exists and is complete
    if (!user.id || !user.email || !user.firstName || !user.lastName) {
      return res.status(401).json({ 
        message: 'Profil utilisateur incomplet dans la base de données' 
      });
    }

    // Check if account is locked
    const maxAttempts = user.nombreConnexion || 5;
    const lockoutMinutes = user.tempsBlocage || 15;
    const failedAttempts = user.failedAttempts || 0;
    const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil) : null;

    if (lockedUntil && new Date() < lockedUntil) {
      const remainingMs = lockedUntil.getTime() - Date.now();
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      return res.status(423).json({
        message: 'Compte temporairement bloqué',
        locked: true,
        lockedUntil: lockedUntil.toISOString(),
        remainingSeconds,
        maxAttempts,
        failedAttempts: maxAttempts
      });
    }

    // If lock expired, reset attempts
    if (lockedUntil && new Date() >= lockedUntil) {
      User.update(user.id, { failedAttempts: 0, lockedUntil: null });
    }
    
    // Check password with bcrypt compare
    if (!User.comparePassword(password, user.password)) {
      const newFailedAttempts = (lockedUntil && new Date() >= lockedUntil ? 0 : failedAttempts) + 1;
      const updateData = { failedAttempts: newFailedAttempts };

      if (newFailedAttempts >= maxAttempts) {
        const lockUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
        updateData.lockedUntil = lockUntil.toISOString();
        User.update(user.id, updateData);
        try { req.app.locals.logHistorique?.(req, { type: 'login_locked', userId: user.id, userEmail: user.email, userName: `${user.firstName} ${user.lastName}`, userRole: user.role || '', message: `Compte bloqué (${lockoutMinutes} min)` }); } catch {}
        return res.status(423).json({
          message: `Compte bloqué pendant ${lockoutMinutes} minutes`,
          locked: true,
          lockedUntil: lockUntil.toISOString(),
          remainingSeconds: lockoutMinutes * 60,
          maxAttempts,
          failedAttempts: newFailedAttempts
        });
      }

      User.update(user.id, updateData);
      try { req.app.locals.logHistorique?.(req, { type: 'login_failed', userId: user.id, userEmail: user.email, userName: `${user.firstName} ${user.lastName}`, userRole: user.role || '', message: `Mot de passe incorrect (tentative ${newFailedAttempts}/${maxAttempts})` }); } catch {}
      return res.status(401).json({
        message: 'Identifiants invalides',
        failedAttempts: newFailedAttempts,
        maxAttempts,
        remainingAttempts: maxAttempts - newFailedAttempts
      });
    }
    
    // Successful login — reset failed attempts
    User.update(user.id, { failedAttempts: 0, lockedUntil: null });

    // Create and sign JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'defaultsecretkey',
      { expiresIn: '8h' }
    );
    
    const { password: _, ...userWithoutPassword } = user;
    try { req.app.locals.logHistorique?.(req, { type: 'login_success', userId: user.id, userEmail: user.email, userName: `${user.firstName} ${user.lastName}`, userRole: user.role || 'utilisateur', message: 'Connexion réussie' }); } catch {}
    res.json({
      user: userWithoutPassword,
      token,
      verified: true,
      loginTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
});

// Check email route
router.post('/check-email', (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('Check email request:', email);
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const user = User.getByEmail(email);
    
    if (user) {
      // Check lock status
      const maxAttempts = user.nombreConnexion || 5;
      const failedAttempts = user.failedAttempts || 0;
      const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil) : null;
      let locked = false;
      let remainingSeconds = 0;
      let currentFailedAttempts = failedAttempts;

      if (lockedUntil && new Date() < lockedUntil) {
        locked = true;
        remainingSeconds = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
        currentFailedAttempts = maxAttempts;
      } else if (lockedUntil && new Date() >= lockedUntil) {
        // Lock expired, reset
        User.update(user.id, { failedAttempts: 0, lockedUntil: null });
        currentFailedAttempts = 0;
      }

      res.json({ 
        exists: true, 
        user: { 
          firstName: user.firstName, 
          lastName: user.lastName 
        },
        maxAttempts,
        failedAttempts: currentFailedAttempts,
        locked,
        lockedUntil: locked ? lockedUntil.toISOString() : null,
        remainingSeconds
      });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ message: 'Internal server error during email check' });
  }
});

// Register route avec validation stricte
router.post('/register', validateRequest(validationSchemas.register), async (req, res) => {
  try {
    const {
      email, password, confirmPassword, firstName, lastName,
      gender, address, phone, acceptTerms
    } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Les mots de passe ne correspondent pas' });
    }
    if (!acceptTerms) {
      return res.status(400).json({ message: 'Vous devez accepter les conditions' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    // Email déjà activé ?
    const existingUser = User.getByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // On stocke le compte en attente (non actif) avec un token de validation
    let pending = purgeExpired(readList(PENDING_USERS_PATH));
    pending = pending.filter(p => p.email.toLowerCase() !== email.toLowerCase());

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1h

    pending.push({
      token, email, password, firstName, lastName, gender, address, phone,
      createdAt: new Date().toISOString(), expiresAt,
    });
    writeList(PENDING_USERS_PATH, pending);

    const link = `${getAppUrl(req)}/verify-account/${token}`;
    const mailResult = await sendMail({
      to: email,
      subject: 'Confirmez la création de votre compte',
      html: buildHtml({
        title: 'Bienvenue ' + firstName + ' !',
        intro: `Votre compte a bien été créé mais doit être validé. Cliquez sur le bouton ci-dessous pour finaliser votre inscription.`,
        ctaText: 'Valider mon compte',
        ctaUrl: link,
      }),
      text: `Bonjour ${firstName}, validez votre compte en ouvrant ce lien : ${link}`,
    });

    if (!mailResult.sent) {
      console.error('[register] Échec envoi email de validation à', email, '-', mailResult.reason || mailResult.error);
      return res.status(502).json({
        message: "Impossible d'envoyer l'email de validation. Veuillez réessayer plus tard ou contacter le support.",
      });
    }
    return res.status(201).json({
      pending: true,
      email,
      message: 'Votre compte est bien créé. Un email de validation vient de vous être envoyé.',
      emailSent: true,
    });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
  }
});

// Vérifie un token de validation de compte
router.get('/verify-account/:token', (req, res) => {
  const { token } = req.params;
  const pending = purgeExpired(readList(PENDING_USERS_PATH));
  const entry = pending.find(p => p.token === token);
  if (!entry) return res.status(404).json({ valid: false, message: 'Lien invalide ou expiré' });
  res.json({ valid: true, email: entry.email, firstName: entry.firstName, lastName: entry.lastName });
});

// Active le compte (déplace pending → users)
router.post('/activate-account', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token requis' });

    let pending = purgeExpired(readList(PENDING_USERS_PATH));
    const entry = pending.find(p => p.token === token);
    if (!entry) return res.status(404).json({ message: 'Lien invalide ou expiré' });

    // Double vérification email
    if (User.getByEmail(entry.email)) {
      pending = pending.filter(p => p.token !== token);
      writeList(PENDING_USERS_PATH, pending);
      return res.status(400).json({ message: 'Ce compte est déjà activé.' });
    }

    const newUser = User.create({
      email: entry.email, password: entry.password,
      firstName: entry.firstName, lastName: entry.lastName,
      gender: entry.gender, address: entry.address, phone: entry.phone,
    });
    if (!newUser) return res.status(500).json({ message: 'Erreur lors de la création du compte' });

    pending = pending.filter(p => p.token !== token);
    writeList(PENDING_USERS_PATH, pending);

    const jwtToken = jwt.sign(
      { id: newUser.id, email: newUser.email },
      process.env.JWT_SECRET || 'defaultsecretkey',
      { expiresIn: '8h' }
    );
    res.json({ success: true, user: newUser, token: jwtToken, message: 'Compte validé avec succès' });
  } catch (err) {
    console.error('Activate account error:', err.message);
    res.status(500).json({ message: 'Erreur lors de l\'activation du compte' });
  }
});



// Reset password request route - verify email exists
router.post('/reset-password-request', (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ exists: false, message: 'Email is required' });
    }
    
    const user = User.getByEmail(email);
    
    if (!user) {
      return res.status(200).json({ exists: false, message: 'Email not found' });
    }
    
    // Email exists - return success to allow password reset
    res.json({ 
      exists: true, 
      success: true,
      message: 'Email verified, proceed with password reset'
    });
  } catch (error) {
    console.error('Reset password request error:', error);
    res.status(500).json({ exists: false, message: 'Internal server error during password reset request' });
  }
});

// Reset password route - actually change the password
router.post('/reset-password', (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;
    
    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas' });
    }
    
    // Validate password strength
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    const hasMinLength = newPassword.length >= 6;
    
    if (!hasLowerCase || !hasUpperCase || !hasNumber || !hasSpecialChar || !hasMinLength) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le mot de passe doit contenir au moins 6 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial' 
      });
    }
    
    // Check if user exists
    const user = User.getByEmail(email);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    // Update password (hashing is handled in User.updatePassword)
    const success = User.updatePassword(email, newPassword);
    
    if (!success) {
      return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit être différent de l\'ancien' });
    }
    
    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la réinitialisation du mot de passe' });
  }
});

// Envoie un lien de réinitialisation par email (après confirmation utilisateur côté client)
router.post('/reset-password-link', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email requis' });

    const user = User.getByEmail(email);
    if (!user) return res.status(404).json({ success: false, message: 'Cet email n\'existe pas dans notre système' });

    let tokens = purgeExpired(readList(RESET_TOKENS_PATH));
    tokens = tokens.filter(t => t.email.toLowerCase() !== email.toLowerCase());

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000;
    tokens.push({ token, email, createdAt: new Date().toISOString(), expiresAt });
    writeList(RESET_TOKENS_PATH, tokens);

    const link = `${getAppUrl(req)}/reset-password-confirm/${token}`;
    const mailResult = await sendMail({
      to: email,
      subject: 'Réinitialisation de votre mot de passe',
      html: buildHtml({
        title: 'Réinitialisation du mot de passe',
        intro: `Vous avez demandé à changer votre mot de passe. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe. Ce lien est valable 1 heure.`,
        ctaText: 'Modifier mon mot de passe',
        ctaUrl: link,
      }),
      text: `Réinitialisez votre mot de passe via ce lien : ${link}`,
    });

    if (!mailResult.sent) {
      console.error('[reset-password-link] Échec envoi email à', email, '-', mailResult.reason || mailResult.error);
      return res.status(502).json({
        success: false,
        message: "Impossible d'envoyer l'email de réinitialisation. Veuillez réessayer plus tard.",
      });
    }
    res.json({
      success: true,
      message: 'Lien de réinitialisation envoyé à votre email.',
      emailSent: true,
    });
  } catch (err) {
    console.error('reset-password-link error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Vérifie un token de reset password
router.get('/reset-password-token/:token', (req, res) => {
  const tokens = purgeExpired(readList(RESET_TOKENS_PATH));
  const entry = tokens.find(t => t.token === req.params.token);
  if (!entry) return res.status(404).json({ valid: false, message: 'Lien invalide ou expiré' });
  res.json({ valid: true, email: entry.email });
});

// Confirme un nouveau mot de passe via un token
router.post('/reset-password-confirm', (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas' });
    }
    const hasLower = /[a-z]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNum = /[0-9]/.test(newPassword);
    const hasSpe = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    if (!hasLower || !hasUpper || !hasNum || !hasSpe || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 6 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial' });
    }

    let tokens = purgeExpired(readList(RESET_TOKENS_PATH));
    const entry = tokens.find(t => t.token === token);
    if (!entry) return res.status(404).json({ success: false, message: 'Lien invalide ou expiré' });

    const success = User.updatePassword(entry.email, newPassword);
    if (!success) return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit être différent de l\'ancien' });

    tokens = tokens.filter(t => t.token !== token);
    writeList(RESET_TOKENS_PATH, tokens);

    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    console.error('reset-password-confirm error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;

