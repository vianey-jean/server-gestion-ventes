/**
 * Routes API pour les attributs produits :
 * /api/modele-produits, /api/taille-produits, /api/couleur-produits, /api/devant-produits
 * Toutes utilisent la même structure { id, nom, description }.
 */
const express = require('express');
const authMiddleware = require('../middleware/auth');
const { createStore } = require('../models/ProductAttribute');

function buildRouter(fileName) {
  const store = createStore(fileName);
  const router = express.Router();

  router.get('/', authMiddleware, (req, res) => {
    try { res.json(store.getAll()); }
    catch { res.status(500).json({ message: 'Erreur serveur' }); }
  });

  router.post('/', authMiddleware, (req, res) => {
    try {
      const { nom, description } = req.body || {};
      if (!nom || !nom.trim()) return res.status(400).json({ message: 'Nom requis' });
      const item = store.create(nom, description);
      res.status(201).json(item);
    } catch { res.status(500).json({ message: 'Erreur serveur' }); }
  });

  router.put('/:id', authMiddleware, (req, res) => {
    try {
      const item = store.update(req.params.id, req.body || {});
      if (!item) return res.status(404).json({ message: 'Non trouvé' });
      res.json(item);
    } catch { res.status(500).json({ message: 'Erreur serveur' }); }
  });

  router.delete('/:id', authMiddleware, (req, res) => {
    try {
      const ok = store.delete(req.params.id);
      if (!ok) return res.status(404).json({ message: 'Non trouvé' });
      res.json({ message: 'Supprimé' });
    } catch { res.status(500).json({ message: 'Erreur serveur' }); }
  });

  return router;
}

module.exports = {
  modeleRouter: buildRouter('modeleproduit.json'),
  tailleRouter: buildRouter('tailleproduits.json'),
  couleurRouter: buildRouter('couleurproduits.json'),
  devantRouter: buildRouter('devantproduits.json'),
  autresRouter: buildRouter('autresproduits.json'),
};