/**
 * =============================================================================
 * Contrôleurs CRUD simples - Entités secondaires
 * =============================================================================
 * 
 * Ce fichier regroupe les contrôleurs des entités avec une logique CRUD simple :
 * - Entreprise, Travailleur, Fournisseur, Avance
 * - PretFamille, PretProduit, NouvelleAchat, Compta
 * - RdvNotification, Note
 * 
 * @module controllers/crudControllers
 */

// ===== ENTREPRISE =====
const Entreprise = require('../models/Entreprise');
exports.entreprise = {
  getAll: (req, res) => { try { res.json(Entreprise.getAll()); } catch { res.status(500).json({ message: 'Server error' }); } },
  getById: (req, res) => { try { const i = Entreprise.getById(req.params.id); if (!i) return res.status(404).json({ message: 'Not found' }); res.json(i); } catch { res.status(500).json({ message: 'Server error' }); } },
  create: (req, res) => {
    try {
      const { nom, adresse, typePaiement, prix } = req.body;
      if (!nom || !typePaiement || prix === undefined) return res.status(400).json({ message: 'Champs requis: nom, typePaiement, prix' });
      const n = Entreprise.create({ nom, adresse: adresse || '', typePaiement, prix: Number(prix) });
      if (!n) return res.status(500).json({ message: 'Error creating' });
      res.status(201).json(n);
    } catch { res.status(500).json({ message: 'Server error' }); }
  },
  update: (req, res) => { try { const u = Entreprise.update(req.params.id, req.body); if (!u) return res.status(404).json({ message: 'Not found' }); res.json(u); } catch { res.status(500).json({ message: 'Server error' }); } },
  delete: (req, res) => { try { if (!Entreprise.delete(req.params.id)) return res.status(404).json({ message: 'Not found' }); res.json({ message: 'Deleted successfully' }); } catch { res.status(500).json({ message: 'Server error' }); } }
};

// ===== TRAVAILLEUR =====
const Travailleur = require('../models/Travailleur');
exports.travailleur = {
  getAll: (req, res) => { try { if (req.query.search) return res.json(Travailleur.search(req.query.search)); res.json(Travailleur.getAll()); } catch { res.status(500).json({ message: 'Server error' }); } },
  getById: (req, res) => { try { const i = Travailleur.getById(req.params.id); if (!i) return res.status(404).json({ message: 'Not found' }); res.json(i); } catch { res.status(500).json({ message: 'Server error' }); } },
  create: (req, res) => {
    try {
      const { nom, prenom, adresse, phone, genre, role } = req.body;
      if (!nom || !prenom) return res.status(400).json({ message: 'Nom et prénom requis' });
      const n = Travailleur.create({ nom: nom.trim(), prenom: prenom.trim(), adresse: adresse?.trim() || '', phone: phone?.trim() || '', genre: genre || 'homme', role: role || 'autre' });
      if (!n) return res.status(500).json({ message: 'Error creating' });
      res.status(201).json(n);
    } catch { res.status(500).json({ message: 'Server error' }); }
  },
  update: (req, res) => { try { const u = Travailleur.update(req.params.id, req.body); if (!u) return res.status(404).json({ message: 'Not found' }); res.json(u); } catch { res.status(500).json({ message: 'Server error' }); } },
  delete: (req, res) => { try { if (!Travailleur.delete(req.params.id)) return res.status(404).json({ message: 'Not found' }); res.json({ message: 'Deleted successfully' }); } catch { res.status(500).json({ message: 'Server error' }); } }
};

