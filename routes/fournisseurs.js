/**
 * Routes API pour les fournisseurs
 * 
 * GET  /api/fournisseurs          → Liste complète
 * GET  /api/fournisseurs/search?q= → Recherche par nom
 * POST /api/fournisseurs          → Créer (si n'existe pas)
 * DELETE /api/fournisseurs/:id    → Supprimer
 */

const express = require('express');
const router = express.Router();
const Fournisseur = require('../models/Fournisseur');
const authMiddleware = require('../middleware/auth');

// Récupérer tous les fournisseurs
router.get('/', authMiddleware, async (req, res) => {
  try {
    const fournisseurs = Fournisseur.getAll();
    res.json(fournisseurs);
  } catch (error) {
    console.error('Error getting fournisseurs:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Rechercher des fournisseurs
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    const results = Fournisseur.search(q || '');
    res.json(results);
  } catch (error) {
    console.error('Error searching fournisseurs:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Créer un fournisseur (si n'existe pas)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { nom } = req.body;
    if (!nom || nom.trim() === '') {
      return res.status(400).json({ message: 'Le nom est requis' });
    }
    const fournisseur = Fournisseur.createIfNotExists(nom);
    res.status(201).json(fournisseur);
  } catch (error) {
    console.error('Error creating fournisseur:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Supprimer un fournisseur
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const success = Fournisseur.delete(req.params.id);
    if (!success) return res.status(404).json({ message: 'Fournisseur non trouvé' });
    res.json({ message: 'Fournisseur supprimé' });
  } catch (error) {
    console.error('Error deleting fournisseur:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;