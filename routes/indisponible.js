/**
 * Routes Indisponibilité - Gestion des jours/heures indisponibles
 * Supporte la récurrence (hebdomadaire) avec groupId
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
  } catch {
    return [];
  }
};

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const JOURS_SEMAINE = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi'
];

// ✅ Helper: format date LOCAL (évite décalage UTC)
const formatLocalDate = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ✅ Helper: generate dates for weekly recurrence (FIXED)
const generateWeeklyDates = (startDate, nombreSemaines) => {
  const dates = [];
  const start = new Date(startDate + 'T00:00:00');

  for (let i = 0; i < nombreSemaines; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i * 7);

    // ❌ AVANT: toISOString()
    // ✅ MAINTENANT: local
    dates.push(formatLocalDate(d));
  }

  return dates;
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

// POST create indisponibilité (supports recurrence)
router.post('/', authMiddleware, (req, res) => {
  try {
    const {
      date,
      heureDebut,
      heureFin,
      motif,
      journeeComplete,
      recurrence,
      nombreSemaines
    } = req.body;

    if (!date) {
      return res.status(400).json({ message: 'La date est requise' });
    }

    const data = readJson(indisponiblePath);
    const groupId = Date.now().toString();

    const startDate = new Date(date + 'T00:00:00');
    const jourSemaine = JOURS_SEMAINE[startDate.getDay()];

    let dates = [date];

    if (recurrence === 'weekly' && nombreSemaines && nombreSemaines > 1) {
      dates = generateWeeklyDates(date, nombreSemaines);
    }

    const newEntries = dates.map((d, i) => ({
      id: (parseInt(groupId) + i).toString(),
      groupId,
      date: d,
      heureDebut: journeeComplete ? '00:00' : (heureDebut || '00:00'),
      heureFin: journeeComplete ? '23:59' : (heureFin || '23:59'),
      journeeComplete: !!journeeComplete,
      motif: motif || '',
      recurrence: recurrence || 'once',
      jourSemaine: JOURS_SEMAINE[new Date(d + 'T00:00:00').getDay()], // ✅ recalcul correct
      createdAt: new Date().toISOString()
    }));

    data.push(...newEntries);
    writeJson(indisponiblePath, data);

    res.status(201).json(newEntries);
  } catch (error) {
    console.error('Error creating indisponibilite:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT update indisponibilité
router.put('/:id', authMiddleware, (req, res) => {
  try {
    let data = readJson(indisponiblePath);
    const entry = data.find(d => d.id === req.params.id);
    if (!entry) return res.status(404).json({ message: 'Non trouvé' });

    const { heureDebut, heureFin, motif, journeeComplete, selectedDates } = req.body;
    const groupId = entry.groupId;

    if (groupId && selectedDates && Array.isArray(selectedDates)) {
      const groupEntries = data.filter(d => d.groupId === groupId);
      const nonGroupEntries = data.filter(d => d.groupId !== groupId);

      const updatedGroup = groupEntries
        .filter(d => selectedDates.includes(d.date))
        .map(d => ({
          ...d,
          heureDebut: journeeComplete ? '00:00' : (heureDebut ?? d.heureDebut),
          heureFin: journeeComplete ? '23:59' : (heureFin ?? d.heureFin),
          journeeComplete: journeeComplete ?? d.journeeComplete,
          motif: motif ?? d.motif,
        }));

      data = [...nonGroupEntries, ...updatedGroup];
      writeJson(indisponiblePath, data);

      return res.json(updatedGroup);
    }

    const index = data.findIndex(d => d.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Non trouvé' });

    data[index] = {
      ...data[index],
      date: req.body.date || data[index].date,
      heureDebut: journeeComplete ? '00:00' : (heureDebut ?? data[index].heureDebut),
      heureFin: journeeComplete ? '23:59' : (heureFin ?? data[index].heureFin),
      journeeComplete: journeeComplete ?? data[index].journeeComplete,
      motif: motif ?? data[index].motif,
    };

    writeJson(indisponiblePath, data);
    res.json(data[index]);

  } catch (error) {
    console.error('Error updating indisponibilite:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE single
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    let data = readJson(indisponiblePath);
    const index = data.findIndex(d => d.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Non trouvé' });

    data.splice(index, 1);
    writeJson(indisponiblePath, data);

    res.json({ success: true });
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE group
router.delete('/group/:groupId', authMiddleware, (req, res) => {
  try {
    let data = readJson(indisponiblePath);
    const before = data.length;

    data = data.filter(d => d.groupId !== req.params.groupId);

    if (data.length === before) {
      return res.status(404).json({ message: 'Groupe non trouvé' });
    }

    writeJson(indisponiblePath, data);

    res.json({
      success: true,
      deleted: before - data.length
    });

  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// CHECK availability
router.post('/check', authMiddleware, (req, res) => {
  try {
    const { date, heureDebut, heureFin } = req.body;
    if (!date) return res.status(400).json({ message: 'Date requise' });

    const data = readJson(indisponiblePath);
    const indispoForDate = data.filter(d => d.date === date);

    if (indispoForDate.length === 0) {
      return res.json({ disponible: true, indisponibilites: [] });
    }

    const conflicts = indispoForDate.filter(d => {
      if (d.journeeComplete) return true;
      if (!heureDebut || !heureFin) return true;
      return d.heureDebut < heureFin && d.heureFin > heureDebut;
    });

    res.json({
      disponible: conflicts.length === 0,
      indisponibilites: conflicts
    });

  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;