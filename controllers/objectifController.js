/**
 * =============================================================================
 * Contrôleur Objectif - Logique métier des objectifs de vente
 * =============================================================================
 * @module controllers/objectifController
 */

const Objectif = require('../models/Objectif');
const Sale = require('../models/Sale');

exports.get = async (req, res) => {
  try { res.json(Objectif.recalculateFromSales(Sale.getAll())); }
  catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.getHistorique = async (req, res) => {
  try {
    const sales = Sale.getAll();
    Objectif.recalculateFromSales(sales);
    Objectif.calculateBeneficesFromSales(sales);
    res.json(Objectif.getHistorique());
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.updateObjectif = async (req, res) => {
  try {
    const { objectif, month, year } = req.body;
    if (objectif === undefined || objectif === null) return res.status(400).json({ message: 'Objectif value is required' });
    res.json(Objectif.updateObjectif(objectif, month, year));
  } catch (error) {
    if (error.message === 'Cannot modify objectif for past months') return res.status(403).json({ message: 'Les objectifs des mois passés sont verrouillés' });
    if (error.message === 'OBJECTIF_MUST_INCREASE') return res.status(400).json({ message: 'OBJECTIF_MUST_INCREASE' });
    if (error.message === 'INVALID_OBJECTIF') return res.status(400).json({ message: 'Valeur d\'objectif invalide' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.recalculate = async (req, res) => {
  try { res.json(Objectif.recalculateFromSales(Sale.getAll())); }
  catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.saveMonthly = async (req, res) => {
  try { res.json(Objectif.saveMonthlyData(Sale.getAll())); }
  catch (error) { res.status(500).json({ message: 'Server error' }); }
};
