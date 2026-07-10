/**
 * ProductAttribute - Factory générique pour attributs de produit
 * (modele, taille, couleur, devant). Chaque attribut est stocké dans son
 * propre fichier JSON avec la même structure { id, nom, description, dateCreation }.
 */
const fs = require('fs');
const path = require('path');

function createStore(fileName) {
  const filePath = path.join(__dirname, '../db/', fileName);
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '[]');

  const read = () => {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch { return []; }
  };
  const write = (data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  return {
    getAll: () => read(),
    create: (nom, description = '') => {
      const trimmed = (nom || '').trim();
      if (!trimmed) return null;
      const items = read();
      const existing = items.find(i => (i.nom || '').toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing;
      const item = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        nom: trimmed,
        description: (description || '').trim(),
        dateCreation: new Date().toISOString(),
      };
      items.push(item);
      write(items);
      return item;
    },
    update: (id, patch) => {
      const items = read();
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return null;
      items[idx] = { ...items[idx], ...patch };
      write(items);
      return items[idx];
    },
    delete: (id) => {
      const items = read();
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return false;
      items.splice(idx, 1);
      write(items);
      return true;
    },
  };
}

module.exports = { createStore };