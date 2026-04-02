
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Client = require('../models/Client');
const authMiddleware = require('../middleware/auth');

// Ensure uploads/clients directory exists
const clientUploadsDir = path.join(__dirname, '../uploads/clients');
if (!fs.existsSync(clientUploadsDir)) {
  fs.mkdirSync(clientUploadsDir, { recursive: true });
}

// Multer config for client photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, clientUploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `client-${Date.now()}-${Math.floor(Math.random() * 1000000)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// Get all clients
router.get('/', authMiddleware, async (req, res) => {
  try {
    const clients = Client.getAll();
    res.json(clients);
  } catch (error) {
    console.error('Error getting all clients:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get client by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const client = Client.getById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    res.json(client);
  } catch (error) {
    console.error('Error getting client by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new client (with optional photo)
router.post('/', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    let { nom, phone, phones, adresse } = req.body;
    
    // Parse phones if it's a JSON string (from FormData)
    if (typeof phones === 'string') {
      try { phones = JSON.parse(phones); } catch { phones = [phones]; }
    }
    
    // Validation des champs obligatoires
    const hasPhone = (phones && Array.isArray(phones) && phones.filter(p => p && p.trim()).length > 0) || (phone && phone.trim());
    if (!nom || !hasPhone || !adresse) {
      // Delete uploaded file if validation fails
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(400).json({ message: 'Tous les champs sont obligatoires' });
    }
    
    const photoPath = req.file ? `/uploads/clients/${req.file.filename}` : '';
    
    const newClient = Client.create({ 
      nom, 
      phones: phones || (phone ? [phone] : []), 
      adresse,
      photo: photoPath
    });
    
    if (!newClient) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(500).json({ message: 'Error creating client' });
    }
    
    if (newClient.error) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(400).json({ message: newClient.error });
    }
    
    res.status(201).json(newClient);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update client (with optional photo)
router.put('/:id', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    let { nom, phone, phones, adresse } = req.body;
    
    // Parse phones if it's a JSON string (from FormData)
    if (typeof phones === 'string') {
      try { phones = JSON.parse(phones); } catch { phones = [phones]; }
    }
    
    const hasPhone = (phones && Array.isArray(phones) && phones.filter(p => p && p.trim()).length > 0) || (phone && phone.trim());
    if (!nom || !hasPhone || !adresse) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(400).json({ message: 'Tous les champs sont obligatoires' });
    }
    
    // If new photo uploaded, delete old one
    let photoPath;
    if (req.file) {
      photoPath = `/uploads/clients/${req.file.filename}`;
      // Delete old photo
      const oldClient = Client.getById(req.params.id);
      if (oldClient && oldClient.photo) {
        const oldPhotoPath = path.join(__dirname, '..', oldClient.photo);
        if (fs.existsSync(oldPhotoPath)) {
          try { fs.unlinkSync(oldPhotoPath); } catch {}
        }
      }
    }
    
    const updateData = { 
      nom, 
      phones: phones || (phone ? [phone] : []), 
      adresse 
    };
    if (photoPath !== undefined) updateData.photo = photoPath;
    
    const updatedClient = Client.update(req.params.id, updateData);
    
    if (!updatedClient) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    if (updatedClient.error) {
      return res.status(400).json({ message: updatedClient.error });
    }
    
    res.json(updatedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete client
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const success = Client.delete(req.params.id);
    
    if (!success) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
