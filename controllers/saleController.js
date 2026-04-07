/**
 * =============================================================================
 * Contrôleur Ventes - Logique métier CRUD des ventes
 * =============================================================================
 * 
 * Gère : liste, filtrage par mois, création, mise à jour, suppression, export.
 * 
 * @module controllers/saleController
 */

const Sale = require('../models/Sale');
const Product = require('../models/Product');

/** Récupère toutes les ventes */
exports.getAll = async (req, res) => {
  try {
    res.json(Sale.getAll());
  } catch (error) {
    console.error('Error getting all sales:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Récupère les ventes par mois et année */
exports.getByMonth = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }
    const monthNum = Number(month);
    const yearNum = Number(year);
    const allSales = Sale.getAll();
    const filteredSales = allSales.filter((sale) => {
      const saleDate = new Date(sale.date);
      return saleDate.getMonth() === monthNum && saleDate.getFullYear() === yearNum;
    });
    res.json(filteredSales);
  } catch (error) {
    console.error('Error getting sales by month:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Récupère une vente par ID */
exports.getById = async (req, res) => {
  try {
    const sale = Sale.getById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/** Crée une nouvelle vente et met à jour le stock */
exports.create = async (req, res) => {
  try {
    const saleData = req.body;

    // Mettre à jour le stock du produit
    if (saleData.productId && saleData.quantity) {
      const product = Product.getById(saleData.productId);
      if (product) {
        const newQuantity = (product.quantity || 0) - (saleData.quantity || 0);
        Product.update(saleData.productId, { quantity: Math.max(0, newQuantity) });
      }
    }

    const newSale = Sale.create(saleData);

    // Notifier les clients SSE
    if (req.app && req.app.locals && req.app.locals.broadcastSSE) {
      req.app.locals.broadcastSSE({ type: 'sales', action: 'create', data: newSale });
    }

    res.status(201).json(newSale);
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Met à jour une vente */
exports.update = async (req, res) => {
  try {
    const updatedSale = Sale.update(req.params.id, req.body);
    if (!updatedSale) return res.status(404).json({ message: 'Sale not found' });

    if (req.app?.locals?.broadcastSSE) {
      req.app.locals.broadcastSSE({ type: 'sales', action: 'update', data: updatedSale });
    }

    res.json(updatedSale);
  } catch (error) {
    console.error('Error updating sale:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Supprime une vente */
exports.delete = async (req, res) => {
  try {
    const deleted = Sale.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Sale not found' });

    if (req.app?.locals?.broadcastSSE) {
      req.app.locals.broadcastSSE({ type: 'sales', action: 'delete', data: { id: req.params.id } });
    }

    res.json({ message: 'Sale deleted successfully' });
  } catch (error) {
    console.error('Error deleting sale:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Exporte les ventes d'un mois vers l'historique */
exports.exportMonth = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (month === undefined || year === undefined) {
      return res.status(400).json({ message: 'Month and year are required' });
    }
    const result = Sale.exportMonth(month, year);
    res.json(result);
  } catch (error) {
    console.error('Error exporting month:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
