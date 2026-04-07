/**
 * =============================================================================
 * Contrôleur Messages - Logique métier des messages contact
 * =============================================================================
 * @module controllers/messageController
 */

const Message = require('../models/Message');

exports.create = async (req, res) => {
  try {
    const { expediteurNom, expediteurEmail, expediteurTelephone, sujet, contenu, destinataireId } = req.body;
    if (!expediteurNom || !expediteurEmail || !sujet || !contenu || !destinataireId) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
    }
    res.status(201).json(Message.create({ expediteurNom, expediteurEmail, expediteurTelephone, sujet, contenu, destinataireId }));
  } catch (error) { res.status(500).json({ message: 'Erreur lors de la création du message' }); }
};

exports.getByUser = (req, res) => {
  try { res.json(Message.getByUserId(req.user.id)); }
  catch (error) { res.status(500).json({ message: 'Erreur lors de la récupération des messages' }); }
};

exports.getUnreadCount = (req, res) => {
  try { res.json({ count: Message.getUnreadCount(req.user.id) }); }
  catch (error) { res.status(500).json({ message: 'Erreur lors de la récupération du compteur' }); }
};

exports.markAsRead = (req, res) => {
  try {
    const msg = Message.markAsRead(req.params.id, req.user.id);
    if (msg) res.json(msg); else res.status(404).json({ message: 'Message non trouvé' });
  } catch (error) { res.status(500).json({ message: 'Erreur lors de la mise à jour du message' }); }
};

exports.markAsUnread = (req, res) => {
  try {
    const msg = Message.markAsUnread(req.params.id, req.user.id);
    if (msg) res.json(msg); else res.status(404).json({ message: 'Message non trouvé' });
  } catch (error) { res.status(500).json({ message: 'Erreur lors de la mise à jour du message' }); }
};

exports.delete = (req, res) => {
  try {
    const deleted = Message.delete(req.params.id, req.user.id);
    if (deleted) res.json({ message: 'Message supprimé avec succès' }); else res.status(404).json({ message: 'Message non trouvé' });
  } catch (error) { res.status(500).json({ message: 'Erreur lors de la suppression du message' }); }
};
