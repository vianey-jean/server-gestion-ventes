
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');

// Créer un nouveau message (accessible sans authentification)
router.post('/', async (req, res) => {
  try {
    const { expediteurNom, expediteurEmail, expediteurTelephone, sujet, contenu, destinataireId } = req.body;

    if (!expediteurNom || !expediteurEmail || !sujet || !contenu || !destinataireId) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
    }

    const newMessage = Message.create({
      expediteurNom,
      expediteurEmail,
      expediteurTelephone,
      sujet,
      contenu,
      destinataireId
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ message: 'Erreur lors de la création du message' });
  }
});

// Récupérer les messages de l'utilisateur connecté
router.get('/', authMiddleware, (req, res) => {
  try {
    const messages = Message.getByUserId(req.user.id);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des messages' });
  }
});

// Récupérer le nombre de messages non lus
router.get('/unread-count', authMiddleware, (req, res) => {
  try {
    const count = Message.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du compteur' });
  }
});

// Marquer un message comme lu
router.put('/:id/read', authMiddleware, (req, res) => {
  try {
    const updatedMessage = Message.markAsRead(req.params.id, req.user.id);
    if (updatedMessage) {
      res.json(updatedMessage);
    } else {
      res.status(404).json({ message: 'Message non trouvé' });
    }
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du message' });
  }
});

// Marquer un message comme non lu
router.put('/:id/unread', authMiddleware, (req, res) => {
  try {
    const updatedMessage = Message.markAsUnread(req.params.id, req.user.id);
    if (updatedMessage) {
      res.json(updatedMessage);
    } else {
      res.status(404).json({ message: 'Message non trouvé' });
    }
  } catch (error) {
    console.error('Error marking message as unread:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du message' });
  }
});

// Supprimer un message
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const deleted = Message.delete(req.params.id, req.user.id);
    if (deleted) {
      res.json({ message: 'Message supprimé avec succès' });
    } else {
      res.status(404).json({ message: 'Message non trouvé' });
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du message' });
  }
});

module.exports = router;
