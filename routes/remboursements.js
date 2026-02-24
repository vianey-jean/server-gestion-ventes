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
    
    const matchingSales = allSales.filter(sale => {
      if (!sale.clientName) return false;
      if (!sale.clientName.toLowerCase().includes(query)) return false;
      if (sale.isRefund) return false;
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

    const {
      originalSaleId,
      date,
      products,
      totalRefundPrice,
      totalPurchasePrice,
      totalProfit,
      clientName,
      clientPhone,
      clientAddress,
      restoreStock,
      productsToRestore
    } = req.body;

    if (!date || !products || products.length === 0) {
      return res.status(400).json({ message: 'Date and products are required' });
    }

    // 1. Restore stock ONLY for products flagged for restoration (full refund)
    if (restoreStock && productsToRestore && productsToRestore.length > 0) {
      for (const product of products) {
        if (product.productId && productsToRestore.includes(product.productId) && product.quantitySold > 0) {
          console.log(`🔄 Restauration stock: ${product.description} +${product.quantitySold}`);
          Product.updateQuantity(product.productId, product.quantitySold);
        }
      }
    }

    // 2. Create negative sale entry in sales.json
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
      originalSaleId: originalSaleId || null,
      stockRestored: restoreStock || false,
      productsRestored: (restoreStock && productsToRestore) ? productsToRestore : []
    };

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
      clientAddress: clientAddress || null,
      stockRestored: restoreStock || false,
      productsRestored: (restoreStock && productsToRestore) ? productsToRestore : []
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

// Delete a refund - handle stock reversal
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Suppression remboursement: ${id}`);

    // Get the remboursement first to check stock restoration
    const allRemboursements = Remboursement.getAll();
    const remboursement = allRemboursements.find(r => r.id === id);

    if (!remboursement) {
      return res.status(404).json({ message: 'Remboursement not found' });
    }

    // If stock was restored during refund, we need to decrease it back
    if (remboursement.stockRestored && remboursement.productsRestored && remboursement.productsRestored.length > 0) {
      for (const product of remboursement.products) {
        if (product.productId && remboursement.productsRestored.includes(product.productId) && product.quantityRefunded > 0) {
          console.log(`📦 Diminution stock après suppression remboursement: ${product.description} -${product.quantityRefunded}`);
          Product.updateQuantity(product.productId, -product.quantityRefunded);
        }
      }
    }

    // Delete the negative sale entry
    if (remboursement.negativeSaleId) {
      const Sale = require('../models/Sale');
      Sale.delete(remboursement.negativeSaleId);
    }

    // Delete the remboursement
    const deleted = Remboursement.delete(id);
    if (!deleted) {
      return res.status(500).json({ message: 'Error deleting remboursement' });
    }

    console.log('✅ Remboursement supprimé avec succès');
    res.json({ message: 'Remboursement deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting remboursement:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
