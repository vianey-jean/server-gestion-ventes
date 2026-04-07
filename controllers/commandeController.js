/**
 * =============================================================================
 * Contrôleur Commandes - Logique métier des commandes/réservations
 * =============================================================================
 * @module controllers/commandeController
 */

const Commande = require('../models/Commande');
const { checkIndisponibilite } = require('../services/availabilityService');

exports.getAll = async (req, res) => {
  try { res.json(await Commande.getAll()); }
  catch (error) { console.error('Error fetching commandes:', error); res.status(500).json({ message: 'Error fetching commandes' }); }
};

exports.getById = async (req, res) => {
  try {
    const commande = await Commande.getById(req.params.id);
    if (!commande) return res.status(404).json({ message: 'Commande not found' });
    res.json(commande);
  } catch (error) { res.status(500).json({ message: 'Error fetching commande' }); }
};

exports.create = async (req, res) => {
  try {
    const { date, dateLivraison, horaire } = req.body;
    const checkDate = dateLivraison || date;
    if (checkDate && horaire) {
      const [heureDebut] = horaire.split('-').map(h => h?.trim());
      const indispoCheck = checkIndisponibilite(checkDate, heureDebut || '00:00', '23:59');
      if (!indispoCheck.disponible) {
        return res.status(409).json({ message: `🚫 ${indispoCheck.message}. Impossible de créer une réservation pendant un créneau indisponible.` });
      }
    }
    res.status(201).json(await Commande.create(req.body));
  } catch (error) { res.status(500).json({ message: 'Error creating commande' }); }
};

exports.update = async (req, res) => {
  try { res.json(await Commande.update(req.params.id, req.body)); }
  catch (error) { res.status(500).json({ message: 'Error updating commande' }); }
};

exports.delete = async (req, res) => {
  try {
    await Commande.delete(req.params.id);
    res.json({ message: 'Commande deleted successfully' });
  } catch (error) { res.status(500).json({ message: 'Error deleting commande' }); }
};
