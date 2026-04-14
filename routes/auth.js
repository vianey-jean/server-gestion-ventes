/**
 * auth.js - Routes d'authentification
 * 
 * Gestion de la connexion, inscription et réinitialisation de mot de passe.
 * Inclut : rate limiting, blocage après N tentatives échouées, et gestion JWT.
 */
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { rateLimitMiddleware, validateRequest } = require('../middleware/security');
const validationSchemas = require('../middleware/validation');

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
router.post('/register', validateRequest(validationSchemas.register), (req, res) => {
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
    
    // Vérification de la force du mot de passe
    if (password.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    
    // Check if email is already registered
    const existingUser = User.getByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }
    
    // Create user with hashed password (handled in User.create)
    const userData = {
      email,
      password,
      firstName,
      lastName,
      gender,
      address,
      phone
    };
    
    const newUser = User.create(userData);
    
    if (!newUser) {
      return res.status(500).json({ message: 'Erreur lors de la création du compte' });
    }
    
    // Create and sign JWT token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    // Return user data and token
    res.status(201).json({
      user: newUser,
      token,
      verified: true,
      registeredAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
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

module.exports = router;
