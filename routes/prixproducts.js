/**
 * prixproducts.js - Routes API pour l'historique des prix d'achat
 *
 * Enregistre chaque variation de prix d'achat (augmentation, diminution, stable)
 * avec tous les renseignements du produit pour générer des graphes d'évolution.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const auth = require('../middleware/auth');

const DB_FILE = path.join(__dirname, '..', 'db', 'prixproducts.json');

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const init = { entries: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2));
      return init;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(raw || '{}');
    return { entries: Array.isArray(data.entries) ? data.entries : [] };
  } catch (e) {
    console.error('prixproducts readDb error:', e);
    return { entries: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// GET toutes les entrées
router.get('/', auth, (req, res) => {
  try {
    res.json(readDb());
  } catch (e) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET entrées pour un produit donné
router.get('/product/:productId', auth, (req, res) => {
  try {
    const db = readDb();
    const list = db.entries.filter(e => String(e.productId) === String(req.params.productId));
    res.json({ entries: list });
  } catch (e) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST nouvelle entrée d'achat / variation de prix
router.post('/', auth, (req, res) => {
  try {
    const {
      productId,
      productDescription,
      purchasePrice,
      previousPrice,
      quantity,
      disponible,
      fournisseur,
      caracteristiques,
      date,
      isNewProduct
    } = req.body;

    if (!productDescription || purchasePrice === undefined) {
      return res.status(400).json({ message: 'productDescription et purchasePrice requis' });
    }

    const price = Number(purchasePrice) || 0;
    const prev = previousPrice !== undefined && previousPrice !== null
      ? Number(previousPrice)
      : null;

    let variationPercent = 0;
    let variationType = 'stable';
    if (prev !== null && prev > 0) {
      variationPercent = ((price - prev) / prev) * 100;
      if (Math.abs(variationPercent) < 0.001) variationType = 'stable';
      else variationType = variationPercent > 0 ? 'augmentation' : 'diminution';
    } else if (prev === null) {
      variationType = 'stable';
    }

    const entry = {
      id: genId(),
      productId: productId || null,
      productDescription,
      purchasePrice: price,
      previousPrice: prev,
      variationPercent: Number(variationPercent.toFixed(2)),
      variationType,
      quantity: Number(quantity) || 0,
      disponible: disponible === undefined ? true : !!disponible,
      fournisseur: fournisseur || '',
      caracteristiques: caracteristiques || '',
      date: date || new Date().toISOString(),
      isNewProduct: !!isNewProduct,
      createdAt: new Date().toISOString()
    };

    const db = readDb();
    db.entries.push(entry);
    writeDb(db);

    res.status(201).json(entry);
  } catch (e) {
    console.error('prixproducts create error:', e);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE entrée
router.delete('/:id', auth, (req, res) => {
  try {
    const db = readDb();
    const before = db.entries.length;
    db.entries = db.entries.filter(e => e.id !== req.params.id);
    if (db.entries.length === before) {
      return res.status(404).json({ message: 'Entrée non trouvée' });
    }
    writeDb(db);
    res.json({ message: 'Entrée supprimée' });
  } catch (e) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
