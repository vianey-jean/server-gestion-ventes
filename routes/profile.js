/**
 * profile.js - Routes API pour la gestion du profil utilisateur
 * 
 * Modification des informations personnelles, photo de profil,
 * changement de mot de passe et paramètres de sécurité.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

// Ensure uploads/profil/photo directory exists
const uploadDir = path.join(__dirname, '../uploads/profil/photo');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config for profile photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.user.id}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Seules les images JPG, PNG et WEBP sont autorisées'));
  }
});

// GET profile
router.get('/', authMiddleware, (req, res) => {
  const { password, ...userWithoutPassword } = req.user;
  res.json(userWithoutPassword);
});

// PUT update profile (firstName, lastName, gender, address, phone)
router.put('/', authMiddleware, (req, res) => {
  try {
    const { firstName, lastName, gender, address, phone } = req.body;
    const updated = User.update(req.user.id, { firstName, lastName, gender, address, phone });
    if (!updated) return res.status(400).json({ message: 'Erreur lors de la mise à jour' });
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST upload profile photo
router.post('/photo', authMiddleware, upload.single('photo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Aucune photo envoyée' });

    // Delete old photo if exists
    const currentUser = User.getById(req.user.id);
    if (currentUser && currentUser.profilePhoto) {
      const oldPath = path.join(__dirname, '..', currentUser.profilePhoto);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const photoUrl = `/uploads/profil/photo/${req.file.filename}`;
    const updated = User.update(req.user.id, { profilePhoto: photoUrl });
    if (!updated) return res.status(400).json({ message: 'Erreur lors de la mise à jour' });

    res.json({ success: true, photoUrl, user: updated });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT change password
router.put('/password', authMiddleware, (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Les mots de passe ne correspondent pas' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    const hasLower = /[a-z]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNum = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    if (!hasLower || !hasUpper || !hasNum || !hasSpecial) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir majuscule, minuscule, chiffre et caractère spécial' });
    }

    // Verify current password
    const user = User.getById(req.user.id);
    if (!User.comparePassword(currentPassword, user.password)) {
      return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
    }

    // Check new != old
    if (User.comparePassword(newPassword, user.password)) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit être différent de l\'ancien' });
    }

    const success = User.updatePassword(user.email, newPassword);
    if (!success) return res.status(400).json({ message: 'Erreur lors du changement de mot de passe' });

    res.json({ success: true, message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================================
// Helpers pour les fichiers de paramètres globaux (timeoutinactive & tentativeblocage)
// Logique : si le fichier contient des valeurs valides, on les utilise.
//          Sinon (vide / {} / manquant), on retourne les valeurs par défaut.
// ============================================================================
const { readJsonDecrypted, writeJsonEncrypted } = require('../middleware/encryption');

const TIMEOUT_FILE = path.join(__dirname, '../db/timeoutinactive.json');
const TENTATIVE_FILE = path.join(__dirname, '../db/tentativeblocage.json');

const DEFAULTS_TIMEOUT = { active: 10, timeout: 7 };
const DEFAULTS_TENTATIVE = { nombreConnexion: 5, tempsBlocage: 15 };

const ensureFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    try { fs.writeFileSync(filePath, JSON.stringify({}, null, 2)); } catch {}
  }
};

const safeNumber = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
};

const readTimeoutFile = () => {
  ensureFile(TIMEOUT_FILE);
  let data = null;
  try { data = readJsonDecrypted(TIMEOUT_FILE); } catch { data = null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  const active = safeNumber(data.active);
  const timeout = safeNumber(data.timeout);
  return {
    active: active !== null ? active : DEFAULTS_TIMEOUT.active,
    timeout: timeout !== null ? timeout : DEFAULTS_TIMEOUT.timeout,
  };
};

const readTentativeFile = () => {
  ensureFile(TENTATIVE_FILE);
  let data = null;
  try { data = readJsonDecrypted(TENTATIVE_FILE); } catch { data = null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  const nombreConnexion = safeNumber(data.nombreConnexion);
  const tempsBlocage = safeNumber(data.tempsBlocage);
  return {
    nombreConnexion: nombreConnexion !== null ? nombreConnexion : DEFAULTS_TENTATIVE.nombreConnexion,
    tempsBlocage: tempsBlocage !== null ? tempsBlocage : DEFAULTS_TENTATIVE.tempsBlocage,
  };
};

// GET security settings (tentatives & blocage) — depuis tentativeblocage.json
router.get('/security-settings', authMiddleware, (req, res) => {
  try {
    res.json(readTentativeFile());
  } catch (error) {
    console.error('Security settings fetch error:', error);
    res.json(DEFAULTS_TENTATIVE);
  }
});

// PUT update security settings (nombreConnexion, tempsBlocage)
router.put('/security-settings', authMiddleware, (req, res) => {
  try {
    const { nombreConnexion, tempsBlocage } = req.body;

    const updates = {};
    if (nombreConnexion !== undefined) {
      const val = parseInt(nombreConnexion, 10);
      if (isNaN(val) || val < 1 || val > 20) {
        return res.status(400).json({ message: 'Nombre de connexion doit être entre 1 et 20' });
      }
      updates.nombreConnexion = val;
    }
    if (tempsBlocage !== undefined) {
      const val = parseInt(tempsBlocage, 10);
      if (isNaN(val) || val < 1 || val > 1440) {
        return res.status(400).json({ message: 'Temps de blocage doit être entre 1 et 1440 minutes' });
      }
      updates.tempsBlocage = val;
    }

    // Mise à jour user (compatibilité existante)
    const updated = User.update(req.user.id, updates);
    if (!updated) return res.status(400).json({ message: 'Erreur lors de la mise à jour' });

    // Persiste aussi dans tentativeblocage.json (source de vérité globale)
    try {
      const current = readTentativeFile();
      const merged = {
        nombreConnexion: updates.nombreConnexion !== undefined ? updates.nombreConnexion : current.nombreConnexion,
        tempsBlocage: updates.tempsBlocage !== undefined ? updates.tempsBlocage : current.tempsBlocage,
      };
      writeJsonEncrypted(TENTATIVE_FILE, merged);
    } catch (e) {
      console.error('Erreur écriture tentativeblocage.json:', e);
    }

    res.json({ success: true, user: updated, settings: readTentativeFile() });
  } catch (error) {
    console.error('Security settings update error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET timeout settings — source de vérité = timeoutinactive.json
router.get('/timeout-settings', authMiddleware, (req, res) => {
  try {
    res.json(readTimeoutFile());
  } catch (error) {
    console.error('Timeout settings fetch error:', error);
    res.json(DEFAULTS_TIMEOUT);
  }
});

// PUT timeout settings
router.put('/timeout-settings', authMiddleware, (req, res) => {
  try {
    const { active, timeout } = req.body;
    const updates = {};
    if (active !== undefined) {
      const val = parseInt(active, 10);
      if (isNaN(val) || val < 1 || val > 120) return res.status(400).json({ message: 'Inactivité doit être entre 1 et 120 minutes' });
      updates.inactiveMinutes = val;
    }
    if (timeout !== undefined) {
      const val = parseInt(timeout, 10);
      if (isNaN(val) || val < 1 || val > 24) return res.status(400).json({ message: 'Timeout doit être entre 1 et 24 heures' });
      updates.timeoutHours = val;
    }
    const updated = User.update(req.user.id, updates);
    if (!updated) return res.status(400).json({ message: 'Erreur lors de la mise à jour' });

    // Persiste dans timeoutinactive.json (source de vérité)
    try {
      const current = readTimeoutFile();
      const merged = {
        active: updates.inactiveMinutes !== undefined ? updates.inactiveMinutes : current.active,
        timeout: updates.timeoutHours !== undefined ? updates.timeoutHours : current.timeout,
      };
      writeJsonEncrypted(TIMEOUT_FILE, merged);
    } catch (e) {
      console.error('Erreur écriture timeoutinactive.json:', e);
    }

    res.json({ success: true, user: updated, settings: readTimeoutFile() });
  } catch (error) {
    console.error('Timeout settings update error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
