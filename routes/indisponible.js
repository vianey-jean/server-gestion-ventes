/**
 * Routes Indisponibilité - Gestion des jours/heures indisponibles
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const dbPath = path.join(__dirname, '../db');
const indisponiblePath = path.join(dbPath, 'indisponible.json');

const readJson = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return []; }
};

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// GET all indisponibilités
router.get('/', authMiddleware, (req, res) => {
  try {
    const data = readJson(indisponiblePath);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST create indisponibilité
router.post('/', authMiddleware, (req, res) => {
  try {
    const { date, heureDebut, heureFin, motif, journeeComplete } = req.body;
    if (!date) {
      return res.status(400).json({ message: 'La date est requise' });
    }

    const data = readJson(indisponiblePath);
    const newEntry = {
      id: Date.now().toString(),
      date,
      heureDebut: journeeComplete ? '00:00' : (heureDebut || '00:00'),
      heureFin: journeeComplete ? '23:59' : (heureFin || '23:59'),
      journeeComplete: !!journeeComplete,
      motif: motif || '',
      createdAt: new Date().toISOString()
    };

    data.push(newEntry);
    writeJson(indisponiblePath, data);
    res.status(201).json(newEntry);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT update indisponibilité
router.put('/:id', authMiddleware, (req, res) => {
  try {
    let data = readJson(indisponiblePath);
    const index = data.findIndex(d => d.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Non trouvé' });
    const { date, heureDebut, heureFin, motif, journeeComplete } = req.body;
    data[index] = {
      ...data[index],
      date: date || data[index].date,
      heureDebut: journeeComplete ? '00:00' : (heureDebut || data[index].heureDebut),
      heureFin: journeeComplete ? '23:59' : (heureFin || data[index].heureFin),
      journeeComplete: journeeComplete !== undefined ? !!journeeComplete : data[index].journeeComplete,
      motif: motif !== undefined ? motif : data[index].motif,
    };
    writeJson(indisponiblePath, data);
    res.json(data[index]);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE indisponibilité
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    let data = readJson(indisponiblePath);
    const index = data.findIndex(d => d.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Non trouvé' });
    data.splice(index, 1);
    writeJson(indisponiblePath, data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST check availability - check if a date/time slot is available
router.post('/check', authMiddleware, (req, res) => {
  try {
    const { date, heureDebut, heureFin } = req.body;
    if (!date) return res.status(400).json({ message: 'Date requise' });

    const data = readJson(indisponiblePath);
    const indispoForDate = data.filter(d => d.date === date);

    if (indispoForDate.length === 0) {
      return res.json({ disponible: true, indisponibilites: [] });
    }

    // Check time overlap
    const conflicts = indispoForDate.filter(d => {
      if (d.journeeComplete) return true;
      if (!heureDebut || !heureFin) return true;
      return d.heureDebut < heureFin && d.heureFin > heureDebut;
    });

    res.json({
      disponible: conflicts.length === 0,
      indisponibilites: conflicts
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
