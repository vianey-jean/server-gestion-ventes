/**
 * Fidelite - Modèle pour la fidélité client.
 * Recalcule depuis sales.json et persiste dans fidelite.json.
 * Structure: { [nomClientNormalise]: { name, count, totalAmount, sales: [...] } }
 */
const fs = require('fs');
const path = require('path');

const salesPath = path.join(__dirname, '../db/sales.json');
const fidelitePath = path.join(__dirname, '../db/fidelite.json');

const norm = (s) => (s || '').trim().toLowerCase();

const readSales = () => {
  try {
    const raw = JSON.parse(fs.readFileSync(salesPath, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
};

const readFidelite = () => {
  try {
    const raw = JSON.parse(fs.readFileSync(fidelitePath, 'utf8'));
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  } catch { return {}; }
};

const writeFidelite = (data) => {
  try {
    fs.writeFileSync(fidelitePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Fidelite write error:', e);
    return false;
  }
};

// Les tiers ne sont plus codés en dur : ils viennent de listes-fidelite.json
// via le modèle ListesFidelite, afin d'être configurables par l'utilisateur.
const ListesFidelite = require('./ListesFidelite');

const tierOf = (count) => {
  const t = ListesFidelite.tierFor(count);
  return t?.id || 'nouveau';
};

const tierLabelOf = (count) => {
  const t = ListesFidelite.tierFor(count);
  return t?.label || 'Nouveau Client';
};


const Fidelite = {
  rebuild: () => {
    const sales = readSales();
    const map = {};
    sales.forEach((s) => {
      const name = (s.clientName || '').trim();
      if (!name) return;
      const key = norm(name);
      if (!map[key]) {
        map[key] = { name, count: 0, totalAmount: 0, sales: [] };
      }
      const amount = Number(s.totalSellingPrice ?? s.sellingPrice ?? 0) || 0;
      map[key].count += 1;
      map[key].totalAmount += amount;
      map[key].sales.push({
        id: s.id,
        date: s.date,
        amount,
        profit: Number(s.totalProfit ?? s.profit ?? 0) || 0,
        products: s.products || (s.description ? [{
          description: s.description,
          quantitySold: s.quantitySold,
          sellingPrice: s.sellingPrice,
          purchasePrice: s.purchasePrice,
        }] : []),
        clientAddress: s.clientAddress,
        clientPhone: s.clientPhone,
        clientVille: s.clientVille,
        isRefund: s.isRefund || false,
      });
    });
    Object.values(map).forEach((entry) => {
      entry.tier = tierOf(entry.count);
      entry.tierLabel = tierLabelOf(entry.count);
      entry.sales.sort((a, b) => new Date(b.date) - new Date(a.date));
    });
    writeFidelite(map);
    return map;
  },

  getAll: () => readFidelite(),

  getByName: (name) => {
    const data = readFidelite();
    return data[norm(name)] || {
      name,
      count: 0,
      totalAmount: 0,
      sales: [],
      tier: 'nouveau',
      tierLabel: 'Nouveau Client',
    };
  },

  tierOf,
  tierLabelOf,
};

module.exports = Fidelite;
