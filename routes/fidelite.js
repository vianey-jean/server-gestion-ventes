/**
 * Routes de fidélité client.
 * GET /api/fidelite         -> map complet
 * GET /api/fidelite/:name   -> entrée pour un client
 * POST /api/fidelite/rebuild -> reconstruction depuis sales.json
 */
const express = require('express');
const router = express.Router();
const Fidelite = require('../models/Fidelite');

router.get('/', (req, res) => {
  try {
    res.json(Fidelite.getAll());
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:name', (req, res) => {
  try {
    res.json(Fidelite.getByName(req.params.name));
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/rebuild', (req, res) => {
  try {
    const data = Fidelite.rebuild();
    res.json({ ok: true, count: Object.keys(data).length });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
