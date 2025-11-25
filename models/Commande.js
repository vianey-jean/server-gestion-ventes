const fs = require('fs').promises;
const path = require('path');

const dataPath = path.join(__dirname, '../db/commandes.json');

class Commande {
  static async getAll() {
    try {
      const data = await fs.readFile(dataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.writeFile(dataPath, '[]');
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
    await fs.writeFile(dataPath, JSON.stringify(commandes, null, 2));
    return newCommande;
  }

  static async update(id, updates) {
    const commandes = await this.getAll();
    const index = commandes.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Commande not found');
    
    commandes[index] = { ...commandes[index], ...updates, updatedAt: new Date().toISOString() };
    await fs.writeFile(dataPath, JSON.stringify(commandes, null, 2));
    return commandes[index];
  }

  static async delete(id) {
    const commandes = await this.getAll();
    const filtered = commandes.filter(c => c.id !== id);
    await fs.writeFile(dataPath, JSON.stringify(filtered, null, 2));
    return true;
  }
}

module.exports = Commande;
