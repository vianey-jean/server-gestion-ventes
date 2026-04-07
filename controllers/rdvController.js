/**
 * =============================================================================
 * Contrôleur RDV - Logique métier des rendez-vous
 * =============================================================================
 * @module controllers/rdvController
 */

const Rdv = require('../models/Rdv');
const Client = require('../models/Client');
const RdvNotification = require('../models/RdvNotification');
const { checkIndisponibilite } = require('../services/availabilityService');

exports.getAll = async (req, res) => {
  try { res.json(Rdv.getAll()); }
  catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.search = async (req, res) => {
  try { res.json(!req.query.q ? [] : Rdv.search(req.query.q)); }
  catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.searchClients = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 3) return res.json([]);
    const clients = Client.getAll();
    const lowerQuery = q.toLowerCase();
    res.json(clients.filter(c => c.nom.toLowerCase().includes(lowerQuery)).slice(0, 10));
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.getByWeek = async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ message: 'Start and end dates are required' });
    res.json(Rdv.getByDateRange(start, end));
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.checkConflicts = async (req, res) => {
  try {
    const { date, heureDebut, heureFin, excludeId } = req.query;
    if (!date || !heureDebut || !heureFin) return res.status(400).json({ message: 'Date, heureDebut and heureFin are required' });
    res.json(Rdv.checkConflicts(date, heureDebut, heureFin, excludeId));
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.getById = async (req, res) => {
  try {
    const rdv = Rdv.getById(req.params.id);
    if (!rdv) return res.status(404).json({ message: 'RDV not found' });
    res.json(rdv);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.create = async (req, res) => {
  try {
    const { titre, clientNom, date, heureDebut, heureFin } = req.body;
    if (!titre || !clientNom || !date || !heureDebut || !heureFin) {
      return res.status(400).json({ message: 'Titre, clientNom, date, heureDebut et heureFin sont obligatoires' });
    }
    const indispoCheck = checkIndisponibilite(date, heureDebut, heureFin);
    if (!indispoCheck.disponible) {
      return res.status(409).json({ message: `🚫 ${indispoCheck.message}. Impossible de créer un RDV pendant un créneau indisponible.` });
    }
    const newRdv = Rdv.create(req.body);
    if (!newRdv) return res.status(500).json({ message: 'Error creating rdv' });
    RdvNotification.create(newRdv);
    res.status(201).json(newRdv);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.update = async (req, res) => {
  try {
    const oldRdv = Rdv.getById(req.params.id);
    const updatedRdv = Rdv.update(req.params.id, req.body);
    if (!updatedRdv) return res.status(404).json({ message: 'RDV not found' });

    if (req.body.statut) {
      if (['annule', 'termine', 'valide'].includes(req.body.statut)) RdvNotification.updateStatus(req.params.id, req.body.statut);
      else if (req.body.statut === 'reporte') RdvNotification.updateByRdvId(req.params.id, updatedRdv);
    } else if (oldRdv && (oldRdv.date !== updatedRdv.date || oldRdv.heureDebut !== updatedRdv.heureDebut)) {
      RdvNotification.updateByRdvId(req.params.id, updatedRdv);
    }
    res.json(updatedRdv);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.updateByCommande = async (req, res) => {
  try {
    const oldRdv = Rdv.getByCommandeId(req.params.commandeId);
    const updatedRdv = Rdv.updateByCommandeId(req.params.commandeId, req.body);
    if (!updatedRdv) return res.status(404).json({ message: 'RDV not found for this commande' });

    if (req.body.statut) {
      if (['annule', 'termine', 'valide'].includes(req.body.statut)) RdvNotification.updateStatus(updatedRdv.id, req.body.statut);
      else if (req.body.statut === 'reporte') RdvNotification.updateByRdvId(updatedRdv.id, updatedRdv);
    } else if (oldRdv && (oldRdv.date !== updatedRdv.date || oldRdv.heureDebut !== updatedRdv.heureDebut)) {
      RdvNotification.updateByRdvId(updatedRdv.id, updatedRdv);
    }
    res.json(updatedRdv);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.delete = async (req, res) => {
  try {
    RdvNotification.deleteByRdvId(req.params.id);
    const success = Rdv.delete(req.params.id);
    if (!success) return res.status(404).json({ message: 'RDV not found' });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};
