/**
 * tachesRdv.js - Catalogue des types de tâches RDV (tissage, tresse, perruque, etc.)
 * Stocke dans server/db/taches-rdv.json
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const FILE = path.join(__dirname, '../db/taches-rdv.json');

const read = () => {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
};
const write = (data) => fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

router.get('/', (req, res) => {
  try { res.json(read()); }
  catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.post('/', (req, res) => {
  try {
    const { nom, description } = req.body;
    if (!nom || !String(nom).trim()) {
      return res.status(400).json({ error: 'Nom requis' });
    }
    const items = read();
    const exists = items.find(t => String(t.nom).trim().toLowerCase() === String(nom).trim().toLowerCase());
    if (exists) return res.status(409).json({ error: 'Cette tâche existe déjà' });
    const item = {
      id: Date.now().toString(),
      nom: String(nom).trim(),
      description: description ? String(description).trim() : '',
      createdAt: new Date().toISOString()
    };
    items.push(item);
    write(items);
    res.status(201).json(item);
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.put('/:id', (req, res) => {
  try {
    const items = read();
    const idx = items.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Introuvable' });
    items[idx] = { ...items[idx], ...req.body, id: items[idx].id };
    write(items);
    res.json(items[idx]);
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.delete('/:id', (req, res) => {
  try {
    const items = read();
    const filtered = items.filter(t => t.id !== req.params.id);
    if (filtered.length === items.length) return res.status(404).json({ error: 'Introuvable' });
    write(filtered);
    res.json({ message: 'Supprimé' });
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;
