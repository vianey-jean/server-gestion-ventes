/**
 * uploadAchat.js — Multer middleware spécialisé pour les factures d'achats produits
 *
 * - Accepte images (jpg/jpeg/png/gif/webp) ET PDF
 * - Stocke les fichiers dans server/uploads/achat/
 * - Limite : 15MB
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// S'assurer que le dossier uploads/achat existe
const achatDir = path.join(__dirname, '../uploads/achat');
if (!fs.existsSync(achatDir)) {
  fs.mkdirSync(achatDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, achatDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    const normalizedExt = ext === '.jpeg' ? '.jpg' : ext;
    cb(null, 'facture-' + uniqueSuffix + normalizedExt);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExt = /\.(jpe?g|png|gif|webp|pdf)$/i;
  const allowedMime = /^(image\/(jpeg|jpg|png|gif|webp)|application\/pdf)$/i;

  const extOk = allowedExt.test(file.originalname);
  const mimeOk = allowedMime.test(file.mimetype);

  if (extOk && mimeOk) return cb(null, true);
  cb(new Error('Seuls les images (JPG, PNG, GIF, WebP) et les PDF sont autorisés !'));
};

const uploadAchat = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1024 * 1024 * 15 }
});

module.exports = uploadAchat;