// ===== FOURNISSEUR =====
const Fournisseur = require('../models/Fournisseur');
exports.fournisseur = {
  getAll: async (req, res) => { try { res.json(Fournisseur.getAll()); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  search: async (req, res) => { try { res.json(Fournisseur.search(req.query.q || '')); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  create: async (req, res) => {
    try {
      const { nom } = req.body;
      if (!nom || nom.trim() === '') return res.status(400).json({ message: 'Le nom est requis' });
      res.status(201).json(Fournisseur.createIfNotExists(nom));
    } catch { res.status(500).json({ message: 'Erreur serveur' }); }
  },
  delete: async (req, res) => {
    try { if (!Fournisseur.delete(req.params.id)) return res.status(404).json({ message: 'Fournisseur non trouvé' }); res.json({ message: 'Fournisseur supprimé' }); }
    catch { res.status(500).json({ message: 'Erreur serveur' }); }
  }
};

// ===== AVANCE =====
const Avance = require('../models/Avance');
exports.avance = {
  getAll: (req, res) => {
    try {
      const { travailleurId, month, year } = req.query;
      if (travailleurId && month && year) return res.json(Avance.getByTravailleur(travailleurId, parseInt(month), parseInt(year)));
      res.json(Avance.getAll());
    } catch (err) { res.status(500).json({ error: err.message }); }
  },
  create: (req, res) => { try { res.status(201).json(Avance.create(req.body)); } catch (err) { res.status(500).json({ error: err.message }); } },
  delete: (req, res) => { try { Avance.delete(req.params.id); res.json({ message: 'Avance supprimée' }); } catch (err) { res.status(500).json({ error: err.message }); } }
};

// ===== PRET FAMILLE =====
const PretFamille = require('../models/PretFamille');
exports.pretFamille = {
  getAll: (req, res) => { try { res.json(PretFamille.getAllPretFamilles()); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  getById: (req, res) => { try { const p = PretFamille.getPretFamilleById(req.params.id); if (!p) return res.status(404).json({ message: 'Prêt famille non trouvé' }); res.json(p); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  create: (req, res) => { try { if (!req.body.nom) return res.status(400).json({ message: 'Le nom est requis' }); res.status(201).json(PretFamille.createPretFamille(req.body)); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  update: (req, res) => { try { res.json(PretFamille.updatePretFamille(req.params.id, req.body)); } catch (e) { res.status(e.message === 'Prêt famille non trouvé' ? 404 : 500).json({ message: e.message || 'Erreur serveur' }); } },
  delete: (req, res) => { try { if (!PretFamille.deletePretFamille(req.params.id)) return res.status(404).json({ message: 'Prêt famille non trouvé' }); res.json({ message: 'Prêt famille supprimé avec succès' }); } catch (e) { res.status(e.message === 'Prêt famille non trouvé' ? 404 : 500).json({ message: e.message || 'Erreur serveur' }); } },
  search: (req, res) => { try { const q = req.query.q; if (!q || q.length < 3) return res.status(400).json({ message: '3 caractères minimum' }); res.json(PretFamille.searchPretFamillesByName(q)); } catch { res.status(500).json({ message: 'Erreur serveur' }); } }
};

// ===== PRET PRODUIT =====
const PretProduit = require('../models/PretProduit');
exports.pretProduit = {
  getAll: (req, res) => { try { res.json(PretProduit.getAllPretProduits()); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  search: (req, res) => {
    try {
      const { nom } = req.query;
      if (!nom || nom.length < 3) return res.status(400).json({ message: '3 caractères minimum' });
      const all = PretProduit.getAllPretProduits();
      res.json(all.filter(p => p.nom && p.nom.toLowerCase().includes(nom.toLowerCase())));
    } catch { res.status(500).json({ message: 'Erreur serveur' }); }
  },
  getById: (req, res) => { try { const p = PretProduit.getPretProduitById(req.params.id); if (!p) return res.status(404).json({ message: 'Prêt produit non trouvé' }); res.json(p); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  create: (req, res) => { try { if (!req.body.description || !req.body.prixVente) return res.status(400).json({ message: 'Description et prix requis' }); res.status(201).json(PretProduit.createPretProduit(req.body)); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  update: (req, res) => { try { res.json(PretProduit.updatePretProduit(req.params.id, req.body)); } catch (e) { res.status(e.message === 'Prêt produit non trouvé' ? 404 : 500).json({ message: e.message || 'Erreur serveur' }); } },
  delete: (req, res) => { try { if (!PretProduit.deletePretProduit(req.params.id)) return res.status(404).json({ message: 'Prêt produit non trouvé' }); res.json({ message: 'Prêt produit supprimé avec succès' }); } catch (e) { res.status(e.message === 'Prêt produit non trouvé' ? 404 : 500).json({ message: e.message || 'Erreur serveur' }); } },
  transfer: (req, res) => {
    try {
      const { fromName, toName, pretIds } = req.body;
      if (!fromName || !toName || !pretIds || !Array.isArray(pretIds)) return res.status(400).json({ message: 'Paramètres requis' });
      if (fromName === toName) return res.status(400).json({ message: 'Noms source et destination doivent être différents' });
      res.json({ message: 'Prêts transférés avec succès', transferred: PretProduit.transferPrets(fromName, toName, pretIds) });
    } catch (e) { res.status(500).json({ message: e.message || 'Erreur serveur' }); }
  }
};

// ===== NOUVELLE ACHAT =====
const NouvelleAchat = require('../models/NouvelleAchat');
exports.nouvelleAchat = {
  getAll: async (req, res) => { try { res.json(NouvelleAchat.getAll()); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  getMonthly: async (req, res) => { try { res.json(NouvelleAchat.getByMonthYear(parseInt(req.params.month), parseInt(req.params.year))); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  getYearly: async (req, res) => { try { res.json(NouvelleAchat.getByYear(parseInt(req.params.year))); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  getMonthlyStats: async (req, res) => { try { res.json(NouvelleAchat.getMonthlyStats(parseInt(req.params.month), parseInt(req.params.year))); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  getYearlyStats: async (req, res) => { try { res.json(NouvelleAchat.getYearlyStats(parseInt(req.params.year))); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  getById: async (req, res) => { try { const a = NouvelleAchat.getById(req.params.id); if (!a) return res.status(404).json({ message: 'Achat non trouvé' }); res.json(a); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  create: async (req, res) => {
    try {
      const { productId, productDescription, purchasePrice, quantity, fournisseur, caracteristiques } = req.body;
      if (!productDescription || purchasePrice === undefined || quantity === undefined) return res.status(400).json({ message: 'Description, prix et quantité requis' });
      const data = { productId, productDescription, purchasePrice: Number(purchasePrice), quantity: Number(quantity), fournisseur: fournisseur || '', caracteristiques: caracteristiques || '', date: req.body.date || new Date().toISOString() };
      const n = NouvelleAchat.create(data);
      if (!n) return res.status(500).json({ message: 'Erreur création' });
      if (data.fournisseur.trim()) Fournisseur.createIfNotExists(data.fournisseur);
      res.status(201).json(n);
    } catch { res.status(500).json({ message: 'Erreur serveur' }); }
  },
  addDepense: async (req, res) => {
    try {
      const { description, montant, type, categorie } = req.body;
      if (!description || montant === undefined) return res.status(400).json({ message: 'Description et montant requis' });
      const n = NouvelleAchat.addDepense({ description, montant: Number(montant), type: type || 'autre_depense', categorie: categorie || 'divers', date: req.body.date || new Date().toISOString() });
      if (!n) return res.status(500).json({ message: 'Erreur ajout dépense' });
      res.status(201).json(n);
    } catch { res.status(500).json({ message: 'Erreur serveur' }); }
  },
  update: async (req, res) => { try { const u = NouvelleAchat.update(req.params.id, req.body); if (!u) return res.status(404).json({ message: 'Achat non trouvé' }); res.json(u); } catch { res.status(500).json({ message: 'Erreur serveur' }); } },
  delete: async (req, res) => { try { if (!NouvelleAchat.delete(req.params.id)) return res.status(404).json({ message: 'Achat non trouvé' }); res.json({ message: 'Achat supprimé avec succès' }); } catch { res.status(500).json({ message: 'Erreur serveur' }); } }
};

// ===== COMPTA =====
const Compta = require('../models/Compta');
exports.compta = {
  getAll: (req, res) => { try { res.json(Compta.getAll()); } catch { res.status(500).json({ error: 'Erreur serveur' }); } },
  getMonthly: (req, res) => {
    try {
      const data = Compta.getByMonthYear(parseInt(req.params.month), parseInt(req.params.year));
      res.json(data || Compta.calculateAndSave(parseInt(req.params.month), parseInt(req.params.year)));
    } catch { res.status(500).json({ error: 'Erreur serveur' }); }
  },
  getYearly: (req, res) => { try { res.json(Compta.getByYear(parseInt(req.params.year))); } catch { res.status(500).json({ error: 'Erreur serveur' }); } },
  getSummary: (req, res) => {
    try {
      const yr = parseInt(req.params.year);
      let summary = Compta.getYearlySummary(yr);
      if (!summary) { Compta.recalculateYear(yr); summary = Compta.getYearlySummary(yr); }
      res.json(summary || { year: yr, message: 'Aucune donnée' });
    } catch { res.status(500).json({ error: 'Erreur serveur' }); }
  },
  calculate: (req, res) => {
    try {
      const result = Compta.calculateAndSave(parseInt(req.params.month), parseInt(req.params.year));
      if (!result) return res.status(500).json({ error: 'Erreur de calcul' });
      res.json(result);
    } catch { res.status(500).json({ error: 'Erreur serveur' }); }
  },
  recalculateYear: (req, res) => {
    try {
      const yr = parseInt(req.params.year);
      const results = Compta.recalculateYear(yr);
      res.json({ year: yr, months: results.length, data: results });
    } catch { res.status(500).json({ error: 'Erreur serveur' }); }
  }
};

// ===== RDV NOTIFICATIONS =====
const RdvNotification = require('../models/RdvNotification');
const Rdv = require('../models/Rdv');
exports.rdvNotification = {
  getAll: async (req, res) => { try { res.json(RdvNotification.getAll()); } catch { res.status(500).json({ message: 'Server error' }); } },
  getUnread: async (req, res) => { try { res.json(RdvNotification.getUnread()); } catch { res.status(500).json({ message: 'Server error' }); } },
  getCount: async (req, res) => { try { res.json({ count: RdvNotification.getUnreadCount() }); } catch { res.status(500).json({ message: 'Server error' }); } },
  check: async (req, res) => { try { const created = RdvNotification.checkAndCreateNotifications(Rdv.getAll()); res.json({ created: created.length, notifications: created }); } catch { res.status(500).json({ message: 'Server error' }); } },
  markAsRead: async (req, res) => { try { if (!RdvNotification.markAsRead(req.params.id)) return res.status(404).json({ message: 'Notification not found' }); res.json({ success: true }); } catch { res.status(500).json({ message: 'Server error' }); } },
  delete: async (req, res) => { try { if (!RdvNotification.delete(req.params.id)) return res.status(404).json({ message: 'Notification not found' }); res.json({ success: true }); } catch { res.status(500).json({ message: 'Server error' }); } },
  getByRdvId: async (req, res) => { try { const n = RdvNotification.getByRdvId(req.params.rdvId); if (!n) return res.status(404).json({ message: 'Notification not found' }); res.json(n); } catch { res.status(500).json({ message: 'Server error' }); } },
  updateStatus: async (req, res) => { try { if (!req.body.status) return res.status(400).json({ message: 'Status is required' }); if (!RdvNotification.updateStatus(req.params.rdvId, req.body.status)) return res.status(404).json({ message: 'Not found' }); res.json({ success: true }); } catch { res.status(500).json({ message: 'Server error' }); } },
  updateByRdvId: async (req, res) => { try { const n = RdvNotification.updateByRdvId(req.params.rdvId, req.body); if (!n) return res.status(404).json({ message: 'Not found' }); res.json(n); } catch { res.status(500).json({ message: 'Server error' }); } },
  deleteByRdvId: async (req, res) => { try { res.json({ success: RdvNotification.deleteByRdvId(req.params.rdvId) }); } catch { res.status(500).json({ message: 'Server error' }); } }
};
