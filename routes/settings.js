/**
 * =============================================================================
 * Routes Paramètres - Gestion des données et configuration
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');

const dbPath = path.join(__dirname, '../db');
const settingsPath = path.join(dbPath, 'settings.json');
const usersPath = path.join(dbPath, 'users.json');

// Helper: read JSON file safely
const readJson = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return null; }
};

// Default settings structure
const DEFAULT_SETTINGS = {
  siteName: 'Riziky',
  language: 'fr',
  timezone: 'Indian/Reunion',
  currency: 'EUR',
  dateFormat: 'DD/MM/YYYY',
  notifications: {
    rdvReminder: true,
    rdvReminderMinutes: 30,
    tacheReminder: true,
    emailNotifications: false,
    soundEnabled: true,
  },
  display: {
    itemsPerPage: 10,
    theme: 'system',
    compactMode: false,
    showWelcomeMessage: true,
  },
  security: {
    sessionTimeoutMinutes: 60,
    maxLoginAttempts: 5,
    requireStrongPassword: true,
  },
  backup: {
    lastBackupDate: null,
    autoBackup: false,
    autoBackupIntervalDays: 7,
  },
};

// Helper: write JSON file
const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Helper: check if user is admin (both types)
const isAdmin = (user) => {
  return user && (user.role === 'administrateur' || user.role === 'administrateur principale');
};

// Helper: check if user is admin principale
const isAdminPrincipale = (user) => {
  return user && user.role === 'administrateur principale';
};

// Dynamically get ALL .json files in the db folder for backup/restore/delete
const getDbFiles = () => {
  try {
    return fs.readdirSync(dbPath).filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const sortDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortDeep(value[key]);
        return acc;
      }, {});
  }

  return value;
};

const stableStringify = (value) => JSON.stringify(sortDeep(value));

const getComparableIdentity = (item) => {
  if (!isPlainObject(item)) {
    return stableStringify(item);
  }

  const priorityKeys = ['id', '_id', 'email', 'code', 'reference', 'numero', 'phone', 'nom', 'name'];
  const matchedKey = priorityKeys.find((key) => item[key] !== undefined && item[key] !== null && item[key] !== '');

  return matchedKey ? `${matchedKey}:${String(item[matchedKey])}` : stableStringify(item);
};

const areItemsEquivalent = (existingItem, incomingItem) => {
  if (stableStringify(existingItem) === stableStringify(incomingItem)) {
    return true;
  }

  if (isPlainObject(existingItem) && isPlainObject(incomingItem)) {
    return getComparableIdentity(existingItem) === getComparableIdentity(incomingItem);
  }

  return false;
};

const mergeRestoreData = (existingData, incomingData) => {
  if (existingData === null || existingData === undefined) {
    return { data: incomingData, added: 1, skipped: 0, changed: true };
  }

  if (Array.isArray(existingData) && Array.isArray(incomingData)) {
    const merged = [...existingData];
    let added = 0;
    let skipped = 0;

    incomingData.forEach((incomingItem) => {
      const alreadyExists = existingData.some((existingItem) => areItemsEquivalent(existingItem, incomingItem));

      if (alreadyExists) {
        skipped += 1;
      } else {
        merged.push(incomingItem);
        added += 1;
      }
    });

    return { data: merged, added, skipped, changed: added > 0 };
  }

  if (isPlainObject(existingData) && isPlainObject(incomingData)) {
    const merged = { ...existingData };
    let added = 0;
    let skipped = 0;
    let changed = false;

    Object.entries(incomingData).forEach(([key, value]) => {
      if (!(key in existingData)) {
        merged[key] = value;
        added += 1;
        changed = true;
        return;
      }

      const nested = mergeRestoreData(existingData[key], value);

      if (nested.changed) {
        merged[key] = nested.data;
        changed = true;
      }

      added += nested.added;
      skipped += nested.skipped;

      if (!nested.changed && stableStringify(existingData[key]) === stableStringify(value)) {
        skipped += 1;
      }
    });

    return { data: merged, added, skipped, changed };
  }

  if (stableStringify(existingData) === stableStringify(incomingData)) {
    return { data: existingData, added: 0, skipped: 1, changed: false };
  }

  return { data: existingData, added: 0, skipped: 1, changed: false };
};

// ==================
// GET /api/settings
// ==================
router.get('/', authMiddleware, (req, res) => {
  try {
    const rawSettings = readJson(settingsPath) || {};
    // Merge with defaults to ensure all fields exist
    const settings = {
      ...DEFAULT_SETTINGS,
      ...rawSettings,
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(rawSettings.notifications || {}) },
      display: { ...DEFAULT_SETTINGS.display, ...(rawSettings.display || {}) },
      security: { ...DEFAULT_SETTINGS.security, ...(rawSettings.security || {}) },
      backup: { ...DEFAULT_SETTINGS.backup, ...(rawSettings.backup || {}) },
    };
    const isUserAdmin = isAdmin(req.user);
    res.json({ settings, isAdmin: isUserAdmin });
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ==================
// GET /api/settings/users - List all users (for role management)
// ==================
router.get('/users', authMiddleware, (req, res) => {
  try {
    if (!isAdminPrincipale(req.user)) {
      return res.status(403).json({ message: 'Accès refusé. Administrateur principale requis.' });
    }
    const users = readJson(usersPath) || [];
    const usersWithoutPasswords = users.map(({ password, ...rest }) => rest);
    res.json({ users: usersWithoutPasswords });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ==================
// PUT /api/settings/user-role - Change user role
// ==================
router.put('/user-role', authMiddleware, (req, res) => {
  try {
    if (!isAdminPrincipale(req.user)) {
      return res.status(403).json({ message: 'Accès refusé. Administrateur principale requis.' });
    }

    const { userId, newRole } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'ID utilisateur requis' });
    }

    const users = readJson(usersPath) || [];
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (users[userIndex].role === 'administrateur principale') {
      return res.status(403).json({ message: 'Impossible de modifier le rôle de l\'administrateur principale' });
    }

    if (newRole !== '' && newRole !== 'administrateur') {
      return res.status(400).json({ message: 'Rôle invalide' });
    }

    if (newRole === '') {
      delete users[userIndex].role;
      delete users[userIndex].specification;
    } else {
      users[userIndex].role = newRole;
    }

    writeJson(usersPath, users);

    const { password, ...userWithoutPassword } = users[userIndex];
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error('Error changing user role:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ==================
// PUT /api/settings/user-specification - Change user specification
// ==================
router.put('/user-specification', authMiddleware, (req, res) => {
  try {
    if (!isAdminPrincipale(req.user)) {
      return res.status(403).json({ message: 'Accès refusé. Administrateur principale requis.' });
    }

    const { userId, specification } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'ID utilisateur requis' });
    }

    const users = readJson(usersPath) || [];
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (users[userIndex].role !== 'administrateur') {
      return res.status(400).json({ message: 'Seul un administrateur peut avoir une spécification' });
    }

    if (specification === 'live') {
      users[userIndex].specification = 'live';
    } else {
      delete users[userIndex].specification;
    }

    writeJson(usersPath, users);

    const { password, ...userWithoutPassword } = users[userIndex];
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error('Error changing user specification:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ==================
// PUT /api/settings
// ==================
router.put('/', authMiddleware, (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ message: 'Accès refusé. Administrateur requis.' });
    }
    const currentSettings = readJson(settingsPath) || {};
    const updatedSettings = { ...currentSettings, ...req.body };
    writeJson(settingsPath, updatedSettings);
    res.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ==================
// POST /api/settings/backup - Sauvegarder toutes les données
// ==================
router.post('/backup', authMiddleware, (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ message: 'Accès refusé. Administrateur requis.' });
    }

    const { encryptionCode } = req.body;
    if (!encryptionCode || encryptionCode.length < 6) {
      return res.status(400).json({ message: 'Code de cryptage requis (min 6 caractères)' });
    }

    // Collect all DB data
    const backupData = {};
    getDbFiles().forEach(file => {
      const filePath = path.join(dbPath, file);
      const data = readJson(filePath);
      if (data !== null) {
        backupData[file] = data;
      }
    });

    // Add metadata
    backupData._metadata = {
      backupDate: new Date().toISOString(),
      version: '1.0',
      filesCount: Object.keys(backupData).length - 1
    };

    // Encrypt data with the code
    const jsonData = JSON.stringify(backupData);
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(encryptionCode, 'riziky-salt-2024', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Hash the encryption code with bcrypt (like a password)
    const hashedCode = bcrypt.hashSync(encryptionCode, 10);

    const encryptedPackage = {
      iv: iv.toString('hex'),
      data: encrypted,
      checksum: crypto.createHash('sha256').update(jsonData).digest('hex'),
      codeHash: hashedCode
    };

    // Update last backup date
    const settings = readJson(settingsPath) || {};
    settings.backup = settings.backup || {};
    settings.backup.lastBackupDate = new Date().toISOString();
    writeJson(settingsPath, settings);

    res.json({
      success: true,
      backup: encryptedPackage,
      filename: `backup-riziky-${new Date().toISOString().split('T')[0]}.json`
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ message: 'Erreur lors de la sauvegarde' });
  }
});

// ==================
// POST /api/settings/restore - Injecter des données
// ==================
router.post('/restore', authMiddleware, (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ message: 'Accès refusé. Administrateur requis.' });
    }

    const { encryptedData, decryptionCode } = req.body;
    if (!encryptedData || !decryptionCode) {
      return res.status(400).json({ message: 'Données et code de décryptage requis' });
    }

    if (encryptedData.codeHash) {
      const codeMatch = bcrypt.compareSync(decryptionCode, encryptedData.codeHash);
      if (!codeMatch) {
        return res.status(400).json({ message: 'Code de décryptage incorrect. Veuillez vérifier votre code.' });
      }
    }

    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(decryptionCode, 'riziky-salt-2024', 32);
    const iv = Buffer.from(encryptedData.iv, 'hex');

    let decrypted;
    try {
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
    } catch (e) {
      return res.status(400).json({ message: 'Code de décryptage incorrect. Impossible de lire les données.' });
    }

    const backupData = JSON.parse(decrypted);
    const checksum = crypto.createHash('sha256').update(decrypted).digest('hex');
    if (encryptedData.checksum && encryptedData.checksum !== checksum) {
      return res.status(400).json({ message: 'Fichier corrompu ou incomplet. Vérifiez la sauvegarde.' });
    }

    let updatedFilesCount = 0;
    let unchangedFilesCount = 0;
    let totalAddedEntries = 0;

    getDbFiles().forEach(file => {
      if (backupData[file] === undefined) {
        return;
      }

      const filePath = path.join(dbPath, file);
      const existingData = readJson(filePath);
      const mergeResult = mergeRestoreData(existingData, backupData[file]);

      if (mergeResult.changed) {
        writeJson(filePath, mergeResult.data);
        updatedFilesCount += 1;
        totalAddedEntries += mergeResult.added;
      } else {
        unchangedFilesCount += 1;
      }
    });

    if (updatedFilesCount === 0 && totalAddedEntries === 0) {
      return res.json({
        success: true,
        status: 'unchanged',
        message: 'Ces données déjà dans la base de donnée.',
        metadata: backupData._metadata,
        updatedFilesCount,
        unchangedFilesCount,
        totalAddedEntries
      });
    }

    return res.json({
      success: true,
      status: 'updated',
      message: 'Vos donné sont mise a jours.',
      metadata: backupData._metadata,
      updatedFilesCount,
      unchangedFilesCount,
      totalAddedEntries
    });
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ message: 'Erreur lors de la restauration' });
  }
});

// ==================
// POST /api/settings/delete-all - Supprimer toutes les données
// Only administrateur principale can delete. Preserves admin principale account.
// ==================
router.post('/delete-all', authMiddleware, (req, res) => {
  try {
    if (!isAdminPrincipale(req.user)) {
      return res.status(403).json({ message: 'Accès refusé. Administrateur principale requis.' });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Mot de passe requis' });
    }

    // Verify admin principale password
    const users = readJson(usersPath) || [];
    const adminUser = users.find(u => u.id === req.user.id);
    if (!adminUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const isPasswordValid = bcrypt.compareSync(password, adminUser.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Mot de passe incorrect' });
    }

    // Preserve admin principale user(s)
    const adminPrincipaleUsers = users.filter(u => u.role === 'administrateur principale');

    // Delete all data - write empty arrays/objects, but keep admin principale in users
    getDbFiles().forEach(file => {
      const filePath = path.join(dbPath, file);
      if (fs.existsSync(filePath)) {
        if (file === 'users.json') {
          writeJson(filePath, adminPrincipaleUsers);
        } else {
          // Detect if the file contains an object or array, reset accordingly
          const currentData = readJson(filePath);
          if (currentData !== null && !Array.isArray(currentData) && typeof currentData === 'object') {
            writeJson(filePath, {});
          } else {
            writeJson(filePath, []);
          }
        }
      }
    });

    res.json({ success: true, message: 'Toutes les données ont été supprimées (compte administrateur principale préservé)' });
  } catch (error) {
    console.error('Error deleting all data:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
});

// ==================
// POST /api/settings/verify-password - Vérifier mot de passe admin
// ==================
router.post('/verify-password', authMiddleware, (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { password } = req.body;
    const users = readJson(usersPath) || [];
    const adminUser = users.find(u => u.id === req.user.id);
    if (!adminUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const isValid = bcrypt.compareSync(password, adminUser.password);
    res.json({ valid: isValid });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
