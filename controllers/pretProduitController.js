/**
 * PretProduitController — Logique métier pour les prêts produits
 */
const PretProduit = require('../models/PretProduit');

exports.getAll = (req, res) => {
  try {
    res.json(PretProduit.getAllPretProduits());
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.search = (req, res) => {
  try {
    const { nom } = req.query;
    if (!nom || nom.length < 3) return res.status(400).json({ message: 'Min 3 caractères' });

    const allPretProduits = PretProduit.getAllPretProduits();
    const searchTerm = nom.toLowerCase();
    const filtered = allPretProduits.filter(pret => pret.nom && pret.nom.toLowerCase().includes(searchTerm));
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.getById = (req, res) => {
  try {
    const pp = PretProduit.getPretProduitById(req.params.id);
    if (!pp) return res.status(404).json({ message: 'Prêt produit non trouvé' });
    res.json(pp);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.create = (req, res) => {
  try {
    if (!req.body.description || !req.body.prixVente) {
      return res.status(400).json({ message: 'Description et prix de vente requis' });
    }
    res.status(201).json(PretProduit.createPretProduit(req.body));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.update = (req, res) => {
  try {
    res.json(PretProduit.updatePretProduit(req.params.id, req.body));
  } catch (error) {
    if (error.message === 'Prêt produit non trouvé') return res.status(404).json({ message: error.message });
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.remove = (req, res) => {
  try {
    const success = PretProduit.deletePretProduit(req.params.id);
    if (!success) return res.status(404).json({ message: 'Prêt produit non trouvé' });
    res.json({ message: 'Prêt produit supprimé avec succès' });
  } catch (error) {
    if (error.message === 'Prêt produit non trouvé') return res.status(404).json({ message: error.message });
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.transfer = (req, res) => {
  try {
    const { fromName, toName, pretIds } = req.body;
    if (!fromName || !toName || !pretIds || !Array.isArray(pretIds)) {
      return res.status(400).json({ message: 'fromName, toName et pretIds requis' });
    }
    if (fromName === toName) return res.status(400).json({ message: 'Noms source et destination différents requis' });

    const result = PretProduit.transferPrets(fromName, toName, pretIds);
    res.json({ message: 'Prêts transférés avec succès', transferred: result });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Erreur serveur' });
  }
};
