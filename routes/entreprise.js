const express = require('express');
const router = express.Router();
const Entreprise = require('../models/Entreprise');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  try {
    const items = Entreprise.getAll();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', authMiddleware, (req, res) => {
  try {
    const item = Entreprise.getById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authMiddleware, (req, res) => {
  try {
    const { nom, adresse, typePaiement, prix } = req.body;
    if (!nom || !typePaiement || prix === undefined) {
      return res.status(400).json({ message: 'Champs requis: nom, typePaiement, prix' });
    }
    const newItem = Entreprise.create({ nom, adresse: adresse || '', typePaiement, prix: Number(prix) });
    if (!newItem) return res.status(500).json({ message: 'Error creating' });
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', authMiddleware, (req, res) => {
  try {
    const updated = Entreprise.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const success = Entreprise.delete(req.params.id);
    if (!success) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
