const path = require('path');
const { readJsonDecrypted, writeJsonEncrypted } = require('../middleware/encryption');

const pointagePath = path.join(__dirname, '../db/pointage.json');

const readPointages = () => {
  const data = readJsonDecrypted(pointagePath);
  return Array.isArray(data) ? data : [];
};

const Pointage = {
  getAll: () => {
    try {
      return readPointages();
    } catch (error) {
      return [];
    }
  },

  getByMonth: (year, month) => {
    try {
      const items = readPointages();
      return items.filter(item => {
        const d = new Date(item.date);
        return d.getFullYear() === parseInt(year, 10) && d.getMonth() + 1 === parseInt(month, 10);
      });
    } catch (error) {
      return [];
    }
  },

  getByYear: (year) => {
    try {
      const items = readPointages();
      return items.filter(item => {
        const d = new Date(item.date);
        return d.getFullYear() === parseInt(year, 10);
      });
    } catch (error) {
      return [];
    }
  },

  getByDate: (date) => {
    try {
      const items = readPointages();
      return items.filter(item => item.date === date);
    } catch (error) {
      return [];
    }
  },

  getById: (id) => {
    try {
      const items = readPointages();
      return items.find(item => item.id === id) || null;
    } catch (error) {
      return null;
    }
  },

  create: (itemData) => {
    try {
      const items = readPointages();
      // IDÉMPOTENCE : empêche le doublon (date + travailleurId + entrepriseId)
      // Garantit qu'un même pointage automatique n'est enregistré qu'une seule fois
      // par jour, même si déclenché plusieurs fois après suppression / réinjection.
      if (itemData && itemData.date && itemData.travailleurId && itemData.entrepriseId) {
        const dup = items.find(p =>
          p.date === itemData.date &&
          (p.travailleurId || '') === (itemData.travailleurId || '') &&
          (p.entrepriseId || '') === (itemData.entrepriseId || '')
        );
        if (dup) return dup;
      }
      const newItem = {
        id: Date.now().toString(),
        ...itemData,
        createdAt: new Date().toISOString()
      };
      items.push(newItem);
      writeJsonEncrypted(pointagePath, items);
      return newItem;
    } catch (error) {
      console.error('Error creating pointage:', error);
      return null;
    }
  },

  update: (id, itemData) => {
    try {
      let items = readPointages();
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return null;
      items[index] = { ...items[index], ...itemData };
      writeJsonEncrypted(pointagePath, items);
      return items[index];
    } catch (error) {
      console.error('Error updating pointage:', error);
      return null;
    }
  },

  delete: (id) => {
    try {
      let items = readPointages();
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      writeJsonEncrypted(pointagePath, items);
      return true;
    } catch (error) {
      console.error('Error deleting pointage:', error);
      return false;
    }
  }
};

module.exports = Pointage;
