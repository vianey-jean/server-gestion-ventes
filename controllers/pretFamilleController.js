/**
 * PretFamilleController — Logique métier pour les prêts famille
 */
const PretFamille = require('../models/PretFamille');

exports.getAll = (req, res) => {
  try {
    res.json(PretFamille.getAllPretFamilles());
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.getById = (req, res) => {
  try {
    const pf = PretFamille.getPretFamilleById(req.params.id);
    if (!pf) return res.status(404).json({ message: 'Prêt famille non trouvé' });
    res.json(pf);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.create = (req, res) => {
  try {
    if (!req.body.nom) return res.status(400).json({ message: 'Le nom est requis' });
    res.status(201).json(PretFamille.createPretFamille(req.body));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.update = (req, res) => {
  try {
    res.json(PretFamille.updatePretFamille(req.params.id, req.body));
  } catch (error) {
    if (error.message === 'Prêt famille non trouvé') return res.status(404).json({ message: error.message });
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.remove = (req, res) => {
  try {
    const success = PretFamille.deletePretFamille(req.params.id);
    if (!success) return res.status(404).json({ message: 'Prêt famille non trouvé' });
    res.json({ message: 'Prêt famille supprimé avec succès' });
  } catch (error) {
    if (error.message === 'Prêt famille non trouvé') return res.status(404).json({ message: error.message });
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.search = (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 3) return res.status(400).json({ message: 'Min 3 caractères' });
    res.json(PretFamille.searchPretFamillesByName(query));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
