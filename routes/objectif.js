const express = require('express');
const router = express.Router();
const Objectif = require('../models/Objectif');
const Sale = require('../models/Sale');
const authMiddleware = require('../middleware/auth');

// Get objectif data
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Recalculate from sales to ensure accuracy - but preserve custom objectif
    const sales = Sale.getAll();
    const data = Objectif.recalculateFromSales(sales);
    res.json(data);
  } catch (error) {
    console.error('Error getting objectif:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get historique data
router.get('/historique', authMiddleware, async (req, res) => {
  try {
    // First recalculate to ensure current month is up to date
    const sales = Sale.getAll();
    Objectif.recalculateFromSales(sales);
    
    const data = Objectif.getHistorique();
    res.json(data);
  } catch (error) {
    console.error('Error getting historique:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update objectif value - only current month allowed, only increase allowed
router.put('/objectif', authMiddleware, async (req, res) => {
  try {
    const { objectif, month, year } = req.body;
    
    if (objectif === undefined || objectif === null) {
      return res.status(400).json({ message: 'Objectif value is required' });
    }
    
    const data = Objectif.updateObjectif(objectif, month, year);
    res.json(data);
  } catch (error) {
    console.error('Error updating objectif:', error);
    if (error.message === 'Cannot modify objectif for past months') {
      return res.status(403).json({ message: 'Les objectifs des mois passés sont verrouillés' });
    }
    if (error.message === 'OBJECTIF_MUST_INCREASE') {
      return res.status(400).json({ 
        message: 'OBJECTIF_MUST_INCREASE',
        description: 'Le nouvel objectif doit être strictement supérieur à l\'objectif actuel'
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Recalculate total from sales
router.post('/recalculate', authMiddleware, async (req, res) => {
  try {
    const sales = Sale.getAll();
    const data = Objectif.recalculateFromSales(sales);
    res.json(data);
  } catch (error) {
    console.error('Error recalculating:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save monthly data
router.post('/save-monthly', authMiddleware, async (req, res) => {
  try {
    const sales = Sale.getAll();
    const data = Objectif.saveMonthlyData(sales);
    res.json(data);
  } catch (error) {
    console.error('Error saving monthly:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
