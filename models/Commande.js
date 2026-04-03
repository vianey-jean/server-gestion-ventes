const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { readJsonDecrypted, writeJsonEncrypted } = require('../middleware/encryption');

const dataPath = path.join(__dirname, '../db/commandes.json');

class Commande {
  static async getAll() {
    try {
      const data = readJsonDecrypted(dataPath);
      return data || [];
    } catch (error) {
      if (error.code === 'ENOENT') {
        writeJsonEncrypted(dataPath, []);
        return [];
      }
      throw error;
    }
  }

  static async getById(id) {
    const commandes = await this.getAll();
    return commandes.find(c => c.id === id);
  }

  static async create(commandeData) {
    const commandes = await this.getAll();
    const newCommande = {
      id: Date.now().toString(),
      ...commandeData,
      createdAt: new Date().toISOString()
    };
    commandes.push(newCommande);
    writeJsonEncrypted(dataPath, commandes);
    return newCommande;
  }

  static async update(id, updates) {
    const commandes = await this.getAll();
    const index = commandes.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Commande not found');
    
    commandes[index] = { ...commandes[index], ...updates, updatedAt: new Date().toISOString() };
    writeJsonEncrypted(dataPath, commandes);
    return commandes[index];
  }

  static async delete(id) {
    const commandes = await this.getAll();
    const filtered = commandes.filter(c => c.id !== id);
    writeJsonEncrypted(dataPath, filtered);
    return true;
  }
}

module.exports = Commande;
