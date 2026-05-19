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
const multer = require('multer');

// Ensure uploads/notes/dessin directory exists
const dessinDir = path.join(__dirname, '..', 'uploads', 'notes', 'dessin');
if (!fs.existsSync(dessinDir)) {
  fs.mkdirSync(dessinDir, { recursive: true });
}

// Ensure uploads/notes/fichier directory exists
const fichierDir = path.join(__dirname, '..', 'uploads', 'notes', 'fichier');
if (!fs.existsSync(fichierDir)) {
  fs.mkdirSync(fichierDir, { recursive: true });
}

// Multer storage for note files (images, pdf, word, txt, etc.)
const fichierStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, fichierDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '';
    // Sanitize base name
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    cb(null, `note_${uniqueSuffix}_${base}${ext}`);
  }
});
const uploadFichier = multer({
  storage: fichierStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// Upload single note attachment file (legacy / backward compat)
router.post('/upload-fichier', auth, uploadFichier.single('fichier'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
    const url = `/uploads/notes/fichier/${req.file.filename}`;
    res.json({
      url,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
  } catch (err) {
    console.error('Upload fichier error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upload multiple note attachment files
router.post('/upload-fichiers', auth, uploadFichier.array('fichiers', 20), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    const out = req.files.map(f => ({
      url: `/uploads/notes/fichier/${f.filename}`,
      filename: f.filename,
      originalName: f.originalname,
      mimeType: f.mimetype,
      size: f.size
    }));
    res.json(out);
  } catch (err) {
    console.error('Upload fichiers error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a specific attached file from disk (used when removing inline)
router.delete('/fichier', auth, (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string' || !url.startsWith('/uploads/notes/fichier/')) {
      return res.status(400).json({ error: 'URL invalide' });
    }
    const safe = path.normalize(url).replace(/^[\\/]+/, '');
    const full = path.join(__dirname, '..', safe);
    if (fs.existsSync(full)) fs.unlinkSync(full);
    res.json({ message: 'Fichier supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
