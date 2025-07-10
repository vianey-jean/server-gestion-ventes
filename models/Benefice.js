
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../db/benefice.json');

// Initialize JSON file if it doesn't exist
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
}

class Benefice {
  static getAll() {
    try {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading benefice data:', error);
      return [];
    }
  }

  static getById(id) {
    const benefices = this.getAll();
    return benefices.find(b => b.id === id);
  }

  static getByProductId(productId) {
    const benefices = this.getAll();
    return benefices.find(b => b.productId === productId);
  }

  static create(beneficeData) {
    try {
      const benefices = this.getAll();
      const newBenefice = {
        id: uuidv4(),
        ...beneficeData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      benefices.push(newBenefice);
      fs.writeFileSync(DB_PATH, JSON.stringify(benefices, null, 2));
      
      return newBenefice;
    } catch (error) {
      console.error('Error creating benefice:', error);
      return null;
    }
  }

  static update(id, updateData) {
    try {
      const benefices = this.getAll();
      const index = benefices.findIndex(b => b.id === id);
      
      if (index === -1) {
        return null;
      }
      
      benefices[index] = {
        ...benefices[index],
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(DB_PATH, JSON.stringify(benefices, null, 2));
      
      return benefices[index];
    } catch (error) {
      console.error('Error updating benefice:', error);
      return null;
    }
  }

  static delete(id) {
    try {
      const benefices = this.getAll();
      const filteredBenefices = benefices.filter(b => b.id !== id);
      
      if (filteredBenefices.length === benefices.length) {
        return false;
      }
      
      fs.writeFileSync(DB_PATH, JSON.stringify(filteredBenefices, null, 2));
      
      return true;
    } catch (error) {
      console.error('Error deleting benefice:', error);
      return false;
    }
  }
}

module.exports = Benefice;
