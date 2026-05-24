/**
 * productsVendu.js — Liste des produits par volume de ventes
 *
 * Agrège les ventes depuis sales.json et les stocks depuis products.json
 * pour produire une liste triée des produits les plus vendus vers les moins
 * vendus (et jamais vendus). Persistée dans products.vendu.json avec une
 * stratégie de mise à jour incrémentale : on ne réinitialise que si des
 * changements sont détectés, en conservant les entrées inchangées.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');

const dbPath = path.join(__dirname, '../db');
const productsPath = path.join(dbPath, 'products.json');
const salesPath = path.join(dbPath, 'sales.json');
const venduPath = path.join(dbPath, 'products.vendu.json');

const readJson = (p, def = []) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; }
};
const writeJson = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2));

const categoryOf = (desc = '') => {
  const d = String(desc).toLowerCase();
  if (d.includes('perruque')) return 'perruque';
  if (d.includes('tissage') || d.includes('extension')) return 'tissage-extension';
  return 'autres';
};

const computeVendu = () => {
  const products = readJson(productsPath, []);
  const sales = readJson(salesPath, []);

  // Map productId -> { qty, totalSelling, totalPurchase, count }
  const stats = new Map();

  const addSale = (sp) => {
    if (!sp || !sp.productId) return;
    const cur = stats.get(sp.productId) || {
      quantitySold: 0, totalSellingPrice: 0, totalPurchasePrice: 0, salesCount: 0
    };
    const qty = Number(sp.quantitySold) || 0;
    cur.quantitySold += qty;
    cur.totalSellingPrice += Number(sp.sellingPrice) || 0;
    cur.totalPurchasePrice += Number(sp.purchasePrice) || 0;
    cur.salesCount += 1;
    stats.set(sp.productId, cur);
  };

  sales.forEach(s => {
    if (s && s.isRefund) return; // ignore remboursements
    if (Array.isArray(s.products) && s.products.length > 0) {
      s.products.forEach(addSale);
    } else if (s && s.productId) {
      addSale(s);
    }
  });

  // Build final list from products
  const list = products.map(p => {
    const st = stats.get(p.id) || { quantitySold: 0, totalSellingPrice: 0, totalPurchasePrice: 0, salesCount: 0 };
    const avgSelling = st.quantitySold > 0 ? st.totalSellingPrice / st.quantitySold : (p.sellingPrice || 0);
    return {
      id: p.id,
      code: p.code || '',
      description: p.description || '',
      category: categoryOf(p.description),
      purchasePrice: Number(p.purchasePrice) || 0,
      sellingPrice: Number(p.sellingPrice) || Math.round(avgSelling),
      avgSellingPrice: Math.round(avgSelling * 100) / 100,
      totalSold: st.quantitySold,
      totalRevenue: Math.round(st.totalSellingPrice * 100) / 100,
      salesCount: st.salesCount,
      stockRestant: Number(p.quantity) || 0,
    };
  });

  // Sort: most sold → least sold → never sold (totalSold = 0 last)
  list.sort((a, b) => {
    if (b.totalSold !== a.totalSold) return b.totalSold - a.totalSold;
    return (a.description || '').localeCompare(b.description || '');
  });

  return list;
};

const itemHash = (item) => {
  const key = `${item.id}|${item.totalSold}|${item.stockRestant}|${item.purchasePrice}|${item.sellingPrice}|${item.description}`;
  return crypto.createHash('sha256').update(key).digest('hex');
};

/**
 * GET / — Récupère la liste, met à jour products.vendu.json si nécessaire
 * (incrémentalement : conserve les entrées inchangées).
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const fresh = computeVendu();
    const existing = readJson(venduPath, { items: [], updatedAt: null });
    const prevItems = Array.isArray(existing) ? existing : (existing.items || []);

    const prevMap = new Map(prevItems.map(it => [it.id, it]));
    let changed = false;
    const merged = fresh.map(it => {
      const prev = prevMap.get(it.id);
      if (!prev || itemHash(prev) !== itemHash(it)) {
        changed = true;
        return { ...it, updatedAt: new Date().toISOString() };
      }
      return prev;
    });

    // Detect removed items
    if (prevItems.length !== fresh.length) changed = true;

    if (changed) {
      writeJson(venduPath, { items: merged, updatedAt: new Date().toISOString() });
    }

    res.json({ items: merged, updatedAt: changed ? new Date().toISOString() : existing.updatedAt });
  } catch (error) {
    console.error('Error computing products vendu:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
