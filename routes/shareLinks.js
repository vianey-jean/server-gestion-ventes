/**
 * shareLinks.js - Routes API pour la gestion des liens de partage sécurisés
 * 
 * Permet de créer des liens de partage pour les données (pointage, tâches, notes)
 * avec code d'accès et possibilité de sélection d'éléments spécifiques.
 * 
 * Routes :
 * - POST /generate : Créer un lien avec token + code d'accès
 * - GET /list : Lister les liens par type
 * - DELETE /revoke/:id : Révoquer un lien
 * - POST /access/:token : Valider le code d'accès et retourner les données
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const auth = require('../middleware/auth');

const shareTokensPath = path.join(__dirname, '..', 'db', 'shareTokens.json');
const lienIpPath = path.join(__dirname, '..', 'db', 'lienIp.json');
const notesPath = path.join(__dirname, '..', 'db', 'notes.json');
const columnsPath = path.join(__dirname, '..', 'db', 'noteColumns.json');
const pointagePath = path.join(__dirname, '..', 'db', 'pointage.json');
const tachePath = path.join(__dirname, '..', 'db', 'tache.json');

const readJSON = (filePath) => {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return []; }
};

const writeJSON = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Ensure files exist
[shareTokensPath, lienIpPath].forEach(p => {
  if (!fs.existsSync(p)) writeJSON(p, []);
});

// =====================
// Generate a new share link (authenticated)
// type: 'notes' | 'pointage' | 'taches'
// =====================
router.post('/generate', auth, (req, res) => {
  try {
    const { type, filters } = req.body;
    if (!['notes', 'pointage', 'taches'].includes(type)) {
      return res.status(400).json({ error: 'Type invalide. Utilisez: notes, pointage, taches' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const accessCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const tokens = readJSON(shareTokensPath);
    const entry = {
      id: Date.now().toString(),
      token,
      accessCode,
      type,
      filters: filters || null,
      active: true,
      createdAt: new Date().toISOString()
    };
    tokens.push(entry);
    writeJSON(shareTokensPath, tokens);

    res.json({ token: entry.token, accessCode: entry.accessCode, type, createdAt: entry.createdAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// List all share links (authenticated)
// =====================
router.get('/list', auth, (req, res) => {
  try {
    const { type } = req.query;
    let tokens = readJSON(shareTokensPath).filter(t => t.active);
    if (type) tokens = tokens.filter(t => t.type === type);
    res.json(tokens.map(t => ({
      id: t.id,
      token: t.token,
      accessCode: t.accessCode,
      type: t.type,
      createdAt: t.createdAt
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// Revoke a specific share link (authenticated)
// =====================
router.delete('/revoke/:id', auth, (req, res) => {
  try {
    const { id } = req.params;
    let tokens = readJSON(shareTokensPath);
    const index = tokens.findIndex(t => t.id === id);
    if (index === -1) return res.status(404).json({ error: 'Lien non trouvé' });
    tokens[index].active = false;
    writeJSON(shareTokensPath, tokens);

    // Also remove associated IP entries
    let ips = readJSON(lienIpPath);
    ips = ips.filter(entry => entry.tokenId !== id);
    writeJSON(lienIpPath, ips);

    res.json({ message: 'Lien révoqué' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// Verify access code and lock IP (public)
// =====================
router.post('/verify/:token', (req, res) => {
  try {
    const { token } = req.params;
    const { accessCode } = req.body;

    const tokens = readJSON(shareTokensPath);
    const entry = tokens.find(t => t.token === token && t.active);
    if (!entry) {
      return res.status(403).json({ error: 'Lien invalide ou révoqué' });
    }

    if (entry.accessCode !== accessCode) {
      return res.status(403).json({ error: 'Code d\'accès incorrect' });
    }

    // Get client IP
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

    let ips = readJSON(lienIpPath);
    const existingIp = ips.find(e => e.tokenId === entry.id);

    if (existingIp) {
      // IP already registered - check if it matches
      if (existingIp.ip !== clientIp) {
        return res.status(403).json({ error: 'Accès refusé. Ce lien est déjà associé à un autre appareil.' });
      }
      // Same IP - allow
      return res.json({ verified: true, type: entry.type });
    }

    // First connection - register IP
    ips.push({
      id: Date.now().toString(),
      tokenId: entry.id,
      token: entry.token,
      ip: clientIp,
      type: entry.type,
      registeredAt: new Date().toISOString()
    });
    writeJSON(lienIpPath, ips);

    res.json({ verified: true, type: entry.type, firstConnection: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// View shared data (public, IP-locked)
// =====================
router.get('/view/:token', (req, res) => {
  try {
    const { token } = req.params;
    const tokens = readJSON(shareTokensPath);
    const entry = tokens.find(t => t.token === token && t.active);
    if (!entry) {
      return res.status(403).json({ error: 'Lien invalide ou révoqué' });
    }

    // Check IP
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const ips = readJSON(lienIpPath);
    const registeredIp = ips.find(e => e.tokenId === entry.id);

    if (!registeredIp) {
      return res.status(403).json({ error: 'Accès non autorisé. Veuillez d\'abord entrer le code d\'accès.' });
    }

    if (registeredIp.ip !== clientIp) {
      return res.status(403).json({ error: 'Accès refusé. Ce lien est associé à un autre appareil.' });
    }

    // Helper to filter data by entry.filters
    const applyDateFilter = (items, dateField, filters) => {
      if (!filters || !filters.dateFilter || filters.dateFilter.mode === 'all') return items;
      const df = filters.dateFilter;
      if (df.mode === 'jours') {
        return items.filter(i => df.days.includes(i[dateField]));
      }
      if (df.mode === 'mois') {
        return items.filter(i => {
          const d = new Date(i[dateField]);
          return df.months.includes(d.getMonth()) && d.getFullYear() === df.year;
        });
      }
      if (df.mode === 'semaines') {
        return items.filter(i => {
          const d = new Date(i[dateField]);
          if (d.getFullYear() !== df.year) return false;
          const jan1 = new Date(df.year, 0, 1);
          const dayOfYear = Math.floor((d - jan1) / 86400000) + 1;
          const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7);
          const wStr = `${df.year}-W${String(weekNum).padStart(2, '0')}`;
          return df.weeks.includes(wStr);
        });
      }
      if (df.mode === 'annees') {
        return items.filter(i => df.years.includes(new Date(i[dateField]).getFullYear()));
      }
      return items;
    };

    const applyPersonFilter = (items, filters, nameField, idField) => {
      if (!filters || !filters.personne || filters.personne === 'all') return items;
      return items.filter(i => i[idField] === filters.personne || i[nameField] === filters.personne);
    };

    if (entry.type === 'notes') {
      const notes = readJSON(notesPath).map(n => ({
        title: n.title, content: n.content, columnId: n.columnId,
        order: n.order, color: n.color, bold: n.bold,
        boldLines: n.boldLines || [], underlineLines: n.underlineLines || [],
        drawing: n.drawing, voiceText: n.voiceText || '', createdAt: n.createdAt
      }));
      const columns = readJSON(columnsPath).map(c => ({
        id: c.id, title: c.title, color: c.color, order: c.order
      }));
      return res.json({ type: 'notes', notes, columns });
    }

    if (entry.type === 'pointage') {
      let pointages = readJSON(pointagePath).map(p => ({
        id: p.id, date: p.date, entrepriseId: p.entrepriseId, entrepriseNom: p.entrepriseNom,
        typePaiement: p.typePaiement, heures: p.heures, prixJournalier: p.prixJournalier,
        prixHeure: p.prixHeure, montantTotal: p.montantTotal,
        travailleurId: p.travailleurId || '', travailleurNom: p.travailleurNom || '', createdAt: p.createdAt
      }));
      const f = entry.filters;
      pointages = applyPersonFilter(pointages, f, 'travailleurNom', 'travailleurId');
      pointages = applyDateFilter(pointages, 'date', f);
      if (f && f.entreprises && f.entreprises !== 'all') {
        pointages = pointages.filter(p => f.entreprises.includes(p.entrepriseId));
      }
      return res.json({ type: 'pointage', pointages });
    }

    if (entry.type === 'taches') {
      let taches = readJSON(tachePath).map(t => ({
        id: t.id, date: t.date, heureDebut: t.heureDebut, heureFin: t.heureFin,
        description: t.description, importance: t.importance,
        travailleurId: t.travailleurId || '', travailleurNom: t.travailleurNom || '',
        completed: t.completed || false, createdAt: t.createdAt
      }));
      const f = entry.filters;
      taches = applyPersonFilter(taches, f, 'travailleurNom', 'travailleurId');
      taches = applyDateFilter(taches, 'date', f);
      if (f && f.importance && f.importance !== 'all') {
        taches = taches.filter(t => t.importance === f.importance);
      }
      return res.json({ type: 'taches', taches });
    }

    res.status(400).json({ error: 'Type inconnu' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
