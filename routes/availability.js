/**
 * availability.js - Créneaux disponibles agrégés (commandes + rdv-taches + tâches)
 *
 * GET /api/availability/slots?date=YYYY-MM-DD[&excludeCommandeId=xxx]
 *  → { busy: [{start, end, source, label}], freeSlots: [{start, end}] }
 */
const express = require('express');
const path = require('path');
const router = express.Router();
const { readJsonDecrypted } = require('../middleware/encryption');
const authMiddleware = require('../middleware/auth');

const COMMANDES = path.join(__dirname, '../db/commandes.json');
const RDV_TACHES = path.join(__dirname, '../db/rdv-taches.json');
const TACHES = path.join(__dirname, '../db/tache.json');

const DAY_START = 4 * 60;      // 04:00
const DAY_END = 23 * 60 + 59;  // 23:59

const safeRead = (p) => {
  try { return readJsonDecrypted(p) || []; } catch { return []; }
};
const toMin = (t) => {
  if (!t) return null;
  const [h, m] = String(t).split(':').map(Number);
  if (isNaN(h)) return null;
  return (h || 0) * 60 + (m || 0);
};
const toTime = (min) => {
  const safe = Math.max(0, Math.min(DAY_END, min));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

const parseHoraireRange = (horaire, horaireFin) => {
  if (!horaire) return null;
  const clean = String(horaire).trim();
  if (clean.includes('-')) {
    const [a, b] = clean.split('-').map(x => x.trim());
    const s = toMin(a); const e = toMin(b);
    if (s != null && e != null && e > s) return { s, e };
  }
  const s = toMin(clean);
  const e = toMin(horaireFin);
  if (s != null && e != null && e > s) return { s, e };
  if (s != null) return { s, e: Math.min(DAY_END, s + 60) };
  return null;
};

router.get('/slots', authMiddleware, (req, res) => {
  try {
    const { date, excludeCommandeId } = req.query;
    if (!date) return res.status(400).json({ error: 'date requise (YYYY-MM-DD)' });

    const busy = [];

    // Commandes actives (arrive/en_route/planifie) sur cette date
    const commandes = safeRead(COMMANDES);
    commandes.forEach(c => {
      if (excludeCommandeId && c.id === excludeCommandeId) return;
      if (['annule', 'valide'].includes(c.statut)) return;
      const d = c.dateArrivagePrevue || c.dateEcheance;
      if (d !== date) return;
      const r = parseHoraireRange(c.horaire, c.horaireFin);
      if (r) busy.push({ start: toTime(r.s), end: toTime(r.e), source: 'commande', label: c.clientNom || 'Commande' });
    });

    // Rdv-taches
    const rdvTaches = safeRead(RDV_TACHES);
    rdvTaches.forEach(r => {
      if (r.date !== date) return;
      if (['annule', 'termine'].includes(r.statut)) return;
      if (excludeCommandeId && r.commandeId === excludeCommandeId) return;
      const s = toMin(r.heureDebut); const e = toMin(r.heureFin);
      if (s != null && e != null && e > s) busy.push({ start: toTime(s), end: toTime(e), source: 'rdv', label: r.tacheNom || r.clientNom });
    });

    // Tâches
    const taches = safeRead(TACHES);
    taches.forEach(t => {
      if (t.date !== date) return;
      if (t.completed) return;
      if (excludeCommandeId && t.commandeId === excludeCommandeId) return;
      const s = toMin(t.heureDebut); const e = toMin(t.heureFin || t.heureDebut);
      if (s != null && e != null && e > s) busy.push({ start: toTime(s), end: toTime(e), source: 'tache', label: t.description || 'Tâche' });
    });

    // Build free slots
    const sorted = [...busy].map(b => ({ s: toMin(b.start), e: toMin(b.end) })).sort((a, b) => a.s - b.s);
    const freeSlots = [];
    let cursor = DAY_START;
    sorted.forEach(({ s, e }) => {
      if (s > cursor) freeSlots.push({ start: toTime(cursor), end: toTime(s - 1) });
      cursor = Math.max(cursor, e + 1);
    });
    if (cursor <= DAY_END) freeSlots.push({ start: toTime(cursor), end: toTime(DAY_END) });

    res.json({ busy, freeSlots });
  } catch (err) {
    console.error('availability/slots error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/availability/check?date&heureDebut&heureFin[&excludeCommandeId]
 *  → { available: boolean, conflicts: [...] }
 */
router.get('/check', authMiddleware, (req, res) => {
  try {
    const { date, heureDebut, heureFin, excludeCommandeId } = req.query;
    if (!date || !heureDebut || !heureFin) {
      return res.status(400).json({ error: 'date, heureDebut, heureFin requis' });
    }
    const s = toMin(heureDebut); const e = toMin(heureFin);
    if (s == null || e == null || e <= s) return res.status(400).json({ error: 'Plage invalide' });

    // Reuse the slots endpoint logic
    req.query.date = date;
    const collect = () => {
      const busy = [];
      const commandes = safeRead(COMMANDES);
      commandes.forEach(c => {
        if (excludeCommandeId && c.id === excludeCommandeId) return;
        if (['annule', 'valide'].includes(c.statut)) return;
        const d = c.dateArrivagePrevue || c.dateEcheance;
        if (d !== date) return;
        const r = parseHoraireRange(c.horaire, c.horaireFin);
        if (r) busy.push({ start: toTime(r.s), end: toTime(r.e), source: 'commande', label: c.clientNom || 'Commande' });
      });
      const rdvTaches = safeRead(RDV_TACHES);
      rdvTaches.forEach(r => {
        if (r.date !== date) return;
        if (['annule', 'termine'].includes(r.statut)) return;
        if (excludeCommandeId && r.commandeId === excludeCommandeId) return;
        const rs = toMin(r.heureDebut); const re = toMin(r.heureFin);
        if (rs != null && re != null) busy.push({ start: toTime(rs), end: toTime(re), source: 'rdv', label: r.tacheNom });
      });
      const taches = safeRead(TACHES);
      taches.forEach(t => {
        if (t.date !== date) return;
        if (t.completed) return;
        if (excludeCommandeId && t.commandeId === excludeCommandeId) return;
        const ts = toMin(t.heureDebut); const te = toMin(t.heureFin || t.heureDebut);
        if (ts != null && te != null) busy.push({ start: toTime(ts), end: toTime(te), source: 'tache', label: t.description });
      });
      return busy;
    };
    const busy = collect();
    const conflicts = busy.filter(b => {
      const bs = toMin(b.start); const be = toMin(b.end);
      return s < be && e > bs;
    });
    res.json({ available: conflicts.length === 0, conflicts });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
