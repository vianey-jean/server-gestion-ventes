/**
 * =============================================================================
 * Contrôleur Tâches - Logique métier du planning des tâches
 * =============================================================================
 * @module controllers/tacheController
 */

const Tache = require('../models/Tache');
const { checkIndisponibilite } = require('../services/availabilityService');

exports.getAll = (req, res) => {
  try {
    const { date, year, month, startDate, endDate } = req.query;
    let taches;
    if (date) taches = Tache.getByDate(date);
    else if (startDate && endDate) taches = Tache.getByWeek(startDate, endDate);
    else if (year && month) taches = Tache.getByMonth(year, month);
    else if (year) taches = Tache.getAll().filter(t => new Date(t.date).getFullYear() === parseInt(year));
    else taches = Tache.getAll();
    res.json(taches);
  } catch (error) { res.status(500).json({ error: 'Erreur serveur' }); }
};

exports.getById = (req, res) => {
  const tache = Tache.getById(req.params.id);
  if (!tache) return res.status(404).json({ error: 'Tâche non trouvée' });
  res.json(tache);
};

exports.create = (req, res) => {
  const { date, heureDebut, heureFin, description, importance, travailleurId, travailleurNom, parentId, commandeId } = req.body;
  const normalizedHeureFin = heureFin || heureDebut;

  if (!date || !heureDebut || !description || !importance) {
    return res.status(400).json({ error: 'Champs requis: date, heureDebut, description, importance' });
  }

  const indispoCheck = checkIndisponibilite(date, heureDebut, normalizedHeureFin);
  if (!indispoCheck.disponible) {
    return res.status(409).json({ error: `🚫 ${indispoCheck.message}. Impossible d'ajouter une tâche pendant un créneau indisponible.` });
  }

  const validation = Tache.validateTimeSlot({ date, heureDebut, heureFin: normalizedHeureFin, travailleurNom: travailleurNom || '' });
  if (!validation.valid) {
    return res.status(409).json({ error: validation.error, availableSlots: validation.availableSlots, conflict: validation.conflict || null });
  }

  const tache = Tache.create({
    date, heureDebut, heureFin: normalizedHeureFin, description, importance,
    travailleurId: travailleurId || '', travailleurNom: travailleurNom || '',
    parentId: parentId || undefined, commandeId: commandeId || undefined
  });
  if (!tache) return res.status(500).json({ error: 'Erreur création' });
  res.status(201).json(tache);
};

exports.update = (req, res) => {
  const existing = Tache.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tâche non trouvée' });

  // Mise à jour du statut completed uniquement
  if (req.body.completed !== undefined && Object.keys(req.body).filter(k => k !== 'completed' && k !== 'heureFin').length === 0) {
    const updateData = { completed: req.body.completed };
    if (req.body.heureFin) updateData.heureFin = req.body.heureFin;
    const updated = Tache.update(req.params.id, updateData);
    if (!updated) return res.status(500).json({ error: 'Erreur mise à jour' });
    return res.json(updated);
  }

  // Tâches pertinentes : seulement description modifiable
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
    date: nextDate, heureDebut: nextHeureDebut, heureFin: nextHeureFin,
    excludeId: req.params.id, travailleurNom: nextTravailleurNom
  });
  if (!validation.valid) {
    return res.status(409).json({ error: validation.error, availableSlots: validation.availableSlots, conflict: validation.conflict || null });
  }

  const updated = Tache.update(req.params.id, { ...req.body, heureFin: nextHeureFin });
  if (!updated) return res.status(500).json({ error: 'Erreur mise à jour' });
  res.json(updated);
};

exports.delete = (req, res) => {
  const existing = Tache.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tâche non trouvée' });
  if (existing.importance === 'pertinent') return res.status(403).json({ error: 'Impossible de supprimer une tâche pertinente' });
  const deleted = Tache.delete(req.params.id);
  if (!deleted) return res.status(500).json({ error: 'Erreur suppression' });
  res.json({ message: 'Tâche supprimée' });
};
