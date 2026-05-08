/**
 * Routes Confirmation RDV
 * Snapshot des rendez-vous dans les prochaines 24h + statut de confirmation.
 * Statut: 'en_attente' | 'maintenu' | 'annule' | 'reporter'
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');

const dbPath = path.join(__dirname, '../db/confirmation-rdv.json');

const readJson = () => {
  try {
    if (!fs.existsSync(dbPath)) return [];
    const raw = fs.readFileSync(dbPath, 'utf8');
    if (!raw || !raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeJson = (data) => {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};

router.get('/', authMiddleware, (req, res) => {
  try {
    res.json(readJson());
  } catch (e) {
    console.error('confirmation-rdv get error', e);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Sync entries: upsert; preserve confirmationStatut + history
router.post('/sync', authMiddleware, (req, res) => {
  try {
    const { entries } = req.body || {};
    if (!Array.isArray(entries)) {
      return res.status(400).json({ message: 'entries invalide' });
    }
    const existing = readJson();
    const byId = new Map(existing.map(e => [e.id, e]));
    const now = new Date().toISOString();

    entries.forEach(r => {
      if (!r || !r.id) return;
      const prev = byId.get(r.id) || {};
      byId.set(r.id, {
        id: r.id,
        titre: r.titre || '',
        clientNom: r.clientNom || '',
        clientTelephone: r.clientTelephone || '',
        clientAdresse: r.clientAdresse || '',
        date: r.date,
        heureDebut: r.heureDebut,
        heureFin: r.heureFin,
        lieu: r.lieu || '',
        description: r.description || '',
        produits: Array.isArray(r.produits) ? r.produits : [],
        commandeId: r.commandeId || null,
        statutRdv: r.statut,
        confirmationStatut: prev.confirmationStatut || 'en_attente',
        confirmedAt: prev.confirmedAt || null,
        createdAt: prev.createdAt || now,
        updatedAt: now,
      });
    });

    writeJson(Array.from(byId.values()));
    res.json(Array.from(byId.values()));
  } catch (e) {
    console.error('confirmation-rdv sync error', e);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PATCH /:id { confirmationStatut, ...optional new date/heure }
router.patch('/:id', authMiddleware, (req, res) => {
  try {
    const { confirmationStatut, date, heureDebut, heureFin } = req.body || {};
    const data = readJson();
    const idx = data.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Non trouvé' });
    if (confirmationStatut) data[idx].confirmationStatut = confirmationStatut;
    if (date) data[idx].date = date;
    if (heureDebut) data[idx].heureDebut = heureDebut;
    if (heureFin) data[idx].heureFin = heureFin;
    data[idx].confirmedAt = new Date().toISOString();
    data[idx].updatedAt = new Date().toISOString();
    writeJson(data);
    res.json(data[idx]);
  } catch (e) {
    console.error('confirmation-rdv patch error', e);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
