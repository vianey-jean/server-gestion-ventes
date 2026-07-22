/**
 * Service de nettoyage automatique des réservations ultérieures
 * - Purge les réservations avec statut 'ulterieur' passées expiresAt (10 jours)
 * - Fournit la liste des réservations qui expirent dans les prochaines 24h
 */
const path = require('path');
const { readJsonDecrypted, writeJsonEncrypted } = require('../middleware/encryption');

const commandesPath = path.join(__dirname, '../db/commandes.json');
const productsPath = path.join(__dirname, '../db/products.json');

function safeRead(p, fallback) {
  try { return readJsonDecrypted(p) || fallback; } catch { return fallback; }
}

function purgeExpired() {
  const commandes = safeRead(commandesPath, []);
  const now = Date.now();
  const kept = [];
  const purged = [];
  for (const c of commandes) {
    if (c.statut === 'ulterieur' && c.expiresAt && new Date(c.expiresAt).getTime() <= now) {
      purged.push(c);
    } else {
      kept.push(c);
    }
  }
  if (purged.length === 0) return { purged: 0 };
  writeJsonEncrypted(commandesPath, kept);
  // Libérer les produits marqués reserver='oui' qui n'apparaissent plus dans aucune réservation active
  try {
    const products = safeRead(productsPath, []);
    const stillReservedNames = new Set(
      kept
        .filter(c => c.type === 'reservation' && c.statut !== 'valide' && c.statut !== 'annule')
        .flatMap(c => (c.produits || []).map(p => (p.nom || '').toLowerCase()))
    );
    let changed = false;
    for (const prod of products) {
      if (prod.reserver === 'oui' && !stillReservedNames.has((prod.description || '').toLowerCase())) {
        prod.reserver = 'non';
        changed = true;
      }
    }
    if (changed) writeJsonEncrypted(productsPath, products);
  } catch (e) { console.error('[reservationCleanup] libération produits:', e.message); }
  console.log(`[reservationCleanup] Purgé ${purged.length} réservation(s) ultérieure(s) expirée(s)`);
  return { purged: purged.length, ids: purged.map(p => p.id) };
}

function getExpiringSoon() {
  const commandes = safeRead(commandesPath, []);
  const now = Date.now();
  const in24h = now + 24 * 60 * 60 * 1000;
  return commandes
    .filter(c => c.statut === 'ulterieur' && c.expiresAt)
    .map(c => ({ ...c, msLeft: new Date(c.expiresAt).getTime() - now }))
    .filter(c => c.msLeft > 0 && c.msLeft <= 24 * 60 * 60 * 1000);
}

let intervalRef = null;
function start() {
  if (intervalRef) return;
  // Purge immédiate au boot puis toutes les 15 minutes
  try { purgeExpired(); } catch (e) { console.error('[reservationCleanup] boot:', e.message); }
  intervalRef = setInterval(() => {
    try { purgeExpired(); } catch (e) { console.error('[reservationCleanup] tick:', e.message); }
  }, 15 * 60 * 1000);
  console.log('🧹 Service de nettoyage réservations ultérieures actif (toutes les 15 min)');
}

module.exports = { start, purgeExpired, getExpiringSoon };
