/**
 * ListesFidelite - CRUD sur listes-fidelite.json (paliers de fidélité configurables).
 * Chaque palier: { id, label, min, max|null, order, grad }.
 * max=null signifie palier ouvert (∞). Aucun chevauchement autorisé.
 */
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../db/listes-fidelite.json');

const DEFAULTS = [
  { id: 'nouveau', label: 'Nouveau Client', min: 0, max: 0, order: 0, grad: 'from-slate-500 to-slate-700' },
  { id: 'standard', label: 'Client Standard', min: 1, max: 1, order: 1, grad: 'from-sky-500 to-blue-600' },
  { id: 'bon', label: 'Bon Client', min: 2, max: 2, order: 2, grad: 'from-emerald-500 to-teal-600' },
  { id: 'fidele', label: 'Client Fidèle', min: 3, max: 4, order: 3, grad: 'from-purple-500 via-fuchsia-500 to-pink-500' },
  { id: 'vip', label: 'Client VIP', min: 5, max: null, order: 4, grad: 'from-yellow-400 via-amber-500 to-orange-500' },
];

const read = () => {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(raw) && raw.length > 0) return raw;
  } catch {}
  return DEFAULTS.slice();
};

const write = (list) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
    return true;
  } catch (e) { console.error('ListesFidelite write:', e); return false; }
};

const sorted = (list) => list.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.min ?? 0) - (b.min ?? 0));

/** Retourne une erreur (string) si chevauchement, sinon null. */
const validate = (list) => {
  const s = sorted(list);
  for (const t of s) {
    if (typeof t.min !== 'number' || t.min < 0) return `Palier "${t.label}" : minimum invalide.`;
    if (t.max !== null && (typeof t.max !== 'number' || t.max < t.min)) return `Palier "${t.label}" : maximum invalide.`;
  }
  for (let i = 0; i < s.length; i++) {
    for (let j = i + 1; j < s.length; j++) {
      const a = s[i], b = s[j];
      const aMax = a.max === null ? Infinity : a.max;
      const bMax = b.max === null ? Infinity : b.max;
      const overlap = Math.max(a.min, b.min) <= Math.min(aMax, bMax);
      if (overlap) return `Chevauchement entre "${a.label}" et "${b.label}".`;
    }
  }
  return null;
};

const tierFor = (count, list) => {
  const c = Number(count) || 0;
  const s = sorted(list || read());
  for (const t of s) {
    const max = t.max === null ? Infinity : t.max;
    if (c >= t.min && c <= max) return t;
  }
  return s[0] || DEFAULTS[0];
};

const slugify = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `tier-${Date.now()}`;

module.exports = {
  DEFAULTS,
  getAll: () => sorted(read()),
  tierFor,
  validate,
  replace: (list) => {
    const err = validate(list);
    if (err) return { ok: false, error: err };
    write(sorted(list));
    return { ok: true, list: sorted(list) };
  },
  add: (tier) => {
    const list = read();
    const id = tier.id || slugify(tier.label);
    if (list.some(t => t.id === id)) return { ok: false, error: 'Identifiant déjà utilisé.' };
    const next = [...list, {
      id,
      label: tier.label || 'Nouveau palier',
      min: Number(tier.min) || 0,
      max: tier.max === null || tier.max === undefined || tier.max === '' ? null : Number(tier.max),
      order: typeof tier.order === 'number' ? tier.order : list.length,
      grad: tier.grad || 'from-slate-500 to-slate-700',
    }];
    const err = validate(next);
    if (err) return { ok: false, error: err };
    write(sorted(next));
    return { ok: true, list: sorted(next) };
  },
  update: (id, patch) => {
    const list = read();
    const idx = list.findIndex(t => t.id === id);
    if (idx < 0) return { ok: false, error: 'Palier introuvable.' };
    const updated = { ...list[idx], ...patch };
    if (patch.max === null || patch.max === '' || patch.max === undefined) updated.max = patch.max === null ? null : (patch.max === undefined ? list[idx].max : null);
    updated.min = Number(updated.min);
    updated.max = updated.max === null ? null : Number(updated.max);
    const next = list.map((t, i) => i === idx ? updated : t);
    const err = validate(next);
    if (err) return { ok: false, error: err };
    write(sorted(next));
    return { ok: true, list: sorted(next) };
  },
  remove: (id) => {
    const list = read();
    if (list.length <= 1) return { ok: false, error: 'Au moins un palier doit exister.' };
    const next = list.filter(t => t.id !== id);
    if (next.length === list.length) return { ok: false, error: 'Palier introuvable.' };
    write(sorted(next));
    return { ok: true, list: sorted(next) };
  },
};
