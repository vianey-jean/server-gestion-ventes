/**
 * ComptaController — Logique métier pour la comptabilité
 */
const Compta = require('../models/Compta');

exports.getAll = (req, res) => {
  try {
    res.json(Compta.getAll());
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.getMonthly = (req, res) => {
  try {
    const { year, month } = req.params;
    const data = Compta.getByMonthYear(parseInt(month), parseInt(year));
    if (!data) {
      return res.json(Compta.calculateAndSave(parseInt(month), parseInt(year)));
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.getYearly = (req, res) => {
  try {
    res.json(Compta.getByYear(parseInt(req.params.year)));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.getSummary = (req, res) => {
  try {
    const year = parseInt(req.params.year);
    let summary = Compta.getYearlySummary(year);
    if (!summary) {
      Compta.recalculateYear(year);
      summary = Compta.getYearlySummary(year) || { year, message: 'Aucune donnée' };
    }
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.calculateMonth = (req, res) => {
  try {
    const result = Compta.calculateAndSave(parseInt(req.params.month), parseInt(req.params.year));
    if (!result) return res.status(500).json({ error: 'Erreur de calcul' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.recalculateYear = (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const results = Compta.recalculateYear(year);
    res.json({ year, months: results.length, data: results });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
