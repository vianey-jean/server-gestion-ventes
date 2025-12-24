const express = require('express');
const router = express.Router();
const Objectif = require('../models/Objectif');
const Sale = require('../models/Sale');
const authMiddleware = require('../middleware/auth');

// Get objectif data
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Recalculate from sales to ensure accuracy
    const sales = Sale.getAll();
    const data = Objectif.recalculateFromSales(sales);
    res.json(data);
  } catch (error) {
    console.error('Error getting objectif:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update objectif value
router.put('/objectif', authMiddleware, async (req, res) => {
  try {
    const { objectif } = req.body;
    
    if (objectif === undefined || objectif === null) {
      return res.status(400).json({ message: 'Objectif value is required' });
    }
    
    const data = Objectif.updateObjectif(objectif);
    res.json(data);
  } catch (error) {
    console.error('Error updating objectif:', error);
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

module.exports = router;
