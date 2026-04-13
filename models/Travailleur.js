const path = require('path');
const { readJsonDecrypted, writeJsonEncrypted } = require('../middleware/encryption');

const travailleurPath = path.join(__dirname, '../db/travailleur.json');

const readTravailleurs = () => {
  const data = readJsonDecrypted(travailleurPath);
  return Array.isArray(data) ? data : [];
};

const Travailleur = {
  getAll: () => {
    try {
      return readTravailleurs();
    } catch (error) {
      return [];
    }
  },

  getById: (id) => {
    try {
      const items = readTravailleurs();
      return items.find(item => item.id === id) || null;
    } catch (error) {
      return null;
    }
  },

  search: (query) => {
    try {
      const items = readTravailleurs();
      const q = query.toLowerCase();
      return items.filter(item => 
        (item.nom && item.nom.toLowerCase().includes(q)) ||
        (item.prenom && item.prenom.toLowerCase().includes(q)) ||
        (`${item.nom} ${item.prenom}`.toLowerCase().includes(q)) ||
        (`${item.prenom} ${item.nom}`.toLowerCase().includes(q))
      );
    } catch (error) {
      return [];
    }
  },

  create: (itemData) => {
    try {
      const items = readTravailleurs();
      const newItem = {
        id: Date.now().toString(),
        ...itemData,
        createdAt: new Date().toISOString()
      };
      items.push(newItem);
      writeJsonEncrypted(travailleurPath, items);
      return newItem;
    } catch (error) {
      console.error('Error creating travailleur:', error);
      return null;
    }
  },

  update: (id, itemData) => {
    try {
      let items = readTravailleurs();
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return null;
      items[index] = { ...items[index], ...itemData };
      writeJsonEncrypted(travailleurPath, items);
      return items[index];
    } catch (error) {
      console.error('Error updating travailleur:', error);
      return null;
    }
  },

  delete: (id) => {
    try {
      let items = readTravailleurs();
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      writeJsonEncrypted(travailleurPath, items);
      return true;
    } catch (error) {
      console.error('Error deleting travailleur:', error);
      return false;
    }
  }
};

module.exports = Travailleur;