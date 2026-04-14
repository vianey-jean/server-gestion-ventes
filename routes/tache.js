/**
 * tache.js - Routes API pour la gestion des tâches
 * 
 * CRUD complet pour les tâches avec support de :
 * - Création, modification, suppression de tâches
 * - Marquage comme complétée/non complétée
 * - Filtrage par date, importance, travailleur
 * Toutes les routes sont authentifiées.
 */
const express = require('express');
const router = express.Router();
const Tache = require('../models/Tache');
const fs = require('fs');
const path = require('path');

const readJson = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return []; }
};

const checkIndisponibilite = (date, heureDebut, heureFin) => {
  const indispoPath = path.join(__dirname, '../db/indisponible.json');
  const indispos = readJson(indispoPath);
  const indispoForDate = indispos.filter(d => d.date === date);
  if (indispoForDate.length === 0) return { disponible: true };
  const conflicts = indispoForDate.filter(d => {
    if (d.journeeComplete) return true;
    if (!heureDebut || !heureFin) return true;
    return d.heureDebut < heureFin && d.heureFin > heureDebut;
  });
  if (conflicts.length > 0) {
    const c = conflicts[0];
    return {
      disponible: false,
      message: c.journeeComplete
        ? `Cette journée est indisponible${c.motif ? ` (${c.motif})` : ''}`
        : `Créneau indisponible: ${c.heureDebut} - ${c.heureFin}${c.motif ? ` (${c.motif})` : ''}`
    };
  }
  return { disponible: true };
};

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
  const { date, heureDebut, heureFin, description, importance, travailleurId, travailleurNom, parentId, commandeId } = req.body;
  const normalizedHeureFin = heureFin || heureDebut;

  if (!date || !heureDebut || !description || !importance) {
    return res.status(400).json({ error: 'Champs requis: date, heureDebut, description, importance' });
  }

  // Check indisponibilité
  const indispoCheck = checkIndisponibilite(date, heureDebut, normalizedHeureFin);
  if (!indispoCheck.disponible) {
    return res.status(409).json({ error: `🚫 ${indispoCheck.message}. Impossible d'ajouter une tâche pendant un créneau indisponible.` });
  }

  const validation = Tache.validateTimeSlot({
    date,
    heureDebut,
    heureFin: normalizedHeureFin,
    travailleurNom: travailleurNom || ''
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
    parentId: parentId || undefined,
    commandeId: commandeId || undefined
  });
  if (!tache) return res.status(500).json({ error: 'Erreur création' });
  res.status(201).json(tache);
});

// PUT update
router.put('/:id', (req, res) => {
  const existing = Tache.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tâche non trouvée' });

  if (req.body.completed !== undefined && Object.keys(req.body).filter(k => k !== 'completed' && k !== 'heureFin').length === 0) {
    const updateData = { completed: req.body.completed };
    if (req.body.heureFin) updateData.heureFin = req.body.heureFin;
    const updated = Tache.update(req.params.id, updateData);
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
  const nextTravailleurNom = req.body.travailleurNom || existing.travailleurNom || '';

  const validation = Tache.validateTimeSlot({
    date: nextDate,
    heureDebut: nextHeureDebut,
    heureFin: nextHeureFin,
    excludeId: req.params.id,
    travailleurNom: nextTravailleurNom
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
