const fs = require('fs');
const path = require('path');

const travailleurPath = path.join(__dirname, '../db/travailleur.json');

const Travailleur = {
  getAll: () => {
    try {
      const data = fs.readFileSync(travailleurPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  },

  getById: (id) => {
    try {
      const data = fs.readFileSync(travailleurPath, 'utf8');
      const items = JSON.parse(data);
      return items.find(item => item.id === id) || null;
    } catch (error) {
      return null;
    }
  },

  search: (query) => {
    try {
      const data = fs.readFileSync(travailleurPath, 'utf8');
      const items = JSON.parse(data);
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
      const data = fs.readFileSync(travailleurPath, 'utf8');
      const items = JSON.parse(data);
      const newItem = {
        id: Date.now().toString(),
        ...itemData,
        createdAt: new Date().toISOString()
      };
      items.push(newItem);
      fs.writeFileSync(travailleurPath, JSON.stringify(items, null, 2));
      return newItem;
    } catch (error) {
      console.error('Error creating travailleur:', error);
      return null;
    }
  },

  update: (id, itemData) => {
    try {
      const data = fs.readFileSync(travailleurPath, 'utf8');
      let items = JSON.parse(data);
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return null;
      items[index] = { ...items[index], ...itemData };
      fs.writeFileSync(travailleurPath, JSON.stringify(items, null, 2));
      return items[index];
    } catch (error) {
      console.error('Error updating travailleur:', error);
      return null;
    }
  },

  delete: (id) => {
    try {
      const data = fs.readFileSync(travailleurPath, 'utf8');
      let items = JSON.parse(data);
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      fs.writeFileSync(travailleurPath, JSON.stringify(items, null, 2));
      return true;
    } catch (error) {
      console.error('Error deleting travailleur:', error);
      return false;
    }
  }
};

module.exports = Travailleur;