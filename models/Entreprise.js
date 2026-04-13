const path = require('path');
const { readJsonDecrypted, writeJsonEncrypted } = require('../middleware/encryption');

const entreprisePath = path.join(__dirname, '../db/entreprise.json');

const readEntreprises = () => {
  const data = readJsonDecrypted(entreprisePath);
  return Array.isArray(data) ? data : [];
};

const Entreprise = {
  getAll: () => {
    try {
      return readEntreprises();
    } catch (error) {
      return [];
    }
  },

  getById: (id) => {
    try {
      const items = readEntreprises();
      return items.find(item => item.id === id) || null;
    } catch (error) {
      return null;
    }
  },

  create: (itemData) => {
    try {
      const items = readEntreprises();
      const newItem = {
        id: Date.now().toString(),
        ...itemData,
        createdAt: new Date().toISOString()
      };
      items.push(newItem);
      writeJsonEncrypted(entreprisePath, items);
      return newItem;
    } catch (error) {
      console.error('Error creating entreprise:', error);
      return null;
    }
  },

  update: (id, itemData) => {
    try {
      let items = readEntreprises();
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return null;
      items[index] = { ...items[index], ...itemData };
      writeJsonEncrypted(entreprisePath, items);
      return items[index];
    } catch (error) {
      console.error('Error updating entreprise:', error);
      return null;
    }
  },

  delete: (id) => {
    try {
      let items = readEntreprises();
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      writeJsonEncrypted(entreprisePath, items);
      return true;
    } catch (error) {
      console.error('Error deleting entreprise:', error);
      return false;
    }
  }
};

module.exports = Entreprise;
