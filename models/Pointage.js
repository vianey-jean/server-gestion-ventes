const fs = require('fs');
const path = require('path');

const pointagePath = path.join(__dirname, '../db/pointage.json');

const Pointage = {
  getAll: () => {
    try {
      const data = fs.readFileSync(pointagePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  },

  getByMonth: (year, month) => {
    try {
      const data = fs.readFileSync(pointagePath, 'utf8');
      const items = JSON.parse(data);
      return items.filter(item => {
        const d = new Date(item.date);
        return d.getFullYear() === parseInt(year) && d.getMonth() + 1 === parseInt(month);
      });
    } catch (error) {
      return [];
    }
  },

  getByYear: (year) => {
    try {
      const data = fs.readFileSync(pointagePath, 'utf8');
      const items = JSON.parse(data);
      return items.filter(item => {
        const d = new Date(item.date);
        return d.getFullYear() === parseInt(year);
      });
    } catch (error) {
      return [];
    }
  },

  getByDate: (date) => {
    try {
      const data = fs.readFileSync(pointagePath, 'utf8');
      const items = JSON.parse(data);
      return items.filter(item => item.date === date);
    } catch (error) {
      return [];
    }
  },

  getById: (id) => {
    try {
      const data = fs.readFileSync(pointagePath, 'utf8');
      const items = JSON.parse(data);
      return items.find(item => item.id === id) || null;
    } catch (error) {
      return null;
    }
  },

  create: (itemData) => {
    try {
      const data = fs.readFileSync(pointagePath, 'utf8');
      const items = JSON.parse(data);
      const newItem = {
        id: Date.now().toString(),
        ...itemData,
        createdAt: new Date().toISOString()
      };
      items.push(newItem);
      fs.writeFileSync(pointagePath, JSON.stringify(items, null, 2));
      return newItem;
    } catch (error) {
      console.error('Error creating pointage:', error);
      return null;
    }
  },

  update: (id, itemData) => {
    try {
      const data = fs.readFileSync(pointagePath, 'utf8');
      let items = JSON.parse(data);
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return null;
      items[index] = { ...items[index], ...itemData };
      fs.writeFileSync(pointagePath, JSON.stringify(items, null, 2));
      return items[index];
    } catch (error) {
      console.error('Error updating pointage:', error);
      return null;
    }
  },

  delete: (id) => {
    try {
      const data = fs.readFileSync(pointagePath, 'utf8');
      let items = JSON.parse(data);
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      fs.writeFileSync(pointagePath, JSON.stringify(items, null, 2));
      return true;
    } catch (error) {
      console.error('Error deleting pointage:', error);
      return false;
    }
  }
};

module.exports = Pointage;
