
const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const authMiddleware = require('../middleware/auth');

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

// Create new client
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { nom, phone, phones, adresse } = req.body;
    
    // Validation des champs obligatoires
    const hasPhone = (phones && Array.isArray(phones) && phones.filter(p => p && p.trim()).length > 0) || (phone && phone.trim());
    if (!nom || !hasPhone || !adresse) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires' });
    }
    
    const newClient = Client.create({ nom, phones: phones || (phone ? [phone] : []), adresse });
    
    if (!newClient) {
      return res.status(500).json({ message: 'Error creating client' });
    }
    
    if (newClient.error) {
      return res.status(400).json({ message: newClient.error });
    }
    
    res.status(201).json(newClient);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update client
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { nom, phone, phones, adresse } = req.body;
    
    const hasPhone = (phones && Array.isArray(phones) && phones.filter(p => p && p.trim()).length > 0) || (phone && phone.trim());
    if (!nom || !hasPhone || !adresse) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires' });
    }
    
    const updatedClient = Client.update(req.params.id, { nom, phones: phones || (phone ? [phone] : []), adresse });
    
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
