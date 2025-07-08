
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
    console.error('Error getting all sales:', error);
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
    
    console.log(`Fetching sales for month: ${month}, year: ${year}`);
    
    const monthNum = Number(month);
    const yearNum = Number(year);
    
    const sales = Sale.getByMonthYear(monthNum, yearNum);
    console.log(`Found ${sales.length} sales for ${monthNum}/${yearNum}`);
    
    res.json(sales);
  } catch (error) {
    console.error('Error getting sales by month/year:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new sale
router.post('/', authMiddleware, async (req, res) => {
  try {
    console.log('📝 SALES API - Création d\'une nouvelle vente');
    console.log('📝 Données reçues:', JSON.stringify(req.body, null, 2));
    
    const { 
      date, productId, description, sellingPrice, 
      quantitySold, purchasePrice, profit 
    } = req.body;
    
    // Validation des champs obligatoires
    if (!date) {
      console.log('❌ Date manquante');
      return res.status(400).json({ message: 'Date is required' });
    }
    
    if (!productId) {
      console.log('❌ ProductId manquant');
      return res.status(400).json({ message: 'ProductId is required' });
    }
    
    if (!description) {
      console.log('❌ Description manquante');
      return res.status(400).json({ message: 'Description is required' });
    }
    
    if (sellingPrice === undefined || sellingPrice === null || sellingPrice === '') {
      console.log('❌ SellingPrice manquant ou invalide:', sellingPrice);
      return res.status(400).json({ message: 'SellingPrice is required' });
    }
    
    if (purchasePrice === undefined || purchasePrice === null || purchasePrice === '') {
      console.log('❌ PurchasePrice manquant ou invalide:', purchasePrice);
      return res.status(400).json({ message: 'PurchasePrice is required' });
    }
    
    // Check if product exists
    const product = Product.getById(productId);
    if (!product) {
      console.log('❌ Produit non trouvé:', productId);
      return res.status(404).json({ message: 'Product not found' });
    }
    
    console.log('✅ Produit trouvé:', {
      id: product.id,
      description: product.description,
      purchasePrice: product.purchasePrice,
      quantity: product.quantity
    });
    
    // Check if description contains "avance" word (case insensitive)
    const isAdvanceProduct = description.toLowerCase().includes('avance');
    console.log('🔍 Type de produit:', isAdvanceProduct ? 'Avance' : 'Normal');
    
    // For advance products, we force quantity to 0
    let finalQuantitySold = isAdvanceProduct ? 0 : Number(quantitySold || 1);
    console.log('📊 Quantité finale:', finalQuantitySold);
    
    // For non-advance products, check stock availability
    if (!isAdvanceProduct) {
      const requestedQuantity = Number(quantitySold || 1);
      if (requestedQuantity <= 0) {
        console.log('❌ Quantité invalide:', requestedQuantity);
        return res.status(400).json({ message: 'Quantity must be greater than 0' });
      }
      
      if (product.quantity < requestedQuantity) {
        console.log('❌ Stock insuffisant:', { demande: requestedQuantity, disponible: product.quantity });
        return res.status(400).json({ message: 'Not enough quantity available' });
      }
    }
    
    // Convert and validate numeric values
    const numericSellingPrice = Number(sellingPrice);
    const numericPurchasePrice = Number(purchasePrice);
    const numericProfit = Number(profit || 0);
    
    if (isNaN(numericSellingPrice) || numericSellingPrice < 0) {
      console.log('❌ Prix de vente invalide:', sellingPrice);
      return res.status(400).json({ message: 'Invalid selling price' });
    }
    
    if (isNaN(numericPurchasePrice) || numericPurchasePrice < 0) {
      console.log('❌ Prix d\'achat invalide:', purchasePrice);
      return res.status(400).json({ message: 'Invalid purchase price' });
    }
    
    // Use the profit already calculated by AddSaleForm
    const saleData = {
      date,
      productId,
      description,
      sellingPrice: numericSellingPrice,
      quantitySold: finalQuantitySold,
      purchasePrice: numericPurchasePrice,
      profit: numericProfit
    };
    
    console.log('💾 Données de vente à créer:', JSON.stringify(saleData, null, 2));
    
    const newSale = Sale.create(saleData);
    
    if (!newSale) {
      console.log('❌ Erreur lors de la création de la vente');
      return res.status(500).json({ message: 'Error creating sale' });
    }
    
    if (newSale.error) {
      console.log('❌ Erreur retournée:', newSale.error);
      return res.status(400).json({ message: newSale.error });
    }
    
    console.log('✅ Vente créée avec succès:', newSale);
    res.status(201).json(newSale);
  } catch (error) {
    console.error('❌ Error creating sale:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update sale
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { 
      date, productId, description, sellingPrice, 
      quantitySold, purchasePrice, profit 
    } = req.body;
    
    if (!date || !productId || !description || !sellingPrice || purchasePrice === undefined) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if description contains "avance" word (case insensitive)
    const isAdvanceProduct = description.toLowerCase().includes('avance');
    
    // For advance products, we force quantity to 0
    let finalQuantitySold = isAdvanceProduct ? 0 : Number(quantitySold);
    
    // Use the profit already calculated by AddSaleForm
    const saleData = {
      date,
      productId,
      description,
      sellingPrice: Number(sellingPrice),
      quantitySold: finalQuantitySold,
      purchasePrice: Number(purchasePrice),
      profit: Number(profit) // Use the profit directly from frontend calculation
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
    console.error('Error updating sale:', error);
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
    console.error('Error deleting sale:', error);
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
    
    console.log(`Exporting sales for month: ${month}, year: ${year}`);
    
    // Get sales for the month (for PDF generation in a real app)
    const sales = Sale.getByMonthYear(Number(month), Number(year));
    console.log(`Found ${sales.length} sales to export`);
    
    // In a real app, this would generate a PDF file
    // For now, we'll just clear the sales for the month
    const success = Sale.clearByMonthYear(Number(month), Number(year));
    
    if (!success) {
      return res.status(500).json({ message: 'Error exporting sales' });
    }
    
    res.json({ success: true, salesCount: sales.length });
  } catch (error) {
    console.error('Error exporting sales:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
