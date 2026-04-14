/**
 * compta.js - Routes API pour la comptabilité
 * 
 * Gestion des écritures comptables, soldes et rapports financiers.
 */
const express = require('express');
const router = express.Router();
const Compta = require('../models/Compta');

// GET - Récupérer toutes les données de comptabilité
router.get('/', (req, res) => {
  try {
    const data = Compta.getAll();
    res.json(data);
  } catch (error) {
    console.error('Error fetching compta:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET - Récupérer les données par mois et année
router.get('/monthly/:year/:month', (req, res) => {
  try {
    const { year, month } = req.params;
    const data = Compta.getByMonthYear(parseInt(month), parseInt(year));
    
    if (!data) {
      // Si pas de données, calculer et sauvegarder
      const calculated = Compta.calculateAndSave(parseInt(month), parseInt(year));
      return res.json(calculated);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching monthly compta:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET - Récupérer les données par année
router.get('/yearly/:year', (req, res) => {
  try {
    const { year } = req.params;
    const data = Compta.getByYear(parseInt(year));
    res.json(data);
  } catch (error) {
    console.error('Error fetching yearly compta:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET - Résumé annuel
router.get('/summary/:year', (req, res) => {
  try {
    const { year } = req.params;
    const summary = Compta.getYearlySummary(parseInt(year));
    
    if (!summary) {
      // Recalculer l'année si pas de données
      Compta.recalculateYear(parseInt(year));
      const newSummary = Compta.getYearlySummary(parseInt(year));
      return res.json(newSummary || { year: parseInt(year), message: 'Aucune donnée' });
    }
    
    res.json(summary);
  } catch (error) {
    console.error('Error fetching yearly summary:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST - Recalculer un mois
router.post('/calculate/:year/:month', (req, res) => {
  try {
    const { year, month } = req.params;
    const result = Compta.calculateAndSave(parseInt(month), parseInt(year));
    
    if (!result) {
      return res.status(500).json({ error: 'Erreur de calcul' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error calculating compta:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST - Recalculer toute l'année
router.post('/recalculate/:year', (req, res) => {
  try {
    const { year } = req.params;
    const results = Compta.recalculateYear(parseInt(year));
    res.json({ year: parseInt(year), months: results.length, data: results });
  } catch (error) {
    console.error('Error recalculating year:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
