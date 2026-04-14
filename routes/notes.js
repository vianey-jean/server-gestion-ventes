/**
 * notes.js - Routes API pour la gestion des notes (post-its)
 * 
 * CRUD pour les notes avec support de colonnes, dessins et mémos vocaux.
 */
const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Ensure uploads/notes/dessin directory exists
const dessinDir = path.join(__dirname, '..', 'uploads', 'notes', 'dessin');
if (!fs.existsSync(dessinDir)) {
  fs.mkdirSync(dessinDir, { recursive: true });
}

// Upload drawing as JPEG file
router.post('/upload-drawing', auth, (req, res) => {
  try {
    const { drawing } = req.body;
    if (!drawing) return res.status(400).json({ error: 'No drawing data provided' });

    // Parse base64 data URL
    const match = drawing.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data' });

    const ext = match[1] === 'jpeg' || match[1] === 'jpg' ? 'jpeg' : match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename
    const filename = `dessin_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
    const filePath = path.join(dessinDir, filename);

    fs.writeFileSync(filePath, buffer);

    // Return the URL path for the saved file
    const url = `/uploads/notes/dessin/${filename}`;
    res.json({ url, filename });
  } catch (err) {
    console.error('Upload drawing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Notes
router.get('/', auth, (req, res) => {
  try {
    const notes = Note.getAll();
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, (req, res) => {
  try {
    const note = Note.create(req.body);
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, (req, res) => {
  try {
    const note = Note.update(req.params.id, req.body);
    if (!note) return res.status(404).json({ error: 'Note non trouvée' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, (req, res) => {
  try {
    const result = Note.delete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Note non trouvée' });
    res.json({ message: 'Note supprimée' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/move', auth, (req, res) => {
  try {
    const { columnId, order } = req.body;
    const note = Note.moveToColumn(req.params.id, columnId, order);
    if (!note) return res.status(404).json({ error: 'Note non trouvée' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/batch/reorder', auth, (req, res) => {
  try {
    const notes = Note.reorder(req.body.updates);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Columns
router.get('/columns', auth, (req, res) => {
  try {
    const columns = Note.getColumns();
    res.json(columns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/columns', auth, (req, res) => {
  try {
    const column = Note.createColumn(req.body);
    res.status(201).json(column);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/columns/:id', auth, (req, res) => {
  try {
    const column = Note.updateColumn(req.params.id, req.body);
    if (!column) return res.status(404).json({ error: 'Colonne non trouvée' });
    res.json(column);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/columns/:id', auth, (req, res) => {
  try {
    Note.deleteColumn(req.params.id);
    res.json({ message: 'Colonne supprimée' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
