/**
 * Routes Prix Pointage & Paramètre Tâches
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const dbPath = path.join(__dirname, '../db');
const prixPointagePath = path.join(dbPath, 'prixpointage.json');
const parametreTachePath = path.join(dbPath, 'parametretache.json');

const readJson = (filePath, defaultVal = {}) => {
  try {
    if (!fs.existsSync(filePath)) return defaultVal;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return defaultVal; }
};

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// GET prix pointage
router.get('/prixpointage', authMiddleware, (req, res) => {
  try {
    const data = readJson(prixPointagePath, { prixHeure: 10, prixJournalier: 80 });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT prix pointage
router.put('/prixpointage', authMiddleware, (req, res) => {
  try {
    const { prixHeure, prixJournalier } = req.body;
    const data = readJson(prixPointagePath, { prixHeure: 10, prixJournalier: 80 });
    if (prixHeure !== undefined) data.prixHeure = prixHeure;
    if (prixJournalier !== undefined) data.prixJournalier = prixJournalier;
    writeJson(prixPointagePath, data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET parametretache
router.get('/parametretache', authMiddleware, (req, res) => {
  try {
    const data = readJson(parametreTachePath, { autoCompleteOnDone: true, tachesTerminees: true });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT parametretache
router.put('/parametretache', authMiddleware, (req, res) => {
  try {
    const data = readJson(parametreTachePath, { autoCompleteOnDone: true, tachesTerminees: true });
    if (req.body.autoCompleteOnDone !== undefined) data.autoCompleteOnDone = req.body.autoCompleteOnDone;
    if (req.body.tachesTerminees !== undefined) data.tachesTerminees = req.body.tachesTerminees;
    writeJson(parametreTachePath, data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
