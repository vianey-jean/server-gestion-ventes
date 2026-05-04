/**
 * clients.js - Routes API pour la gestion des clients
 * 
 * CRUD complet avec upload de photo, recherche et filtrage.
 */

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

const getClientPhotoFilePath = (photoUrl) => {
  if (!photoUrl) return null;
  return path.join(__dirname, '..', photoUrl.replace(/^\/+/, ''));
};

const deleteClientPhotoFile = (photoUrl) => {
  const filePath = getClientPhotoFilePath(photoUrl);
  if (filePath && fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch {}
  }
};

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
    const removePhoto = req.body.removePhoto === 'true' || req.body.removePhoto === true;
    
    // Parse phones if it's a JSON string (from FormData)
    if (typeof phones === 'string') {
      try { phones = JSON.parse(phones); } catch { phones = [phones]; }
    }
    
    const hasPhone = (phones && Array.isArray(phones) && phones.filter(p => p && p.trim()).length > 0) || (phone && phone.trim());
    if (!nom || !hasPhone || !adresse) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(400).json({ message: 'Tous les champs sont obligatoires' });
    }

    const oldClient = Client.getById(req.params.id);
    if (!oldClient) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(404).json({ message: 'Client not found' });
    }
    
    let photoPath;
    if (req.file) {
      photoPath = `/uploads/clients/${req.file.filename}`;
    } else if (removePhoto) {
      photoPath = '';
    }
    
    const updateData = { 
      nom, 
      phones: phones || (phone ? [phone] : []), 
      adresse 
    };
    if (photoPath !== undefined) updateData.photo = photoPath;
    
    const updatedClient = Client.update(req.params.id, updateData);
    
    if (!updatedClient) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(404).json({ message: 'Client not found' });
    }
    
    if (updatedClient.error) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(400).json({ message: updatedClient.error });
    }

    if ((req.file || removePhoto) && oldClient.photo && oldClient.photo !== updatedClient.photo) {
      deleteClientPhotoFile(oldClient.photo);
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

/**
 * POST /api/clients/merge
 * Fusionne plusieurs clients en un seul.
 * Body (multipart):
 *  - sourceIds: string[] (JSON string) - ids des clients à fusionner (≥2)
 *  - nom, phones (JSON), adresse (requis)
 *  - photo: nouveau fichier (optionnel)
 *  - keepPhotoFromId: id du client dont on conserve la photo (optionnel)
 *
 * Crée un nouveau client avec ces données puis supprime tous les clients sources.
 */
router.post('/merge', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    let { sourceIds, nom, phones, adresse, keepPhotoFromId } = req.body;

    if (typeof sourceIds === 'string') {
      try { sourceIds = JSON.parse(sourceIds); } catch { sourceIds = []; }
    }
    if (typeof phones === 'string') {
      try { phones = JSON.parse(phones); } catch { phones = [phones]; }
    }

    if (!Array.isArray(sourceIds) || sourceIds.length < 2) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(400).json({ message: 'Au moins 2 clients source requis' });
    }

    const validPhones = (phones || []).filter(p => p && p.trim());
    if (!nom || validPhones.length === 0 || !adresse) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(400).json({ message: 'nom, phones et adresse requis' });
    }

    const sourceClients = sourceIds.map(id => Client.getById(id)).filter(Boolean);
    if (sourceClients.length < 2) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(404).json({ message: 'Clients source introuvables' });
    }

    // Détermine la photo à utiliser
    let photoPath = '';
    let preservedPhotoUrl = null;
    if (req.file) {
      photoPath = `/uploads/clients/${req.file.filename}`;
    } else if (keepPhotoFromId) {
      const src = sourceClients.find(c => c.id === keepPhotoFromId);
      if (src && src.photo) {
        photoPath = src.photo;
        preservedPhotoUrl = src.photo;
      }
    }

    // Pour éviter conflit unicité du nom : si le nouveau nom matche un source, renommer temporairement
    const tempRenames = [];
    sourceClients.forEach(c => {
      if (c.nom.toLowerCase() === nom.toLowerCase()) {
        const tempName = `__merging_${c.id}_${Date.now()}`;
        Client.update(c.id, { nom: tempName });
        tempRenames.push({ id: c.id, original: c.nom });
      }
    });

    const newClient = Client.create({
      nom,
      phones: validPhones,
      adresse,
      photo: photoPath,
    });

    if (!newClient || newClient.error) {
      // Restaurer les noms temporaires
      tempRenames.forEach(r => { try { Client.update(r.id, { nom: r.original }); } catch {} });
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(400).json({ message: newClient?.error || 'Erreur création client fusionné' });
    }

    // Supprimer les clients sources (en préservant la photo conservée si applicable)
    sourceIds.forEach(id => {
      const c = Client.getById(id);
      if (!c) return;
      if (preservedPhotoUrl && c.photo === preservedPhotoUrl) {
        // Ne pas effacer le fichier physique
        Client.update(id, { photo: '' });
      }
      Client.delete(id);
    });

    res.status(201).json(newClient);
  } catch (error) {
    console.error('❌ Error merging clients:', error);
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

module.exports = router;
