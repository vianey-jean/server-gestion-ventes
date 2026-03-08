const express = require('express');
const router = express.Router();
const Avance = require('../models/Avance');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  try {
    const { travailleurId, month, year } = req.query;
    if (travailleurId && month && year) {
      const avances = Avance.getByTravailleur(travailleurId, parseInt(month), parseInt(year));
      return res.json(avances);
    }
    res.json(Avance.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, (req, res) => {
  try {
    const avance = Avance.create(req.body);
    res.status(201).json(avance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, (req, res) => {
  try {
    Avance.delete(req.params.id);
    res.json({ message: 'Avance supprimée' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
