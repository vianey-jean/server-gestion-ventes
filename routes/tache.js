const express = require('express');
const router = express.Router();
const Tache = require('../models/Tache');

// GET all taches or filter by date/month/week
router.get('/', (req, res) => {
  try {
    const { date, year, month, startDate, endDate } = req.query;
    let taches;
    if (date) {
      taches = Tache.getByDate(date);
    } else if (startDate && endDate) {
      taches = Tache.getByWeek(startDate, endDate);
    } else if (year && month) {
      taches = Tache.getByMonth(year, month);
    } else if (year) {
      taches = Tache.getAll().filter(t => new Date(t.date).getFullYear() === parseInt(year));
    } else {
      taches = Tache.getAll();
    }
    res.json(taches);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET by id
router.get('/:id', (req, res) => {
  const tache = Tache.getById(req.params.id);
  if (!tache) return res.status(404).json({ error: 'Tâche non trouvée' });
  res.json(tache);
});

// POST create
router.post('/', (req, res) => {
  const { date, heureDebut, heureFin, description, importance, travailleurId, travailleurNom, parentId } = req.body;
  const normalizedHeureFin = heureFin || heureDebut;

  if (!date || !heureDebut || !description || !importance) {
    return res.status(400).json({ error: 'Champs requis: date, heureDebut, description, importance' });
  }

  const validation = Tache.validateTimeSlot({
    date,
    heureDebut,
    heureFin: normalizedHeureFin
  });

  if (!validation.valid) {
    return res.status(409).json({
      error: validation.error,
      availableSlots: validation.availableSlots,
      conflict: validation.conflict || null
    });
  }

  const tache = Tache.create({
    date,
    heureDebut,
    heureFin: normalizedHeureFin,
    description,
    importance,
    travailleurId: travailleurId || '',
    travailleurNom: travailleurNom || '',
    parentId: parentId || undefined
  });
  if (!tache) return res.status(500).json({ error: 'Erreur création' });
  res.status(201).json(tache);
});

// PUT update
router.put('/:id', (req, res) => {
  const existing = Tache.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tâche non trouvée' });

  if (req.body.completed !== undefined && Object.keys(req.body).length === 1) {
    const updated = Tache.update(req.params.id, { completed: req.body.completed });
    if (!updated) return res.status(500).json({ error: 'Erreur mise à jour' });
    return res.json(updated);
  }

  if (existing.importance === 'pertinent') {
    const updated = Tache.update(req.params.id, { description: req.body.description });
    if (!updated) return res.status(500).json({ error: 'Erreur mise à jour' });
    return res.json(updated);
  }

  const nextDate = req.body.date || existing.date;
  const nextHeureDebut = req.body.heureDebut || existing.heureDebut;
  const nextHeureFin = req.body.heureFin || existing.heureFin;

  const validation = Tache.validateTimeSlot({
    date: nextDate,
    heureDebut: nextHeureDebut,
    heureFin: nextHeureFin,
    excludeId: req.params.id
  });

  if (!validation.valid) {
    return res.status(409).json({
      error: validation.error,
      availableSlots: validation.availableSlots,
      conflict: validation.conflict || null
    });
  }

  const updated = Tache.update(req.params.id, {
    ...req.body,
    heureFin: nextHeureFin
  });
  if (!updated) return res.status(500).json({ error: 'Erreur mise à jour' });
  res.json(updated);
});

// DELETE
router.delete('/:id', (req, res) => {
  const existing = Tache.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tâche non trouvée' });
  if (existing.importance === 'pertinent') {
    return res.status(403).json({ error: 'Impossible de supprimer une tâche pertinente' });
  }
  const deleted = Tache.delete(req.params.id);
  if (!deleted) return res.status(500).json({ error: 'Erreur suppression' });
  res.json({ message: 'Tâche supprimée' });
});

module.exports = router;