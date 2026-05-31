/**
 * livraisonVille.js - Routes API pour les villes de livraison avec frais
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const filePath = path.join(__dirname, '../db/livraison-ville.json');

const read = () => {
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
};
const write = (arr) => fs.writeFileSync(filePath, JSON.stringify(arr, null, 2));

router.get('/', authMiddleware, (req, res) => {
  res.json(read());
});

router.post('/', authMiddleware, (req, res) => {
  try {
    const { ville, fee } = req.body;
    if (!ville || typeof ville !== 'string' || !ville.trim()) {
      return res.status(400).json({ message: 'Ville requise' });
    }
    const v = ville.trim();
    const f = Number(fee) || 0;
    const list = read();
    const idx = list.findIndex(x => x.ville.toLowerCase() === v.toLowerCase());
    if (idx >= 0) {
      list[idx].fee = f;
    } else {
      list.push({ ville: v, fee: f });
    }
    write(list);
    res.json({ success: true, villes: list });
  } catch (e) {
    console.error('Erreur ajout ville livraison:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT - modifier une ville existante (renommer et/ou changer le frais)
router.put('/:ville', authMiddleware, (req, res) => {
  try {
    const original = decodeURIComponent(req.params.ville || '').trim();
    const { ville, fee } = req.body || {};
    if (!original) return res.status(400).json({ message: 'Ville cible requise' });
    const list = read();
    const idx = list.findIndex(x => x.ville.toLowerCase() === original.toLowerCase());
    if (idx < 0) return res.status(404).json({ message: 'Ville introuvable' });
    const newName = (ville && String(ville).trim()) || list[idx].ville;
    const newFee = fee !== undefined && fee !== null && fee !== '' ? Number(fee) : list[idx].fee;
    // Empêcher doublon si renommage
    if (newName.toLowerCase() !== list[idx].ville.toLowerCase()) {
      const dup = list.findIndex(x => x.ville.toLowerCase() === newName.toLowerCase());
      if (dup >= 0) return res.status(409).json({ message: 'Une ville avec ce nom existe déjà' });
    }
    list[idx] = { ville: newName, fee: Number(newFee) || 0 };
    write(list);
    res.json({ success: true, villes: list });
  } catch (e) {
    console.error('Erreur modif ville livraison:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE - supprimer une ville
router.delete('/:ville', authMiddleware, (req, res) => {
  try {
    const original = decodeURIComponent(req.params.ville || '').trim();
    if (!original) return res.status(400).json({ message: 'Ville cible requise' });
    const list = read();
    const filtered = list.filter(x => x.ville.toLowerCase() !== original.toLowerCase());
    if (filtered.length === list.length) return res.status(404).json({ message: 'Ville introuvable' });
    write(filtered);
    res.json({ success: true, villes: filtered });
  } catch (e) {
    console.error('Erreur suppression ville livraison:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
