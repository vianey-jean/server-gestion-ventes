const express = require('express');
const router = express.Router();
const NouvelleAchat = require('../models/NouvelleAchat');
const Fournisseur = require('../models/Fournisseur');
const authMiddleware = require('../middleware/auth');

// Récupérer tous les achats
router.get('/', authMiddleware, async (req, res) => {
  try {
    const achats = NouvelleAchat.getAll();
    res.json(achats);
  } catch (error) {
    console.error('Error getting achats:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer les achats par mois et année
router.get('/monthly/:year/:month', authMiddleware, async (req, res) => {
  try {
    const { year, month } = req.params;
    const achats = NouvelleAchat.getByMonthYear(parseInt(month), parseInt(year));
    res.json(achats);
  } catch (error) {
    console.error('Error getting monthly achats:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer les achats par année
router.get('/yearly/:year', authMiddleware, async (req, res) => {
  try {
    const { year } = req.params;
    const achats = NouvelleAchat.getByYear(parseInt(year));
    res.json(achats);
  } catch (error) {
    console.error('Error getting yearly achats:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer les statistiques mensuelles
router.get('/stats/monthly/:year/:month', authMiddleware, async (req, res) => {
  try {
    const { year, month } = req.params;
    const stats = NouvelleAchat.getMonthlyStats(parseInt(month), parseInt(year));
    res.json(stats);
  } catch (error) {
    console.error('Error getting monthly stats:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer les statistiques annuelles
router.get('/stats/yearly/:year', authMiddleware, async (req, res) => {
  try {
    const { year } = req.params;
    const stats = NouvelleAchat.getYearlyStats(parseInt(year));
    res.json(stats);
  } catch (error) {
    console.error('Error getting yearly stats:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer un achat par ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const achat = NouvelleAchat.getById(req.params.id);
    
    if (!achat) {
      return res.status(404).json({ message: 'Achat non trouvé' });
    }
    
    res.json(achat);
  } catch (error) {
    console.error('Error getting achat by ID:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Créer un nouvel achat
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { productId, productDescription, purchasePrice, quantity, fournisseur, caracteristiques } = req.body;
    
    if (!productDescription || purchasePrice === undefined || quantity === undefined) {
      return res.status(400).json({ message: 'Description, prix et quantité sont requis' });
    }
    
    const achatData = {
      productId,
      productDescription,
      purchasePrice: Number(purchasePrice),
      quantity: Number(quantity),
      fournisseur: fournisseur || '',
      caracteristiques: caracteristiques || '',
      date: req.body.date || new Date().toISOString()
    };
    
    const newAchat = NouvelleAchat.create(achatData);
    
    if (!newAchat) {
      return res.status(500).json({ message: 'Erreur lors de la création de l\'achat' });
    }

    // Auto-enregistrer le fournisseur s'il est renseigné
    if (achatData.fournisseur && achatData.fournisseur.trim() !== '') {
      Fournisseur.createIfNotExists(achatData.fournisseur);
    }
    
    console.log('✅ Achat created successfully:', newAchat);
    res.status(201).json(newAchat);
  } catch (error) {
    console.error('❌ Error creating achat:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Ajouter une dépense (taxes, carburant, autres)
router.post('/depense', authMiddleware, async (req, res) => {
  try {
    const { description, montant, type, categorie } = req.body;
    
    if (!description || montant === undefined) {
      return res.status(400).json({ message: 'Description et montant sont requis' });
    }
    
    const depenseData = {
      description,
      montant: Number(montant),
      type: type || 'autre_depense',
      categorie: categorie || 'divers',
      date: req.body.date || new Date().toISOString()
    };
    
    const newDepense = NouvelleAchat.addDepense(depenseData);
    
    if (!newDepense) {
      return res.status(500).json({ message: 'Erreur lors de l\'ajout de la dépense' });
    }
    
    console.log('✅ Depense added successfully:', newDepense);
    res.status(201).json(newDepense);
  } catch (error) {
    console.error('❌ Error adding depense:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Mettre à jour un achat
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updatedAchat = NouvelleAchat.update(req.params.id, req.body);
    
    if (!updatedAchat) {
      return res.status(404).json({ message: 'Achat non trouvé' });
    }
    
    console.log('✅ Achat updated successfully:', updatedAchat);
    res.json(updatedAchat);
  } catch (error) {
    console.error('❌ Error updating achat:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Supprimer un achat
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const success = NouvelleAchat.delete(req.params.id);
    
    if (!success) {
      return res.status(404).json({ message: 'Achat non trouvé' });
    }
    
    console.log('✅ Achat deleted successfully:', req.params.id);
    res.json({ message: 'Achat supprimé avec succès' });
  } catch (error) {
    console.error('❌ Error deleting achat:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;