/**
 * =============================================================================
 * Contrôleur Pointage - Logique métier du suivi temps
 * =============================================================================
 * @module controllers/pointageController
 */

const Pointage = require('../models/Pointage');

exports.getAll = (req, res) => {
  try {
    const { year, month, date } = req.query;
    if (date) return res.json(Pointage.getByDate(date));
    if (year && month) return res.json(Pointage.getByMonth(year, month));
    if (year && !month) return res.json(Pointage.getByYear(year));
    res.json(Pointage.getAll());
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.getById = (req, res) => {
  try {
    const item = Pointage.getById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.create = (req, res) => {
  try {
    const { date, entrepriseId, entrepriseNom, typePaiement, heures, prixJournalier, prixHeure, montantTotal, travailleurId, travailleurNom } = req.body;
    if (!date || !entrepriseId) return res.status(400).json({ message: 'Champs requis: date, entrepriseId' });
    const newItem = Pointage.create({
      date, entrepriseId, entrepriseNom: entrepriseNom || '',
      typePaiement: typePaiement || 'journalier', heures: heures ? Number(heures) : 0,
      prixJournalier: prixJournalier ? Number(prixJournalier) : 0, prixHeure: prixHeure ? Number(prixHeure) : 0,
      montantTotal: montantTotal ? Number(montantTotal) : 0,
      travailleurId: travailleurId || '', travailleurNom: travailleurNom || ''
    });
    if (!newItem) return res.status(500).json({ message: 'Error creating' });
    res.status(201).json(newItem);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.update = (req, res) => {
  try {
    const updated = Pointage.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.delete = (req, res) => {
  try {
    const success = Pointage.delete(req.params.id);
    if (!success) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};
