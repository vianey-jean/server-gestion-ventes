const fs = require('fs');
const path = require('path');

const entreprisePath = path.join(__dirname, '../db/entreprise.json');

const Entreprise = {
  getAll: () => {
    try {
      const data = fs.readFileSync(entreprisePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  },

  getById: (id) => {
    try {
      const data = fs.readFileSync(entreprisePath, 'utf8');
      const items = JSON.parse(data);
      return items.find(item => item.id === id) || null;
    } catch (error) {
      return null;
    }
  },

  create: (itemData) => {
    try {
      const data = fs.readFileSync(entreprisePath, 'utf8');
      const items = JSON.parse(data);
      const newItem = {
        id: Date.now().toString(),
        ...itemData,
        createdAt: new Date().toISOString()
      };
      items.push(newItem);
      fs.writeFileSync(entreprisePath, JSON.stringify(items, null, 2));
      return newItem;
    } catch (error) {
      console.error('Error creating entreprise:', error);
      return null;
    }
  },

  update: (id, itemData) => {
    try {
      const data = fs.readFileSync(entreprisePath, 'utf8');
      let items = JSON.parse(data);
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return null;
      items[index] = { ...items[index], ...itemData };
      fs.writeFileSync(entreprisePath, JSON.stringify(items, null, 2));
      return items[index];
    } catch (error) {
      console.error('Error updating entreprise:', error);
      return null;
    }
  },

  delete: (id) => {
    try {
      const data = fs.readFileSync(entreprisePath, 'utf8');
      let items = JSON.parse(data);
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      fs.writeFileSync(entreprisePath, JSON.stringify(items, null, 2));
      return true;
    } catch (error) {
      console.error('Error deleting entreprise:', error);
      return false;
    }
  }
};

module.exports = Entreprise;
