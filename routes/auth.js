
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Login route
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  // Validate input
  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }
  
  // Check if user exists
  const user = User.getByEmail(email);
  if (!user) {
    return res.status(400).json({ message: 'User does not exist' });
  }
  
  // Check password with bcrypt compare
  if (!User.comparePassword(password, user.password)) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }
  
  // Create and sign JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET || 'defaultsecretkey',
    { expiresIn: '1d' }
  );
  
  // Return user data and token without password
  const { password: _, ...userWithoutPassword } = user;
  res.json({
    user: userWithoutPassword,
    token
  });
});

// Check email route
router.post('/check-email', (req, res) => {
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
});

// Register route
router.post('/register', (req, res) => {
  const { 
    email, password, confirmPassword, firstName, lastName, 
    gender, address, phone, acceptTerms 
  } = req.body;
  
  // Validate input
  if (!email || !password || !firstName || !lastName || !gender || !address || !phone) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }
  
  if (!acceptTerms) {
    return res.status(400).json({ message: 'You must accept the terms' });
  }
  
  // Check if email is already registered
  const existingUser = User.getByEmail(email);
  if (existingUser) {
    return res.status(400).json({ message: 'Email already registered' });
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
    return res.status(500).json({ message: 'Error creating user' });
  }
  
  // Create and sign JWT token
  const token = jwt.sign(
    { id: newUser.id, email: newUser.email },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
  
  // Return user data and token
  res.status(201).json({
    user: newUser,
    token
  });
});

// Reset password request route
router.post('/reset-password-request', (req, res) => {
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
});

// Reset password route
router.post('/reset-password', (req, res) => {
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
});

module.exports = router;
