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
const syncManager = require('../middleware/sync');
const { readJsonDecrypted, writeJsonEncrypted } = require('../middleware/encryption');

const dbPath = path.join(__dirname, '../db');
const settingsPath = path.join(dbPath, 'settings.json');
const usersPath = path.join(dbPath, 'users.json');

// Helper: read JSON file safely (with decryption support)
const readJson = (filePath) => {
  return readJsonDecrypted(filePath);
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

// Helper: write JSON file (with encryption support)
const writeJson = (filePath, data) => {
  writeJsonEncrypted(filePath, data);
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

  if (item.annee !== undefined && item.mois !== undefined) {
    return `mois-annee:${String(item.annee)}-${String(item.mois)}`;
  }

  if (item.year !== undefined && item.month !== undefined) {
    return `month-year:${String(item.year)}-${String(item.month)}`;
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

const isEmptyContainer = (value) => {
  if (Array.isArray(value)) return value.length === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  return false;
};

const mergeRestoreData = (existingData, incomingData) => {
  if (existingData === null || existingData === undefined) {
    return { data: incomingData, added: 1, skipped: 0, changed: true };
  }

  // Type mismatch (e.g. existing {} after delete-all but incoming is an array,
  // or existing [] but incoming is an object) — replace with incoming data.
  // Also covers the case where the local file was reset to an empty container
  // of the wrong shape so newly added DB files (like pointageauto.json) restore correctly.
  const typesDiffer =
    Array.isArray(existingData) !== Array.isArray(incomingData) ||
    isPlainObject(existingData) !== isPlainObject(incomingData);

  if (typesDiffer || (isEmptyContainer(existingData) && !isEmptyContainer(incomingData))) {
    const addedCount = Array.isArray(incomingData)
      ? incomingData.length
      : isPlainObject(incomingData)
        ? Object.keys(incomingData).length
        : 1;
    return { data: incomingData, added: addedCount, skipped: 0, changed: true };
  }

  if (Array.isArray(existingData) && Array.isArray(incomingData)) {
    const merged = [...existingData];
    let added = 0;
    let skipped = 0;
    let changed = false;

    incomingData.forEach((incomingItem) => {
      const existingIndex = merged.findIndex((existingItem) => getComparableIdentity(existingItem) === getComparableIdentity(incomingItem));

      if (existingIndex === -1) {
        merged.push(incomingItem);
        added += 1;
        changed = true;
        return;
      }

      const existingItem = merged[existingIndex];

      if (areItemsEquivalent(existingItem, incomingItem)) {
        skipped += 1;
        return;
      }

      const nested = mergeRestoreData(existingItem, incomingItem);
      merged[existingIndex] = nested.data;
      added += nested.added;
      skipped += nested.skipped;
      changed = true;
    });

    return { data: merged, added, skipped, changed };
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

  return { data: incomingData, added: 0, skipped: 0, changed: true };
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
// DELETE /api/settings/user/:id - Delete a user account
// ==================
router.delete('/user/:id', authMiddleware, (req, res) => {
  try {
    if (!isAdminPrincipale(req.user)) {
      return res.status(403).json({ message: 'Accès refusé. Administrateur principale requis.' });
    }

    const userId = req.params.id;
    const users = readJson(usersPath) || [];
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (users[userIndex].role === 'administrateur principale') {
      return res.status(403).json({ message: 'Impossible de supprimer le compte administrateur principale' });
    }

    const deletedUser = users[userIndex];
    
    // Delete profile photo if exists
    if (deletedUser.profilePhoto) {
      const photoPath = path.join(__dirname, '..', deletedUser.profilePhoto);
      if (fs.existsSync(photoPath)) {
        try { fs.unlinkSync(photoPath); } catch (e) { console.error('Error deleting user photo:', e); }
      }
    }

    // Remove user from array
    users.splice(userIndex, 1);
    writeJson(usersPath, users);

    // Clean up user data in other db files
    const dbFiles = ['pointage.json', 'rdv.json', 'taches.json'];
    dbFiles.forEach(file => {
      const filePath = path.join(dbPath, file);
      if (fs.existsSync(filePath)) {
        try {
          const data = readJson(filePath);
          if (Array.isArray(data)) {
            const filtered = data.filter(item => item.userId !== userId && item.assignedTo !== userId);
            writeJson(filePath, filtered);
          }
        } catch (e) { console.error(`Error cleaning ${file}:`, e); }
      }
    });

    res.json({ success: true, message: `Le compte de ${deletedUser.firstName || ''} ${deletedUser.lastName || ''} a été supprimé` });
  } catch (error) {
    console.error('Error deleting user:', error);
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
    syncManager.markBackupCompleted('manual');

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

    // Restore all files from backup - including files that may not exist locally yet
    const allFilesToRestore = new Set([
      ...getDbFiles(),
      ...Object.keys(backupData).filter(k => k !== '_metadata' && k.endsWith('.json'))
    ]);

    // ✅ Fichiers à TOUJOURS remplacer entièrement lors d'une restauration.
    // Le merge "intelligent" peut perdre des données pour ces fichiers car
    // les entrées partagent souvent les mêmes ids mais avec des valeurs
    // numériques mises à jour (quantités produits, objectifs, montants...).
    const REPLACE_ON_RESTORE = new Set([
      'objectif.json',
      'products.json',
      'nouvelle_achat.json',
      'pretproduits.json',
      'pretfamilles.json',
      'avance.json',
      'sales.json',
      'remboursement.json',
      'compta.json',
      'benefice.json',
      'depensedumois.json',
      'depensefixe.json',
      'pointage.json',
      'pointageauto.json'
    ]);

    allFilesToRestore.forEach(file => {
      if (backupData[file] === undefined) {
        return;
      }

      const filePath = path.join(dbPath, file);
      const existingData = fs.existsSync(filePath) ? readJson(filePath) : null;

      // Pour les fichiers critiques (état numérique, stocks, finances) on
      // remplace directement par le contenu de la sauvegarde au lieu de
      // fusionner — sinon on risque de perdre des quantités/objectifs.
      if (REPLACE_ON_RESTORE.has(file)) {
        const existingStr = stableStringify(existingData);
        const incomingStr = stableStringify(backupData[file]);
        if (existingStr !== incomingStr) {
          writeJson(filePath, backupData[file]);
          updatedFilesCount += 1;
          const addedCount = Array.isArray(backupData[file])
            ? backupData[file].length
            : isPlainObject(backupData[file])
              ? Object.keys(backupData[file]).length
              : 1;
          totalAddedEntries += addedCount;
        } else {
          unchangedFilesCount += 1;
        }
        return;
      }

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

    // Après une restauration, s'assurer que tous les produits ont leur
    // caractéristique (nom, numero, codeBarre obfusqué, code). Les vieilles
    // sauvegardes peuvent ne pas en contenir.
    try {
      const ProductModel = require('../models/Product');
      ProductModel.generateCodesForExistingProducts();
    } catch (e) {
      console.warn('⚠️ Migration caracteristique post-restore ignorée :', e.message);
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

    // Preserve admin principale user(s) - reset security counters but keep settings
    const adminPrincipaleUsers = users
      .filter(u => u.role === 'administrateur principale')
      .map(u => ({
        ...u,
        failedAttempts: 0,
        lockedUntil: null
      }));

    // Files that MUST always be arrays (even if currently encrypted/corrupt)
    const ARRAY_FILES = [
      'admin-messages.json', 'avance.json', 'benefice.json', 'clients.json',
      'commandes.json', 'compta.json', 'depensedumois.json', 'depensefixe.json',
      'entreprise.json',
      'fournisseurs.json', 'group-chats.json', 'group-messages.json',
      'indisponible.json', 'lienpartagecommente.json', 'messagerie.json',
      'messages.json', 'notes.json', 'nouvelle_achat.json', 'pointage.json',
      'pointageauto.json',
      'pretfamilles.json', 'pretproduits.json', 'productComments.json',
      'products.json', 'rdv.json', 'rdvNotifications.json', 'remboursement.json',
      'sales.json', 'shareTokens.json', 'tache.json', 'travailleur.json',
      'users.json'
    ];

    // Delete all data - write empty arrays/objects, but keep admin principale in users
    getDbFiles().forEach(file => {
      const filePath = path.join(dbPath, file);
      if (fs.existsSync(filePath)) {
        if (file === 'users.json') {
          writeJson(filePath, adminPrincipaleUsers);
        } else if (ARRAY_FILES.includes(file)) {
          writeJson(filePath, []);
        } else {
          writeJson(filePath, {});
        }
      }
    });

    // Réinitialise timeoutinactive.json et tentativeblocage.json à {}
    // → Le frontend utilisera automatiquement les valeurs par défaut
    try {
      writeJson(path.join(dbPath, 'timeoutinactive.json'), {});
      writeJson(path.join(dbPath, 'tentativeblocage.json'), {});
    } catch (e) {
      console.error('Erreur reset fichiers paramètres:', e);
    }

    res.json({ success: true, message: 'Toutes les données ont été supprimées (compte administrateur principale préservé)' });
  } catch (error) {
    console.error('Error deleting all data:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
});

// ==================
// POST /api/settings/bulk-delete - Suppression sélective (ventes, produits, clients)
// Admin principale uniquement
// ==================
router.post('/bulk-delete', authMiddleware, (req, res) => {
  try {
    if (!isAdminPrincipale(req.user)) {
      return res.status(403).json({ message: 'Accès refusé. Administrateur principale requis.' });
    }

    const { type, ids, deleteAll, month, year } = req.body;

    if (!type || !['sales', 'products', 'clients'].includes(type)) {
      return res.status(400).json({ message: 'Type invalide. Choisir: sales, products, clients' });
    }

    const fileMap = {
      sales: 'sales.json',
      products: 'products.json',
      clients: 'clients.json'
    };

    const filePath = path.join(dbPath, fileMap[type]);
    let data = readJson(filePath) || [];

    if (!Array.isArray(data)) {
      return res.status(500).json({ message: 'Format de données invalide' });
    }

    const originalCount = data.length;
    let deletedCount = 0;

    if (deleteAll) {
      // Supprimer tout pour ce type
      if (type === 'sales' && month !== undefined && year !== undefined) {
        // Supprimer uniquement les ventes d'un mois/année spécifique
        const monthNum = Number(month);
        const yearNum = Number(year);
        data = data.filter(sale => {
          const d = new Date(sale.date);
          const match = (d.getMonth() + 1) === monthNum && d.getFullYear() === yearNum;
          if (match) deletedCount++;
          return !match;
        });
      } else if (type === 'sales' && year !== undefined) {
        // Supprimer toutes les ventes d'une année
        const yearNum = Number(year);
        data = data.filter(sale => {
          const d = new Date(sale.date);
          const match = d.getFullYear() === yearNum;
          if (match) deletedCount++;
          return !match;
        });
      } else {
        deletedCount = data.length;
        data = [];
      }
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      // Supprimer par IDs sélectionnés
      const idSet = new Set(ids);
      data = data.filter(item => {
        if (idSet.has(item.id)) {
          deletedCount++;
          return false;
        }
        return true;
      });
    } else {
      return res.status(400).json({ message: 'Fournir ids[] ou deleteAll=true' });
    }

    writeJson(filePath, data);

    // Notifier les clients SSE
    if (req.app?.locals?.broadcastSSE) {
      req.app.locals.broadcastSSE({ type, action: 'bulk-delete', data: { deletedCount } });
    }

    res.json({
      success: true,
      message: `${deletedCount} ${type === 'sales' ? 'vente(s)' : type === 'products' ? 'produit(s)' : 'client(s)'} supprimé(s)`,
      deletedCount,
      remainingCount: data.length
    });
  } catch (error) {
    console.error('Error in bulk-delete:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
});

// GET /api/settings/bulk-data - Récupérer données pour la modale de suppression
router.get('/bulk-data', authMiddleware, (req, res) => {
  try {
    if (!isAdminPrincipale(req.user)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { type, month, year } = req.query;

    if (!type || !['sales', 'products', 'clients'].includes(type)) {
      return res.status(400).json({ message: 'Type invalide' });
    }

    const fileMap = {
      sales: 'sales.json',
      products: 'products.json',
      clients: 'clients.json'
    };

    const filePath = path.join(dbPath, fileMap[type]);
    let data = readJson(filePath) || [];

    if (type === 'sales' && month !== undefined && year !== undefined) {
      const monthNum = Number(month);
      const yearNum = Number(year);
      data = data.filter(sale => {
        const d = new Date(sale.date);
        return (d.getMonth() + 1) === monthNum && d.getFullYear() === yearNum;
      });
    } else if (type === 'sales' && year !== undefined) {
      const yearNum = Number(year);
      data = data.filter(sale => {
        const d = new Date(sale.date);
        return d.getFullYear() === yearNum;
      });
    }

    // Return lightweight data for selection
    const lightData = data.map(item => {
      if (type === 'sales') {
        return {
          id: item.id,
          date: item.date,
          description: item.description || (item.products ? item.products.map(p => p.description).join(', ') : ''),
          totalSellingPrice: item.totalSellingPrice || item.sellingPrice || 0,
          clientName: item.clientName || ''
        };
      } else if (type === 'products') {
        return {
          id: item.id,
          description: item.description,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          quantity: item.quantity
        };
      } else {
        return {
          id: item.id,
          nom: item.nom,
          phone: item.phone,
          adresse: item.adresse
        };
      }
    });

    // For sales, also return available years/months
    let years = [];
    if (type === 'sales') {
      const allSales = readJson(filePath) || [];
      const yearSet = new Set();
      allSales.forEach(s => {
        const d = new Date(s.date);
        if (!isNaN(d.getTime())) yearSet.add(d.getFullYear());
      });
      years = Array.from(yearSet).sort((a, b) => b - a);
    }

    res.json({ data: lightData, total: lightData.length, years });
  } catch (error) {
    console.error('Error in bulk-data:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ==================
// POST /api/settings/auto-backup - Sauvegarde automatique avec mot de passe utilisateur
// ==================
router.post('/auto-backup', authMiddleware, (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ message: 'Accès refusé. Administrateur requis.' });
    }

    // Get the user's actual password from DB to use as encryption code
    const users = readJson(usersPath) || [];
    const currentUser = users.find(u => u.id === req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const { encryptionPassword } = req.body;
    if (!encryptionPassword || encryptionPassword.length < 1) {
      return res.status(400).json({ message: 'Mot de passe requis pour la sauvegarde automatique' });
    }

    // Verify the password matches
    const isPasswordValid = bcrypt.compareSync(encryptionPassword, currentUser.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Mot de passe invalide' });
    }

    // Use the plain password as encryption code
    const encryptionCode = encryptionPassword;

    // Collect all DB data
    const backupData = {};
    getDbFiles().forEach(file => {
      const filePath = path.join(dbPath, file);
      const data = readJson(filePath);
      if (data !== null) {
        backupData[file] = data;
      }
    });

    backupData._metadata = {
      backupDate: new Date().toISOString(),
      version: '1.0',
      filesCount: Object.keys(backupData).length - 1,
      autoBackup: true
    };

    // Encrypt data
    const jsonData = JSON.stringify(backupData);
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(encryptionCode, 'riziky-salt-2024', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');

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
    syncManager.markBackupCompleted('auto');

    // Build filename with user's name
    const userName = (currentUser.lastName || currentUser.firstName || 'inconnu').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').replace(/\s+/g, ' ').trim();
    const dateStr = new Date().toISOString().split('T')[0];

    res.json({
      success: true,
      backup: encryptedPackage,
      filename: `auto-backup-riziky-${userName}-${dateStr}.json`
    });
  } catch (error) {
    console.error('Error creating auto-backup:', error);
    res.status(500).json({ message: 'Erreur lors de la sauvegarde automatique' });
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

// ========== AUTO-SAUVEGARDE STATUS ==========
const autoSauvegardePath = path.join(dbPath, 'auto-sauvegarde.json');

const readAutoSauvegarde = () => {
  try {
    if (!fs.existsSync(autoSauvegardePath)) {
      fs.writeFileSync(autoSauvegardePath, JSON.stringify({ autoSauvegarde: true }, null, 2));
      return { autoSauvegarde: true };
    }
    return JSON.parse(fs.readFileSync(autoSauvegardePath, 'utf8'));
  } catch {
    return { autoSauvegarde: true };
  }
};

// GET auto-sauvegarde status
router.get('/auto-sauvegarde', authMiddleware, (req, res) => {
  try {
    const data = readAutoSauvegarde();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT auto-sauvegarde status
router.put('/auto-sauvegarde', authMiddleware, (req, res) => {
  try {
    const { autoSauvegarde } = req.body;
    const data = { autoSauvegarde: !!autoSauvegarde };
    fs.writeFileSync(autoSauvegardePath, JSON.stringify(data, null, 2));
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
