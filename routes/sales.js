
const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const authMiddleware = require('../middleware/auth');

// Get all sales
router.get('/', authMiddleware, async (req, res) => {
  try {
    const sales = Sale.getAll();
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get sales by month and year
router.get('/by-month', authMiddleware, async (req, res) => {
  try {
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }
    
    const sales = Sale.getByMonthYear(Number(month), Number(year));
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new sale
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      date, productId, description, sellingPrice, 
      quantitySold, purchasePrice 
    } = req.body;
    
    if (!date || !productId || !description || !sellingPrice || !quantitySold || !purchasePrice) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if product exists
    const product = Product.getById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if enough quantity is available
    if (product.quantity < quantitySold) {
      return res.status(400).json({ message: 'Not enough quantity available' });
    }
    
    // Calculate profit
    const profit = (Number(sellingPrice) - Number(purchasePrice)) * Number(quantitySold);
    
    const saleData = {
      date,
      productId,
      description,
      sellingPrice: Number(sellingPrice),
      quantitySold: Number(quantitySold),
      purchasePrice: Number(purchasePrice),
      profit
    };
    
    const newSale = Sale.create(saleData);
    
    if (!newSale) {
      return res.status(500).json({ message: 'Error creating sale' });
    }
    
    if (newSale.error) {
      return res.status(400).json({ message: newSale.error });
    }
    
    res.status(201).json(newSale);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update sale
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { 
      date, productId, description, sellingPrice, 
      quantitySold, purchasePrice 
    } = req.body;
    
    if (!date || !productId || !description || !sellingPrice || !quantitySold || !purchasePrice) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Calculate profit
    const profit = (Number(sellingPrice) - Number(purchasePrice)) * Number(quantitySold);
    
    const saleData = {
      date,
      productId,
      description,
      sellingPrice: Number(sellingPrice),
      quantitySold: Number(quantitySold),
      purchasePrice: Number(purchasePrice),
      profit
    };
    
    const updatedSale = Sale.update(req.params.id, saleData);
    
    if (!updatedSale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    if (updatedSale.error) {
      return res.status(400).json({ message: updatedSale.error });
    }
    
    res.json(updatedSale);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete sale
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const success = Sale.delete(req.params.id);
    
    if (!success) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Export sales (clear month)
router.post('/export-month', authMiddleware, async (req, res) => {
  try {
    const { month, year } = req.body;
    
    if (month === undefined || year === undefined) {
      return res.status(400).json({ message: 'Month and year are required' });
    }
    
    // Get sales for the month (for PDF generation in a real app)
    const sales = Sale.getByMonthYear(Number(month), Number(year));
    
    // In a real app, this would generate a PDF file
    // For now, we'll just clear the sales for the month
    const success = Sale.clearByMonthYear(Number(month), Number(year));
    
    if (!success) {
      return res.status(500).json({ message: 'Error exporting sales' });
    }
    
    res.json({ success: true, salesCount: sales.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
