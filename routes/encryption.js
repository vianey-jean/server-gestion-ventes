/**
 * Routes pour la gestion du cryptage des données
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getEncryptionConfig,
  saveEncryptionConfig,
  encryptAllData,
  decryptAllData,
  reEncryptAllData
} = require('../middleware/encryption');

// Check if user is admin principale
const isAdminPrincipale = (user) => {
  return user && user.role === 'administrateur principale';
};

/**
 * GET /api/encryption/status - Get encryption status
 */
router.get('/status', authMiddleware, (req, res) => {
  try {
    if (!isAdminPrincipale(req.user)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    const config = getEncryptionConfig();
    res.json({
      enabled: config.enabled || false,
      hasKey: !!config.key,
      activatedAt: config.activatedAt || null
    });
  } catch (error) {
    console.error('Error getting encryption status:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

/**
 * POST /api/encryption/activate - Activate encryption with a key
 */
router.post('/activate', authMiddleware, (req, res) => {
  try {
    if (!isAdminPrincipale(req.user)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { encryptionKey } = req.body;
    if (!encryptionKey || encryptionKey.length < 10) {
      return res.status(400).json({ message: 'La clé de cryptage doit contenir au moins 10 caractères' });
    }

    const config = getEncryptionConfig();
    if (config.enabled) {
      return res.status(400).json({ message: 'Le cryptage est déjà activé. Désactivez-le d\'abord.' });
    }

    // Encrypt all existing data
    const encryptedCount = encryptAllData(encryptionKey);

    // Save config
    saveEncryptionConfig({
      enabled: true,
      key: encryptionKey,
      activatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Cryptage activé. ${encryptedCount} fichiers cryptés.`,
      encryptedCount
    });
  } catch (error) {
    console.error('Error activating encryption:', error);
    res.status(500).json({ message: 'Erreur lors de l\'activation du cryptage' });
  }
});

/**
 * POST /api/encryption/deactivate - Deactivate encryption
 */
router.post('/deactivate', authMiddleware, (req, res) => {
  try {
    if (!isAdminPrincipale(req.user)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { encryptionKey } = req.body;
    const config = getEncryptionConfig();

    if (!config.enabled) {
      return res.status(400).json({ message: 'Le cryptage n\'est pas activé' });
    }

    if (encryptionKey !== config.key) {
      return res.status(400).json({ message: 'Clé de cryptage incorrecte' });
    }

    // Decrypt all data
    const decryptedCount = decryptAllData(encryptionKey);

    // Save config
    saveEncryptionConfig({
      enabled: false,
      key: null,
      deactivatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Cryptage désactivé. ${decryptedCount} fichiers décryptés.`,
      decryptedCount
    });
  } catch (error) {
    console.error('Error deactivating encryption:', error);
    res.status(500).json({ message: 'Erreur lors de la désactivation du cryptage' });
  }
});

/**
 * POST /api/encryption/change-key - Change encryption key
 */
router.post('/change-key', authMiddleware, (req, res) => {
  try {
    if (!isAdminPrincipale(req.user)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { currentKey, newKey } = req.body;
    if (!newKey || newKey.length < 10) {
      return res.status(400).json({ message: 'La nouvelle clé doit contenir au moins 10 caractères' });
    }

    const config = getEncryptionConfig();
    if (!config.enabled) {
      return res.status(400).json({ message: 'Le cryptage n\'est pas activé' });
    }

    if (currentKey !== config.key) {
      return res.status(400).json({ message: 'Clé de cryptage actuelle incorrecte' });
    }

    // Re-encrypt with new key
    const count = reEncryptAllData(currentKey, newKey);

    // Update config
    saveEncryptionConfig({
      enabled: true,
      key: newKey,
      activatedAt: config.activatedAt,
      keyChangedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Clé de cryptage modifiée. ${count} fichiers re-cryptés.`,
      count
    });
  } catch (error) {
    console.error('Error changing encryption key:', error);
    res.status(500).json({ message: 'Erreur lors du changement de clé' });
  }
});

module.exports = router;
