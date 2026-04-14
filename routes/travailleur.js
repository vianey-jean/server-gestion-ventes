/**
 * travailleur.js - Routes API pour la gestion des travailleurs
 * 
 * CRUD pour les travailleurs utilisés dans le pointage et les tâches.
 */
const express = require('express');
const router = express.Router();
const Travailleur = require('../models/Travailleur');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  try {
    const { search } = req.query;
    if (search) {
      return res.json(Travailleur.search(search));
    }
    res.json(Travailleur.getAll());
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', authMiddleware, (req, res) => {
  try {
    const item = Travailleur.getById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authMiddleware, (req, res) => {
  try {
    const { nom, prenom, adresse, phone, genre, role } = req.body;
    if (!nom || !prenom) {
      return res.status(400).json({ message: 'Nom et prénom requis' });
    }
    const newItem = Travailleur.create({
      nom: nom.trim(),
      prenom: prenom.trim(),
      adresse: adresse ? adresse.trim() : '',
      phone: phone ? phone.trim() : '',
      genre: genre || 'homme',
      role: role || 'autre'
    });
    if (!newItem) return res.status(500).json({ message: 'Error creating' });
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', authMiddleware, (req, res) => {
  try {
    const updated = Travailleur.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const success = Travailleur.delete(req.params.id);
    if (!success) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;