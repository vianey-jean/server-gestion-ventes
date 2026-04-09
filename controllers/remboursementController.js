/**
 * RemboursementController — Logique métier pour les remboursements
 */
const Remboursement = require('../models/Remboursement');
const Sale = require('../models/Sale');
const Product = require('../models/Product');

exports.getAll = (req, res) => {
  try {
    res.json(Remboursement.getAll());
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getByMonth = (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'Month and year are required' });
    res.json(Remboursement.getByMonthYear(month, year));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.searchSales = (req, res) => {
  try {
    const { clientName } = req.query;
    if (!clientName || clientName.length < 3) return res.json([]);

    const allSales = Sale.getAll();
    const query = clientName.toLowerCase();
    const matchingSales = allSales.filter(sale => {
      if (!sale.clientName) return false;
      if (!sale.clientName.toLowerCase().includes(query)) return false;
      if (sale.isRefund) return false;
      const sellingPrice = sale.totalSellingPrice || sale.sellingPrice || 0;
      return sellingPrice >= 0;
    });

    res.json(matchingSales);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = (req, res) => {
  try {
    const { originalSaleId, date, products, totalRefundPrice, totalPurchasePrice, totalProfit,
            clientName, clientPhone, clientAddress, restoreStock, productsToRestore } = req.body;

    if (!date || !products || products.length === 0) {
      return res.status(400).json({ message: 'Date and products are required' });
    }

    // Restore stock
    if (restoreStock && productsToRestore && productsToRestore.length > 0) {
      for (const product of products) {
        const qty = Math.abs(Number(product.quantitySold) || 0);
        if (product.productId && productsToRestore.includes(product.productId) && qty > 0) {
          Product.updateQuantity(product.productId, qty);
        }
      }
    }

    // Create negative sale
    const negativeSale = Sale.create({
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
    });

    if (!negativeSale) return res.status(500).json({ message: 'Error creating negative sale' });

    // Save remboursement
    const remboursement = Remboursement.create({
      date,
      originalSaleId: originalSaleId || null,
      negativeSaleId: negativeSale.id,
      products: products.map(p => {
        const qty = Number(p.quantitySold) || 0;
        const qtyAbs = Math.abs(qty);
        const totalRefund = Math.abs(p.refundPrice || p.sellingPrice || 0);
        return {
          productId: p.productId,
          description: p.description,
          quantityRefunded: qty,
          refundPriceUnit: p.refundPriceUnit || (qtyAbs > 0 ? totalRefund / qtyAbs : 0),
          totalRefundPrice: totalRefund,
          purchasePriceUnit: qtyAbs > 0 ? -Math.abs((p.purchasePrice || 0) / qtyAbs) : 0,
          totalPurchasePrice: -Math.abs(p.purchasePrice || 0),
          profit: p.profit
        };
      }),
      totalRefundPrice: Math.abs(totalRefundPrice),
      totalPurchasePrice: -Math.abs(totalPurchasePrice),
      totalProfit: Math.abs(totalProfit),
      clientName: clientName || null,
      clientPhone: clientPhone || null,
      clientAddress: clientAddress || null,
      stockRestored: restoreStock || false,
      productsRestored: (restoreStock && productsToRestore) ? productsToRestore : []
    });

    if (!remboursement) return res.status(500).json({ message: 'Error saving remboursement' });

    res.status(201).json({ remboursement, negativeSale });
  } catch (error) {
    console.error('❌ Error creating remboursement:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = (req, res) => {
  try {
    const allRemboursements = Remboursement.getAll();
    const remboursement = allRemboursements.find(r => r.id === req.params.id);
    if (!remboursement) return res.status(404).json({ message: 'Remboursement not found' });

    // Reverse stock restoration
    if (remboursement.stockRestored && remboursement.productsRestored && remboursement.productsRestored.length > 0) {
      for (const product of remboursement.products) {
        const qty = Math.abs(Number(product.quantityRefunded) || 0);
        if (product.productId && remboursement.productsRestored.includes(product.productId) && qty > 0) {
          Product.updateQuantity(product.productId, -qty);
        }
      }
    }

    if (remboursement.negativeSaleId) Sale.delete(remboursement.negativeSaleId);

    const deleted = Remboursement.delete(req.params.id);
    if (!deleted) return res.status(500).json({ message: 'Error deleting remboursement' });

    res.json({ message: 'Remboursement deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
