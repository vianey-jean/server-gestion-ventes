/**
 * Routes API pour la gestion dynamique des ATTRIBUTS PRODUIT.
 *
 * - Un "kind" (type d'attribut) est stocké dans server/db/attribut_kinds.json.
 * - Chaque kind possède sa propre base { id, nom, description, dateCreation }
 *   dans le fichier `<slug>_attribut.json` (sauf les 5 kinds legacy protégés
 *   qui pointent vers modeleproduit.json / tailleproduits.json / etc.).
 *
 * Endpoints
 *   GET    /api/attribut-kinds                       Liste tous les kinds
 *   POST   /api/attribut-kinds                       Crée un kind ({ nom })
 *   PUT    /api/attribut-kinds/:id                   Renomme un kind ({ nom })
 *   DELETE /api/attribut-kinds/:id                   Supprime un kind (+ fichier)
 *   GET    /api/attribut-kinds/:id/values            Valeurs d'un kind
 *   POST   /api/attribut-kinds/:id/values            Ajoute une valeur
 *   PUT    /api/attribut-kinds/:id/values/:vid       Modifie une valeur
 *   DELETE /api/attribut-kinds/:id/values/:vid       Supprime une valeur
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const DB_DIR = path.join(__dirname, '../db');
const KINDS_FILE = path.join(DB_DIR, 'attribut_kinds.json');

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'attribut';
}
function ensureKindsFile() {
  if (!fs.existsSync(KINDS_FILE)) writeJSON(KINDS_FILE, []);
}
function readKinds() { ensureKindsFile(); return readJSON(KINDS_FILE, []); }
function writeKinds(list) { writeJSON(KINDS_FILE, list); }

function fileForKind(kind) {
  return path.join(DB_DIR, kind.fileName);
}
function ensureKindFile(kind) {
  const fp = fileForKind(kind);
  if (!fs.existsSync(fp)) writeJSON(fp, []);
}
function readValues(kind) { ensureKindFile(kind); return readJSON(fileForKind(kind), []); }
function writeValues(kind, values) { writeJSON(fileForKind(kind), values); }

const router = express.Router();

// ----- KINDS -----
router.get('/', authMiddleware, (_req, res) => {
  try { res.json(readKinds()); }
  catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

router.post('/', authMiddleware, (req, res) => {
  try {
    const nom = (req.body?.nom || '').trim();
    if (!nom) return res.status(400).json({ message: 'Nom requis' });
    const kinds = readKinds();
    const dup = kinds.find(k => k.nom.toLowerCase() === nom.toLowerCase());
    if (dup) return res.status(409).json({ message: 'Ce nom existe déjà' });
    const slug = slugify(nom);
    let fileName = `${slug}_attribut.json`;
    // évite collision avec un fichier existant
    let i = 2;
    while (kinds.some(k => k.fileName === fileName) || fs.existsSync(path.join(DB_DIR, fileName))) {
      fileName = `${slug}_${i}_attribut.json`; i++;
    }
    const color = (req.body?.color || '').trim() || 'from-violet-500 to-fuchsia-600';
    const kind = {
      id: 'k_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nom, slug, fileName,
      protected: false,
      color,
      dateCreation: new Date().toISOString(),
    };
    kinds.push(kind);
    writeKinds(kinds);
    ensureKindFile(kind);
    res.status(201).json(kind);
  } catch (e) { console.error('create kind error', e); res.status(500).json({ message: 'Erreur serveur' }); }
});

router.put('/:id', authMiddleware, (req, res) => {
  try {
    const kinds = readKinds();
    const idx = kinds.findIndex(k => k.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Kind non trouvé' });
    const kind = kinds[idx];
    const nomRaw = req.body?.nom;
    const nom = nomRaw !== undefined ? String(nomRaw).trim() : kind.nom;
    if (!nom) return res.status(400).json({ message: 'Nom requis' });
    const dup = kinds.find(k => k.id !== req.params.id && k.nom.toLowerCase() === nom.toLowerCase());
    if (dup) return res.status(409).json({ message: 'Ce nom existe déjà' });
    const renamed = nom !== kind.nom;
    kind.nom = nom;
    if (req.body?.color !== undefined) kind.color = String(req.body.color).trim() || kind.color;
    // Renommer le fichier uniquement pour les kinds non protégés (legacy conservent leur fichier)
    if (!kind.protected && renamed) {
      const newSlug = slugify(nom);
      let newFile = `${newSlug}_attribut.json`;
      let i = 2;
      while ((kinds.some(k => k.id !== kind.id && k.fileName === newFile)) ||
             (newFile !== kind.fileName && fs.existsSync(path.join(DB_DIR, newFile)))) {
        newFile = `${newSlug}_${i}_attribut.json`; i++;
      }
      if (newFile !== kind.fileName) {
        const oldPath = fileForKind(kind);
        const newPath = path.join(DB_DIR, newFile);
        try {
          if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
          else writeJSON(newPath, []);
        } catch (e) { console.error('rename kind file failed', e); }
        kind.slug = newSlug;
        kind.fileName = newFile;
      } else {
        kind.slug = newSlug;
      }
    }
    kinds[idx] = kind;
    writeKinds(kinds);
    res.json(kind);
  } catch (e) { console.error('update kind error', e); res.status(500).json({ message: 'Erreur serveur' }); }
});

router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const kinds = readKinds();
    const kind = kinds.find(k => k.id === req.params.id);
    if (!kind) return res.status(404).json({ message: 'Kind non trouvé' });
    // Suppression autorisée pour tous les kinds (legacy inclus)
    // Supprimer le fichier associé
    try {
      const fp = fileForKind(kind);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch (e) { console.error('delete kind file failed', e); }
    writeKinds(kinds.filter(k => k.id !== req.params.id));
    res.json({ message: 'Supprimé' });
  } catch (e) { console.error('delete kind error', e); res.status(500).json({ message: 'Erreur serveur' }); }
});

// ----- VALEURS D'UN KIND -----
function getKindOr404(req, res) {
  const kind = readKinds().find(k => k.id === req.params.id);
  if (!kind) { res.status(404).json({ message: 'Kind non trouvé' }); return null; }
  return kind;
}

router.get('/:id/values', authMiddleware, (req, res) => {
  try {
    const kind = getKindOr404(req, res); if (!kind) return;
    res.json(readValues(kind));
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

router.post('/:id/values', authMiddleware, (req, res) => {
  try {
    const kind = getKindOr404(req, res); if (!kind) return;
    const nom = (req.body?.nom || '').trim();
    if (!nom) return res.status(400).json({ message: 'Nom requis' });
    const values = readValues(kind);
    const existing = values.find(v => (v.nom || '').toLowerCase() === nom.toLowerCase());
    if (existing) return res.status(200).json(existing);
    const item = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      nom,
      description: (req.body?.description || '').trim(),
      dateCreation: new Date().toISOString(),
    };
    values.push(item);
    writeValues(kind, values);
    res.status(201).json(item);
  } catch (e) { console.error('add value error', e); res.status(500).json({ message: 'Erreur serveur' }); }
});

router.put('/:id/values/:vid', authMiddleware, (req, res) => {
  try {
    const kind = getKindOr404(req, res); if (!kind) return;
    const values = readValues(kind);
    const idx = values.findIndex(v => v.id === req.params.vid);
    if (idx === -1) return res.status(404).json({ message: 'Valeur non trouvée' });
    values[idx] = {
      ...values[idx],
      ...(req.body?.nom !== undefined ? { nom: String(req.body.nom).trim() } : {}),
      ...(req.body?.description !== undefined ? { description: String(req.body.description).trim() } : {}),
    };
    writeValues(kind, values);
    res.json(values[idx]);
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

router.delete('/:id/values/:vid', authMiddleware, (req, res) => {
  try {
    const kind = getKindOr404(req, res); if (!kind) return;
    const values = readValues(kind);
    const next = values.filter(v => v.id !== req.params.vid);
    if (next.length === values.length) return res.status(404).json({ message: 'Valeur non trouvée' });
    writeValues(kind, next);
    res.json({ message: 'Supprimé' });
  } catch { res.status(500).json({ message: 'Erreur serveur' }); }
});

module.exports = router;
