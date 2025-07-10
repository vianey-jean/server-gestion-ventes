
const express = require('express');
const router = express.Router();
const Benefice = require('../models/Benefice');
const authMiddleware = require('../middleware/auth');

// Get all benefit calculations
router.get('/', authMiddleware, async (req, res) => {
  try {
    const benefices = Benefice.getAll();
    res.json(benefices);
  } catch (error) {
    console.error('Error getting all benefit calculations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get benefit calculation by product ID
router.get('/product/:productId', authMiddleware, async (req, res) => {
  try {
    const benefice = Benefice.getByProductId(req.params.productId);
    if (!benefice) {
      return res.status(404).json({ message: 'Benefit calculation not found' });
    }
    res.json(benefice);
  } catch (error) {
    console.error('Error getting benefit calculation by product ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new benefit calculation
router.post('/', authMiddleware, async (req, res) => {
  try {
    console.log('📝 BENEFICE API - Creating new benefit calculation');
    console.log('📝 Data received:', JSON.stringify(req.body, null, 2));
    
    const {
      productId,
      productDescription,
      prixAchat,
      taxeDouane,
      tva,
      autresFrais,
      coutTotal,
      margeDesire,
      prixVenteRecommande,
      beneficeNet,
      tauxMarge
    } = req.body;
    
    // Validation
    if (!productId || !productDescription || prixAchat === undefined) {
      return res.status(400).json({ message: 'ProductId, productDescription and prixAchat are required' });
    }
    
    const beneficeData = {
      productId,
      productDescription,
      prixAchat: Number(prixAchat),
      taxeDouane: Number(taxeDouane || 0),
      tva: Number(tva || 20),
      autresFrais: Number(autresFrais || 0),
      coutTotal: Number(coutTotal),
      margeDesire: Number(margeDesire || 30),
      prixVenteRecommande: Number(prixVenteRecommande),
      beneficeNet: Number(beneficeNet),
      tauxMarge: Number(tauxMarge)
    };
    
    console.log('💾 Benefit calculation data to create:', JSON.stringify(beneficeData, null, 2));
    
    const newBenefice = Benefice.create(beneficeData);
    
    if (!newBenefice) {
      console.log('❌ Error creating benefit calculation');
      return res.status(500).json({ message: 'Error creating benefit calculation' });
    }
    
    console.log('✅ Benefit calculation created successfully:', newBenefice);
    res.status(201).json(newBenefice);
  } catch (error) {
    console.error('❌ Error creating benefit calculation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update benefit calculation
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const beneficeData = {
      productId: req.body.productId,
      productDescription: req.body.productDescription,
      prixAchat: Number(req.body.prixAchat),
      taxeDouane: Number(req.body.taxeDouane || 0),
      tva: Number(req.body.tva || 20),
      autresFrais: Number(req.body.autresFrais || 0),
      coutTotal: Number(req.body.coutTotal),
      margeDesire: Number(req.body.margeDesire || 30),
      prixVenteRecommande: Number(req.body.prixVenteRecommande),
      beneficeNet: Number(req.body.beneficeNet),
      tauxMarge: Number(req.body.tauxMarge)
    };
    
    const updatedBenefice = Benefice.update(req.params.id, beneficeData);
    
    if (!updatedBenefice) {
      return res.status(404).json({ message: 'Benefit calculation not found' });
    }
    
    res.json(updatedBenefice);
  } catch (error) {
    console.error('Error updating benefit calculation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete benefit calculation
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const success = Benefice.delete(req.params.id);
    
    if (!success) {
      return res.status(404).json({ message: 'Benefit calculation not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting benefit calculation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
