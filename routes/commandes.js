/**
 * commandes.js - Routes API pour la gestion des commandes fournisseurs
 * 
 * CRUD complet pour les commandes avec :
 * - Création et suivi des commandes fournisseurs
 * - Gestion des statuts (en attente, livrée, annulée)
 * - Historique des commandes
 * Toutes les routes sont authentifiées.
 */
const express = require('express');
const router = express.Router();
const Commande = require('../models/Commande');
const authMiddleware = require('../middleware/auth');
const { checkIndisponibilite } = require('../services/availabilityService');

// Get all commandes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const commandes = await Commande.getAll();
    res.json(commandes);
  } catch (error) {
    console.error('Error fetching commandes:', error);
    res.status(500).json({ message: 'Error fetching commandes' });
  }
});

// Get single commande
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const commande = await Commande.getById(req.params.id);
    if (!commande) {
      return res.status(404).json({ message: 'Commande not found' });
    }
    res.json(commande);
  } catch (error) {
    console.error('Error fetching commande:', error);
    res.status(500).json({ message: 'Error fetching commande' });
  }
});

// Create commande
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Check indisponibilité if date/horaire provided
    const { date, dateLivraison, horaire } = req.body;
    const checkDate = dateLivraison || date;
    if (checkDate && horaire) {
      const [heureDebut] = horaire.split('-').map(h => h?.trim());
      const indispoCheck = checkIndisponibilite(checkDate, heureDebut || '00:00', '23:59');
      if (!indispoCheck.disponible) {
        return res.status(409).json({ message: `🚫 ${indispoCheck.message}. Impossible de créer une réservation pendant un créneau indisponible.` });
      }
    }

    const newCommande = await Commande.create(req.body);
    res.status(201).json(newCommande);
  } catch (error) {
    console.error('Error creating commande:', error);
    res.status(500).json({ message: 'Error creating commande' });
  }
});

// Update commande
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updated = await Commande.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Error updating commande:', error);
    res.status(500).json({ message: 'Error updating commande' });
  }
});

// Delete commande
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Commande.delete(req.params.id);
    res.json({ message: 'Commande deleted successfully' });
  } catch (error) {
    console.error('Error deleting commande:', error);
    res.status(500).json({ message: 'Error deleting commande' });
  }
});

module.exports = router;
