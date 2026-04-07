/**
 * =============================================================================
 * Contrôleur Dépenses - Logique métier des mouvements financiers
 * =============================================================================
 * @module controllers/depenseController
 */

const DepenseDuMois = require('../models/DepenseDuMois');

exports.getMouvements = (req, res) => {
  try { res.json(DepenseDuMois.getAllMouvements()); }
  catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
};

exports.getMouvementById = (req, res) => {
  try {
    const m = DepenseDuMois.getMouvementById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Mouvement non trouvé' });
    res.json(m);
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
};

exports.createMouvement = (req, res) => {
  try {
    if (!req.body.description || !req.body.categorie || (!req.body.debit && !req.body.credit)) {
      return res.status(400).json({ message: 'La description, la catégorie et au moins un montant sont requis' });
    }
    res.status(201).json(DepenseDuMois.createMouvement(req.body));
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
};

exports.updateMouvement = (req, res) => {
  try { res.json(DepenseDuMois.updateMouvement(req.params.id, req.body)); }
  catch (error) { res.status(error.message === 'Mouvement non trouvé' ? 404 : 500).json({ message: error.message || 'Erreur serveur' }); }
};

exports.deleteMouvement = (req, res) => {
  try {
    const success = DepenseDuMois.deleteMouvement(req.params.id);
    if (!success) return res.status(404).json({ message: 'Mouvement non trouvé' });
    res.json({ message: 'Mouvement supprimé avec succès' });
  } catch (error) { res.status(error.message === 'Mouvement non trouvé' ? 404 : 500).json({ message: error.message || 'Erreur serveur' }); }
};

exports.getDepensesFixe = (req, res) => {
  try { res.json(DepenseDuMois.getDepensesFixe()); }
  catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
};

exports.updateDepensesFixe = (req, res) => {
  try { res.json(DepenseDuMois.updateDepensesFixe(req.body)); }
  catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
};

exports.resetMouvements = (req, res) => {
  try {
    const result = DepenseDuMois.resetAllMouvements();
    if (result) res.json({ message: 'Toutes les dépenses du mois ont été réinitialisées avec succès' });
    else res.status(500).json({ message: 'Erreur lors de la réinitialisation des dépenses' });
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
};

exports.checkMonth = (req, res) => {
  try { res.json(DepenseDuMois.checkAndCreateMonthEntry()); }
  catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
};

exports.getRsa = (req, res) => {
  try { res.json(DepenseDuMois.getRsa()); }
  catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
};

exports.updateRsa = (req, res) => {
  try {
    const { montant } = req.body;
    if (!montant && montant !== 0) return res.status(400).json({ message: 'Le montant du RSA est requis' });
    res.json(DepenseDuMois.updateRsa(montant));
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
};

exports.autoAddEntries = (req, res) => {
  try { res.json(DepenseDuMois.autoAddMonthlyEntries()); }
  catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
};
