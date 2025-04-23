
const express = require('express');
const router = express.Router();
const DepenseDuMois = require('../models/DepenseDuMois');
const auth = require('../middleware/auth');

// Route pour obtenir tous les mouvements
router.get('/mouvements', auth, (req, res) => {
  try {
    const mouvements = DepenseDuMois.getAllMouvements();
    res.json(mouvements);
  } catch (error) {
    console.error('Erreur lors de la récupération des mouvements:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour obtenir un mouvement par ID
router.get('/mouvements/:id', auth, (req, res) => {
  try {
    const mouvement = DepenseDuMois.getMouvementById(req.params.id);
    
    if (!mouvement) {
      return res.status(404).json({ message: 'Mouvement non trouvé' });
    }
    
    res.json(mouvement);
  } catch (error) {
    console.error('Erreur lors de la récupération du mouvement:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour créer un nouveau mouvement
router.post('/mouvements', auth, (req, res) => {
  try {
    if (!req.body.description || !req.body.categorie || (!req.body.debit && !req.body.credit)) {
      return res.status(400).json({ message: 'La description, la catégorie et au moins un montant (débit ou crédit) sont requis' });
    }
    
    const newMouvement = DepenseDuMois.createMouvement(req.body);
    res.status(201).json(newMouvement);
  } catch (error) {
    console.error('Erreur lors de la création du mouvement:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour mettre à jour un mouvement
router.put('/mouvements/:id', auth, (req, res) => {
  try {
    const updatedMouvement = DepenseDuMois.updateMouvement(req.params.id, req.body);
    res.json(updatedMouvement);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du mouvement:', error);
    
    if (error.message === 'Mouvement non trouvé') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour supprimer un mouvement
router.delete('/mouvements/:id', auth, (req, res) => {
  try {
    const success = DepenseDuMois.deleteMouvement(req.params.id);
    
    if (!success) {
      return res.status(404).json({ message: 'Mouvement non trouvé' });
    }
    
    res.json({ message: 'Mouvement supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du mouvement:', error);
    
    if (error.message === 'Mouvement non trouvé') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour obtenir les dépenses fixes
router.get('/fixe', auth, (req, res) => {
  try {
    const depensesFixe = DepenseDuMois.getDepensesFixe();
    res.json(depensesFixe);
  } catch (error) {
    console.error('Erreur lors de la récupération des dépenses fixes:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour mettre à jour les dépenses fixes
router.put('/fixe', auth, (req, res) => {
  try {
    const updatedDepensesFixe = DepenseDuMois.updateDepensesFixe(req.body);
    res.json(updatedDepensesFixe);
  } catch (error) {
    console.error('Erreur lors de la mise à jour des dépenses fixes:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour réinitialiser les dépenses du mois (vidage de la table)
router.post('/reset', auth, (req, res) => {
  try {
    const result = DepenseDuMois.resetAllMouvements();
    if (result) {
      res.json({ message: 'Toutes les dépenses du mois ont été réinitialisées avec succès' });
    } else {
      res.status(500).json({ message: 'Erreur lors de la réinitialisation des dépenses' });
    }
  } catch (error) {
    console.error('Erreur lors de la réinitialisation des dépenses:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour vérifier si c'est la fin du mois et réinitialiser si nécessaire
router.get('/check-month-end', auth, (req, res) => {
  try {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    // Vérifie si c'est le dernier jour du mois
    if (today.getDate() === lastDayOfMonth) {
      DepenseDuMois.resetAllMouvements();
      res.json({ 
        reset: true, 
        message: 'Fin du mois détectée, les dépenses ont été réinitialisées' 
      });
    } else {
      res.json({ 
        reset: false, 
        message: 'Ce n\'est pas la fin du mois, aucune réinitialisation effectuée' 
      });
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de fin de mois:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
