/**
 * clientsVilles.js - Routes API pour la liste des villes des clients
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const filePath = path.join(__dirname, '../db/clients-villes.json');

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
    const { ville } = req.body;
    if (!ville || typeof ville !== 'string' || !ville.trim()) {
      return res.status(400).json({ message: 'Ville requise' });
    }
    const v = ville.trim();
    const list = read();
    const exists = list.some(x => x.toLowerCase() === v.toLowerCase());
    if (!exists) {
      list.push(v);
      write(list);
    }
    res.json({ success: true, villes: list });
  } catch (e) {
    console.error('Erreur ajout ville client:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
