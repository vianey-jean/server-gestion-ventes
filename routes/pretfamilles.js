
const express = require('express');
const router = express.Router();
const PretFamille = require('../models/PretFamille');
const auth = require('../middleware/auth');

// Route pour obtenir tous les prêts familles
router.get('/', auth, (req, res) => {
  try {
    const pretFamilles = PretFamille.getAllPretFamilles();
    res.json(pretFamilles);
  } catch (error) {
    console.error('Erreur lors de la récupération des prêts familles:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour obtenir un prêt famille par ID
router.get('/:id', auth, (req, res) => {
  try {
    const pretFamille = PretFamille.getPretFamilleById(req.params.id);
    
    if (!pretFamille) {
      return res.status(404).json({ message: 'Prêt famille non trouvé' });
    }
    
    res.json(pretFamille);
  } catch (error) {
    console.error('Erreur lors de la récupération du prêt famille:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour créer un nouveau prêt famille
router.post('/', auth, (req, res) => {
  try {
    if (!req.body.nom) {
      return res.status(400).json({ message: 'Le nom est requis' });
    }
    
    const newPretFamille = PretFamille.createPretFamille(req.body);
    res.status(201).json(newPretFamille);
  } catch (error) {
    console.error('Erreur lors de la création du prêt famille:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour mettre à jour un prêt famille
router.put('/:id', auth, (req, res) => {
  try {
    const updatedPretFamille = PretFamille.updatePretFamille(req.params.id, req.body);
    res.json(updatedPretFamille);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du prêt famille:', error);
    
    if (error.message === 'Prêt famille non trouvé') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour supprimer un prêt famille
router.delete('/:id', auth, (req, res) => {
  try {
    const success = PretFamille.deletePretFamille(req.params.id);
    
    if (!success) {
      return res.status(404).json({ message: 'Prêt famille non trouvé' });
    }
    
    res.json({ message: 'Prêt famille supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du prêt famille:', error);
    
    if (error.message === 'Prêt famille non trouvé') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour rechercher des prêts familles par nom
router.get('/search/nom', auth, (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query || query.length < 3) {
      return res.status(400).json({ message: 'Le terme de recherche doit contenir au moins 3 caractères' });
    }
    
    const results = PretFamille.searchPretFamillesByName(query);
    res.json(results);
  } catch (error) {
    console.error('Erreur lors de la recherche de prêts familles:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
