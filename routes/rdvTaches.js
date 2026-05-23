/**
 * rdvTaches.js - RDV liés aux tâches de coiffure (tissages, tresses, perruques, etc.)
 * Stocke dans server/db/rdv-taches.json
 *
 * Champs : id, personneId, personneNom, clientId, clientNom, tacheId, tacheNom,
 *          lieu, telephone, date, heureDebut, heureFin, commentaires,
 *          statut (planifie|confirme|annule|reporte|termine), createdAt, updatedAt
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const FILE = path.join(__dirname, '../db/rdv-taches.json');

const read = () => {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
};
const write = (data) => fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

const DAY_START = 4 * 60;       // 04:00
const DAY_END = 23 * 60 + 59;   // 23:59

const toMin = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toTime = (min) => {
  const safe = Math.max(0, Math.min(DAY_END, min));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

const checkConflict = (items, date, heureDebut, heureFin, excludeId) => {
  const s = toMin(heureDebut);
  const e = toMin(heureFin);
  return items.find(r => {
    if (r.id === excludeId) return false;
    if (r.date !== date) return false;
    if (r.statut === 'annule' || r.statut === 'termine') return false;
    const rs = toMin(r.heureDebut);
    const re = toMin(r.heureFin);
    return s < re && e > rs;
  }) || null;
};

const buildFreeSlots = (items, date) => {
  const occupied = items
    .filter(r => r.date === date && r.statut !== 'annule' && r.statut !== 'termine')
    .map(r => ({ s: toMin(r.heureDebut), e: toMin(r.heureFin) }))
    .sort((a, b) => a.s - b.s);
  const slots = [];
  let cursor = DAY_START;
  occupied.forEach(({ s, e }) => {
    if (s > cursor) slots.push({ start: toTime(cursor), end: toTime(s - 1) });
    cursor = Math.max(cursor, e + 1);
  });
  if (cursor <= DAY_END) slots.push({ start: toTime(cursor), end: toTime(DAY_END) });
  return slots.filter(sl => toMin(sl.start) < toMin(sl.end));
};

router.get('/', (req, res) => {
  try {
    const { date, year, month } = req.query;
    let items = read();
    if (date) items = items.filter(r => r.date === date);
    else if (year && month) {
      items = items.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
      });
    } else if (year) {
      items = items.filter(r => new Date(r.date).getFullYear() === parseInt(year));
    }
    res.json(items);
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.get('/free-slots', (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date requise' });
    res.json(buildFreeSlots(read(), date));
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.post('/', (req, res) => {
  try {
    const data = req.body || {};
    const required = ['clientNom', 'tacheNom', 'date', 'heureDebut', 'heureFin'];
    for (const f of required) {
      if (!data[f]) return res.status(400).json({ error: `Champ requis: ${f}` });
    }
    const s = toMin(data.heureDebut);
    const e = toMin(data.heureFin);
    if (s < DAY_START || e > DAY_END || e <= s) {
      return res.status(400).json({ error: 'Plage horaire invalide (04:00 - 23:59)' });
    }
    const items = read();
    const conflict = checkConflict(items, data.date, data.heureDebut, data.heureFin);
    if (conflict) {
      return res.status(409).json({
        error: `Créneau occupé par "${conflict.tacheNom}" (${conflict.heureDebut} - ${conflict.heureFin})`,
        conflict,
        freeSlots: buildFreeSlots(items, data.date)
      });
    }
    const now = new Date().toISOString();
    const item = {
      id: Date.now().toString(),
      personneId: data.personneId || '',
      personneNom: data.personneNom || '',
      clientId: data.clientId || '',
      clientNom: data.clientNom,
      clientTelephone: data.clientTelephone || data.telephone || '',
      tacheId: data.tacheId || '',
      tacheNom: data.tacheNom,
      lieu: data.lieu || '',
      telephone: data.telephone || data.clientTelephone || '',
      date: data.date,
      heureDebut: data.heureDebut,
      heureFin: data.heureFin,
      commentaires: data.commentaires || '',
      statut: data.statut || 'planifie',
      createdAt: now,
      updatedAt: now
    };
    items.push(item);
    write(items);
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.put('/:id', (req, res) => {
  try {
    const items = read();
    const idx = items.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Introuvable' });
    const existing = items[idx];
    const next = { ...existing, ...req.body, id: existing.id, updatedAt: new Date().toISOString() };
    if (next.date !== existing.date || next.heureDebut !== existing.heureDebut || next.heureFin !== existing.heureFin) {
      const s = toMin(next.heureDebut);
      const e = toMin(next.heureFin);
      if (s < DAY_START || e > DAY_END || e <= s) {
        return res.status(400).json({ error: 'Plage horaire invalide (04:00 - 23:59)' });
      }
      const conflict = checkConflict(items, next.date, next.heureDebut, next.heureFin, existing.id);
      if (conflict) {
        return res.status(409).json({
          error: `Créneau occupé par "${conflict.tacheNom}" (${conflict.heureDebut} - ${conflict.heureFin})`,
          conflict,
          freeSlots: buildFreeSlots(items.filter(r => r.id !== existing.id), next.date)
        });
      }
    }
    items[idx] = next;
    write(items);
    res.json(next);
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.delete('/:id', (req, res) => {
  try {
    const items = read();
    const filtered = items.filter(r => r.id !== req.params.id);
    if (filtered.length === items.length) return res.status(404).json({ error: 'Introuvable' });
    write(filtered);
    res.json({ message: 'Supprimé' });
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;
