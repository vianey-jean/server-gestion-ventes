/**
 * =============================================================================
 * Routes — /api/connecte-profil-unique
 * =============================================================================
 *
 * Couche ROUTES (MVC) : uniquement le mapping HTTP → contrôleur.
 * Voir controllers/connecteProfilUniqueController.js pour la logique métier.
 *
 * @module routes/connecteProfilUnique
 */

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/connecteProfilUniqueController');

router.post('/check', ctrl.check);
router.post('/register-login', ctrl.registerLogin);
router.post('/logout', ctrl.logout);
router.post('/request-logout', ctrl.requestLogout);
router.get('/request-status/:requestId', ctrl.requestStatus);
router.post('/respond-logout', ctrl.respondLogout);
router.post('/poll', ctrl.poll);
router.get('/actives', ctrl.actives);
router.get('/', ctrl.list);
router.delete('/', ctrl.reset);

module.exports = router;
