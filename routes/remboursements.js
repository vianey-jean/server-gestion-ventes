const express = require('express');
const router = express.Router();
const Remboursement = require('../models/Remboursement');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const authMiddleware = require('../middleware/auth');

// Get all remboursements
router.get('/', authMiddleware, async (req, res) => {
  try {
    const remboursements = Remboursement.getAll();
    res.json(remboursements);
  } catch (error) {
    console.error('Error getting remboursements:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get remboursements by month/year
router.get('/by-month', authMiddleware, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }
    const remboursements = Remboursement.getByMonthYear(month, year);
    res.json(remboursements);
  } catch (error) {
    console.error('Error getting remboursements by month:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search sales by client name (for refund form)
router.get('/search-sales', authMiddleware, async (req, res) => {
  try {
    const { clientName } = req.query;
    if (!clientName || clientName.length < 3) {
      return res.json([]);
    }

    const allSales = Sale.getAll();
    const query = clientName.toLowerCase();
    
    // Filter sales that match client name and are NOT already refunds (positive values)
    const matchingSales = allSales.filter(sale => {
      if (!sale.clientName) return false;
      if (!sale.clientName.toLowerCase().includes(query)) return false;
      // Exclude sales that are already refunds (negative values)
      if (sale.isRefund) return false;
      // Check if selling price is positive
      const sellingPrice = sale.totalSellingPrice || sale.sellingPrice || 0;
      if (sellingPrice < 0) return false;
      return true;
    });

    res.json(matchingSales);
  } catch (error) {
    console.error('Error searching sales for refund:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a refund
router.post('/', authMiddleware, async (req, res) => {
  try {
    console.log('💰 REMBOURSEMENT - Création d\'un remboursement');
    console.log('📝 Données reçues:', JSON.stringify(req.body, null, 2));

    const {
      originalSaleId,
      date,
      products,
      totalRefundPrice,
      totalPurchasePrice,
      totalProfit,
      clientName,
      clientPhone,
      clientAddress
    } = req.body;

    if (!date || !products || products.length === 0) {
      return res.status(400).json({ message: 'Date and products are required' });
    }

    // 1. Restore stock for each refunded product
    for (const product of products) {
      if (product.productId && product.quantitySold > 0) {
        console.log(`🔄 Restauration stock: ${product.description} +${product.quantitySold}`);
        Product.updateQuantity(product.productId, product.quantitySold);
      }
    }

    // 2. Create negative sale entry in sales.json
    // Purchase price is also negative (refunded), but delivery fee stays unchanged
    const negativeSaleData = {
      date,
      products: products.map(p => ({
        ...p,
        sellingPrice: -Math.abs(p.refundPrice || p.sellingPrice),
        purchasePrice: -Math.abs(p.purchasePrice),
        profit: -Math.abs(p.profit),
        deliveryFee: p.deliveryFee || 0
      })),
      totalSellingPrice: -Math.abs(totalRefundPrice),
      totalPurchasePrice: -Math.abs(totalPurchasePrice),
      totalProfit: -Math.abs(totalProfit),
      clientName: clientName || null,
      clientPhone: clientPhone || null,
      clientAddress: clientAddress || null,
      isRefund: true,
      originalSaleId: originalSaleId || null
    };

    console.log('💾 Création vente négative:', JSON.stringify(negativeSaleData, null, 2));
    const negativeSale = Sale.create(negativeSaleData);

    if (!negativeSale) {
      return res.status(500).json({ message: 'Error creating negative sale' });
    }

    // 3. Save remboursement record
    const remboursementData = {
      date,
      originalSaleId: originalSaleId || null,
      negativeSaleId: negativeSale.id,
      products: products.map(p => ({
        productId: p.productId,
        description: p.description,
        quantityRefunded: p.quantitySold,
        refundPriceUnit: p.refundPriceUnit || p.sellingPrice / p.quantitySold,
        totalRefundPrice: p.refundPrice || p.sellingPrice,
        purchasePriceUnit: -Math.abs(p.purchasePrice / p.quantitySold),
        totalPurchasePrice: -Math.abs(p.purchasePrice),
        profit: p.profit
      })),
      totalRefundPrice: Math.abs(totalRefundPrice),
      totalPurchasePrice: -Math.abs(totalPurchasePrice),
      totalProfit: Math.abs(totalProfit),
      clientName: clientName || null,
      clientPhone: clientPhone || null,
      clientAddress: clientAddress || null
    };

    const remboursement = Remboursement.create(remboursementData);

    if (!remboursement) {
      return res.status(500).json({ message: 'Error saving remboursement' });
    }

    console.log('✅ Remboursement créé avec succès:', remboursement);
    res.status(201).json({ remboursement, negativeSale });
  } catch (error) {
    console.error('❌ Error creating remboursement:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
