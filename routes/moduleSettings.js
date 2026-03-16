/**
 * Routes Module Settings - Paramètres spécifiques par module
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const dbPath = path.join(__dirname, '../db');
const moduleSettingsPath = path.join(dbPath, 'moduleSettings.json');

const readJson = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return {}; }
};

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const DEFAULT_MODULE_SETTINGS = {
  commandes: {
    autoCreateRdv: true,
    autoCreateTache: true,
    defaultStatut: 'en_attente',
    notifierClient: false
  },
  pointage: {
    defaultTypePaiement: 'horaire',
    defaultPrixHeure: 10,
    defaultPrixJournalier: 80,
    arrondiHeures: false
  },
  taches: {
    defaultImportance: 'optionnel',
    autoCompleteOnDone: true,
    showCompletedTasks: true
  },
  notes: {
    defaultColor: '#fef3c7',
    autoSave: true,
    showTimestamp: true
  }
};

// GET all module settings
router.get('/', authMiddleware, (req, res) => {
  try {
    const raw = readJson(moduleSettingsPath);
    const settings = {
      commandes: { ...DEFAULT_MODULE_SETTINGS.commandes, ...(raw.commandes || {}) },
      pointage: { ...DEFAULT_MODULE_SETTINGS.pointage, ...(raw.pointage || {}) },
      taches: { ...DEFAULT_MODULE_SETTINGS.taches, ...(raw.taches || {}) },
      notes: { ...DEFAULT_MODULE_SETTINGS.notes, ...(raw.notes || {}) },
    };
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET settings for a specific module
router.get('/:module', authMiddleware, (req, res) => {
  try {
    const { module } = req.params;
    const raw = readJson(moduleSettingsPath);
    const defaults = DEFAULT_MODULE_SETTINGS[module] || {};
    const settings = { ...defaults, ...(raw[module] || {}) };
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT update settings for a specific module
router.put('/:module', authMiddleware, (req, res) => {
  try {
    const { module } = req.params;
    const raw = readJson(moduleSettingsPath);
    raw[module] = { ...(raw[module] || {}), ...req.body };
    writeJson(moduleSettingsPath, raw);
    res.json({ success: true, settings: raw[module] });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
