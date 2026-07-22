/**
 * Routes CRUD des paliers de fidélité (listes-fidelite.json).
 * Chaque modification déclenche un rebuild de fidelite.json pour resynchroniser
 * les tiers de tous les clients.
 */
const express = require('express');
const router = express.Router();
const ListesFidelite = require('../models/ListesFidelite');
const Fidelite = require('../models/Fidelite');

const rebuild = () => { try { Fidelite.rebuild(); } catch (e) { console.error('Fidelite rebuild:', e); } };

router.get('/', (_req, res) => {
  try { res.json(ListesFidelite.getAll()); }
  catch { res.status(500).json({ message: 'Server error' }); }
});

router.put('/', (req, res) => {
  const list = Array.isArray(req.body?.list) ? req.body.list : null;
  if (!list) return res.status(400).json({ message: 'Liste invalide.' });
  const r = ListesFidelite.replace(list);
  if (!r.ok) return res.status(400).json({ message: r.error });
  rebuild();
  res.json(r.list);
});

router.post('/', (req, res) => {
  const r = ListesFidelite.add(req.body || {});
  if (!r.ok) return res.status(400).json({ message: r.error });
  rebuild();
  res.json(r.list);
});

router.put('/:id', (req, res) => {
  const r = ListesFidelite.update(req.params.id, req.body || {});
  if (!r.ok) return res.status(400).json({ message: r.error });
  rebuild();
  res.json(r.list);
});

router.delete('/:id', (req, res) => {
  const r = ListesFidelite.remove(req.params.id);
  if (!r.ok) return res.status(400).json({ message: r.error });
  rebuild();
  res.json(r.list);
});

module.exports = router;
