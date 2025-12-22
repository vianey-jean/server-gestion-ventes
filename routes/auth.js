const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { rateLimitMiddleware, validateRequest } = require('../middleware/security');
const validationSchemas = require('../middleware/validation');

// Rate limiting strict pour auth
router.use(rateLimitMiddleware('auth'));

// Login route avec validation
router.post('/login', validateRequest(validationSchemas.login), (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists
    const user = User.getByEmail(email);
    if (!user) {
      // Message générique pour éviter l'énumération des utilisateurs
      return res.status(401).json({ message: 'Identifiants invalides' });
    }
    
    // Check password with bcrypt compare
    if (!User.comparePassword(password, user.password)) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }
    
    // Create and sign JWT token avec expiration courte
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'defaultsecretkey',
      { expiresIn: '8h' } // Réduit à 8h pour plus de sécurité
    );
    
    // Return user data and token without password
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
      token
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
      res.json({ 
        exists: true, 
        user: { 
          firstName: user.firstName, 
          lastName: user.lastName 
        }
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
      token
    });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
  }
});

// Reset password request route
router.post('/reset-password-request', (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const user = User.getByEmail(email);
    
    if (!user) {
      return res.status(400).json({ message: 'Email not found' });
    }
    
    // In a real app, send an email with a reset link
    // Here we just return success
    res.json({ success: true });
  } catch (error) {
    console.error('Reset password request error:', error);
    res.status(500).json({ message: 'Internal server error during password reset request' });
  }
});

// Reset password route
router.post('/reset-password', (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;
    
    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    
    // Check if user exists
    const user = User.getByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }
    
    // Update password (hashing is handled in User.updatePassword)
    const success = User.updatePassword(email, newPassword);
    
    if (!success) {
      return res.status(400).json({ message: 'New password must be different from old password' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Internal server error during password reset' });
  }
});

module.exports = router;
