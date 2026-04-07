/**
 * =============================================================================
 * Contrôleur Clients - Logique métier CRUD des clients
 * =============================================================================
 * 
 * Gère : liste, création, mise à jour, suppression des clients avec photos.
 * 
 * @module controllers/clientController
 */

const Client = require('../models/Client');
const fs = require('fs');

/**
 * Supprime un fichier photo du disque
 */
const deleteClientPhotoFile = (photoUrl) => {
  if (!photoUrl) return;
  const path = require('path');
  const filePath = path.join(__dirname, '..', photoUrl.replace(/^\/+/, ''));
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch {}
  }
};

/** Récupère tous les clients */
exports.getAll = async (req, res) => {
  try {
    res.json(Client.getAll());
  } catch (error) {
    console.error('Error getting all clients:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Récupère un client par ID */
exports.getById = async (req, res) => {
  try {
    const client = Client.getById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    console.error('Error getting client by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Crée un nouveau client (avec photo optionnelle) */
exports.create = async (req, res) => {
  try {
    let { nom, phone, phones, adresse } = req.body;
    if (typeof phones === 'string') {
      try { phones = JSON.parse(phones); } catch { phones = [phones]; }
    }

    const hasPhone = (phones && Array.isArray(phones) && phones.filter(p => p && p.trim()).length > 0) || (phone && phone.trim());
    if (!nom || !hasPhone || !adresse) {
      if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ message: 'Tous les champs sont obligatoires' });
    }

    const photoPath = req.file ? `/uploads/clients/${req.file.filename}` : '';
    const newClient = Client.create({ nom, phones: phones || (phone ? [phone] : []), adresse, photo: photoPath });

    if (!newClient || newClient.error) {
      if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(newClient?.error ? 400 : 500).json({ message: newClient?.error || 'Error creating client' });
    }

    res.status(201).json(newClient);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Met à jour un client (avec photo optionnelle) */
exports.update = async (req, res) => {
  try {
    let { nom, phone, phones, adresse } = req.body;
    const removePhoto = req.body.removePhoto === 'true' || req.body.removePhoto === true;

    if (typeof phones === 'string') {
      try { phones = JSON.parse(phones); } catch { phones = [phones]; }
    }

    const hasPhone = (phones && Array.isArray(phones) && phones.filter(p => p && p.trim()).length > 0) || (phone && phone.trim());
    if (!nom || !hasPhone || !adresse) {
      if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ message: 'Tous les champs sont obligatoires' });
    }

    const oldClient = Client.getById(req.params.id);
    if (!oldClient) {
      if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(404).json({ message: 'Client not found' });
    }

    let photoPath;
    if (req.file) photoPath = `/uploads/clients/${req.file.filename}`;
    else if (removePhoto) photoPath = '';

    const updateData = { nom, phones: phones || (phone ? [phone] : []), adresse };
    if (photoPath !== undefined) updateData.photo = photoPath;

    const updatedClient = Client.update(req.params.id, updateData);
    if (!updatedClient || updatedClient.error) {
      if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(updatedClient?.error ? 400 : 404).json({ message: updatedClient?.error || 'Client not found' });
    }

    if ((req.file || removePhoto) && oldClient.photo && oldClient.photo !== updatedClient.photo) {
      deleteClientPhotoFile(oldClient.photo);
    }

    res.json(updatedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Supprime un client */
exports.delete = async (req, res) => {
  try {
    const success = Client.delete(req.params.id);
    if (!success) return res.status(404).json({ message: 'Client not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
