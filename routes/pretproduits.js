
const express = require('express');
const router = express.Router();
const PretProduit = require('../models/PretProduit');
const auth = require('../middleware/auth');

// Route pour obtenir tous les prêts produits
router.get('/', auth, (req, res) => {
  try {
    const pretProduits = PretProduit.getAllPretProduits();
    res.json(pretProduits);
  } catch (error) {
    console.error('Erreur lors de la récupération des prêts produits:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour obtenir un prêt produit par ID
router.get('/:id', auth, (req, res) => {
  try {
    const pretProduit = PretProduit.getPretProduitById(req.params.id);
    
    if (!pretProduit) {
      return res.status(404).json({ message: 'Prêt produit non trouvé' });
    }
    
    res.json(pretProduit);
  } catch (error) {
    console.error('Erreur lors de la récupération du prêt produit:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour créer un nouveau prêt produit
router.post('/', auth, (req, res) => {
  try {
    if (!req.body.description || !req.body.prixVente) {
      return res.status(400).json({ message: 'La description et le prix de vente sont requis' });
    }
    
    const newPretProduit = PretProduit.createPretProduit(req.body);
    res.status(201).json(newPretProduit);
  } catch (error) {
    console.error('Erreur lors de la création du prêt produit:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour mettre à jour un prêt produit
router.put('/:id', auth, (req, res) => {
  try {
    const updatedPretProduit = PretProduit.updatePretProduit(req.params.id, req.body);
    res.json(updatedPretProduit);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du prêt produit:', error);
    
    if (error.message === 'Prêt produit non trouvé') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour supprimer un prêt produit
router.delete('/:id', auth, (req, res) => {
  try {
    const success = PretProduit.deletePretProduit(req.params.id);
    
    if (!success) {
      return res.status(404).json({ message: 'Prêt produit non trouvé' });
    }
    
    res.json({ message: 'Prêt produit supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du prêt produit:', error);
    
    if (error.message === 'Prêt produit non trouvé') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
