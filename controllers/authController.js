/**
 * =============================================================================
 * Contrôleur Authentification - Logique métier de connexion/inscription
 * =============================================================================
 * 
 * Gère : login, register, vérification token, reset password, check email.
 * Les routes délèguent ici toute la logique métier.
 * 
 * @module controllers/authController
 */

const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * Vérifie un token JWT et l'existence de l'utilisateur
 */
exports.verifyToken = (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ valid: false, message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecretkey');
    const user = User.getById(decoded.id);

    if (!user) return res.status(401).json({ valid: false, message: 'User account not found in database' });
    if (!user.email || !user.firstName || !user.lastName) {
      return res.status(401).json({ valid: false, message: 'User profile incomplete in database' });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({ valid: true, user: userWithoutPassword, verified: true, verifiedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(401).json({ valid: false, message: 'Invalid or expired token' });
  }
};

/**
 * Health check rapide
 */
exports.healthCheck = (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), serverTime: new Date().toISOString() });
};

/**
 * Connexion utilisateur avec protection brute-force
 */
exports.login = (req, res) => {
  try {
    const { email, password } = req.body;
    const user = User.getByEmail(email);

    if (!user) return res.status(401).json({ message: 'Identifiants invalides' });
    if (!user.id || !user.email || !user.firstName || !user.lastName) {
      return res.status(401).json({ message: 'Profil utilisateur incomplet dans la base de données' });
    }

    // Vérification du verrouillage du compte
    const maxAttempts = user.nombreConnexion || 5;
    const lockoutMinutes = user.tempsBlocage || 15;
    const failedAttempts = user.failedAttempts || 0;
    const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil) : null;

    if (lockedUntil && new Date() < lockedUntil) {
      const remainingMs = lockedUntil.getTime() - Date.now();
      return res.status(423).json({
        message: 'Compte temporairement bloqué', locked: true,
        lockedUntil: lockedUntil.toISOString(), remainingSeconds: Math.ceil(remainingMs / 1000),
        maxAttempts, failedAttempts: maxAttempts
      });
    }

    if (lockedUntil && new Date() >= lockedUntil) {
      User.update(user.id, { failedAttempts: 0, lockedUntil: null });
    }

    // Vérification du mot de passe
    if (!User.comparePassword(password, user.password)) {
      const newFailedAttempts = (lockedUntil && new Date() >= lockedUntil ? 0 : failedAttempts) + 1;
      const updateData = { failedAttempts: newFailedAttempts };

      if (newFailedAttempts >= maxAttempts) {
        const lockUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
        updateData.lockedUntil = lockUntil.toISOString();
        User.update(user.id, updateData);
        return res.status(423).json({
          message: `Compte bloqué pendant ${lockoutMinutes} minutes`,
          locked: true, lockedUntil: lockUntil.toISOString(),
          remainingSeconds: lockoutMinutes * 60, maxAttempts, failedAttempts: newFailedAttempts
        });
      }

      User.update(user.id, updateData);
      return res.status(401).json({
        message: 'Identifiants invalides', failedAttempts: newFailedAttempts,
        maxAttempts, remainingAttempts: maxAttempts - newFailedAttempts
      });
    }

    // Succès - réinitialiser les tentatives
    User.update(user.id, { failedAttempts: 0, lockedUntil: null });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'defaultsecretkey',
      { expiresIn: '8h' }
    );

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token, verified: true, loginTime: new Date().toISOString() });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
};

/**
 * Vérifie si un email existe et retourne l'état du verrouillage
 */
exports.checkEmail = (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = User.getByEmail(email);
    if (user) {
      const maxAttempts = user.nombreConnexion || 5;
      const failedAttempts = user.failedAttempts || 0;
      const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil) : null;
      let locked = false, remainingSeconds = 0, currentFailedAttempts = failedAttempts;

      if (lockedUntil && new Date() < lockedUntil) {
        locked = true;
        remainingSeconds = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
        currentFailedAttempts = maxAttempts;
      } else if (lockedUntil && new Date() >= lockedUntil) {
        User.update(user.id, { failedAttempts: 0, lockedUntil: null });
        currentFailedAttempts = 0;
      }

      res.json({
        exists: true, user: { firstName: user.firstName, lastName: user.lastName },
        maxAttempts, failedAttempts: currentFailedAttempts, locked,
        lockedUntil: locked ? lockedUntil.toISOString() : null, remainingSeconds
      });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ message: 'Internal server error during email check' });
  }
};

/**
 * Inscription d'un nouvel utilisateur
 */
exports.register = (req, res) => {
  try {
    const { email, password, confirmPassword, firstName, lastName, gender, address, phone, acceptTerms } = req.body;

    if (password !== confirmPassword) return res.status(400).json({ message: 'Les mots de passe ne correspondent pas' });
    if (!acceptTerms) return res.status(400).json({ message: 'Vous devez accepter les conditions' });
    if (password.length < 6) return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });

    const existingUser = User.getByEmail(email);
    if (existingUser) return res.status(400).json({ message: 'Cet email est déjà utilisé' });

    const newUser = User.create({ email, password, firstName, lastName, gender, address, phone });
    if (!newUser) return res.status(500).json({ message: 'Erreur lors de la création du compte' });

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(201).json({ user: newUser, token, verified: true, registeredAt: new Date().toISOString() });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
  }
};

/**
 * Demande de réinitialisation de mot de passe
 */
exports.resetPasswordRequest = (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ exists: false, message: 'Email is required' });

    const user = User.getByEmail(email);
    if (!user) return res.status(200).json({ exists: false, message: 'Email not found' });

    res.json({ exists: true, success: true, message: 'Email verified, proceed with password reset' });
  } catch (error) {
    console.error('Reset password request error:', error);
    res.status(500).json({ exists: false, message: 'Internal server error' });
  }
};

/**
 * Réinitialisation du mot de passe
 */
exports.resetPassword = (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;
    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas' });
    }

    const hasLower = /[a-z]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNum = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    if (!hasLower || !hasUpper || !hasNum || !hasSpecial || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 6 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial' });
    }

    const user = User.getByEmail(email);
    if (!user) return res.status(400).json({ success: false, message: 'Utilisateur non trouvé' });

    const success = User.updatePassword(email, newPassword);
    if (!success) return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit être différent de l\'ancien' });

    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la réinitialisation du mot de passe' });
  }
};
