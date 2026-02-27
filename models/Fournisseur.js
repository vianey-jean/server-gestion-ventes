/**
 * Modèle Fournisseur - CRUD pour fournisseurs.json
 * 
 * Gère la liste des fournisseurs enregistrés.
 * Un fournisseur est automatiquement créé lors d'un achat
 * si son nom n'existe pas encore dans la base.
 */

const fs = require('fs');
const path = require('path');

const fournisseursPath = path.join(__dirname, '../db/fournisseurs.json');

// Initialiser le fichier s'il n'existe pas
if (!fs.existsSync(fournisseursPath)) {
  fs.writeFileSync(fournisseursPath, JSON.stringify([], null, 2));
}

const Fournisseur = {
  /** Récupérer tous les fournisseurs */
  getAll: () => {
    try {
      const data = fs.readFileSync(fournisseursPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Error reading fournisseurs:', error);
      return [];
    }
  },

  /** Récupérer un fournisseur par ID */
  getById: (id) => {
    try {
      const fournisseurs = Fournisseur.getAll();
      return fournisseurs.find(f => f.id === id) || null;
    } catch (error) {
      console.error('❌ Error finding fournisseur:', error);
      return null;
    }
  },

  /** Rechercher des fournisseurs par nom (partiel) */
  search: (query) => {
    try {
      const fournisseurs = Fournisseur.getAll();
      if (!query || query.length < 1) return fournisseurs;
      return fournisseurs.filter(f =>
        f.nom.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error('❌ Error searching fournisseurs:', error);
      return [];
    }
  },

  /**
   * Créer un fournisseur s'il n'existe pas déjà (par nom exact, insensible à la casse)
   * @returns Le fournisseur existant ou le nouveau créé
   */
  createIfNotExists: (nom) => {
    try {
      if (!nom || nom.trim() === '') return null;

      const trimmedNom = nom.trim();
      const fournisseurs = Fournisseur.getAll();

      const existing = fournisseurs.find(
        f => f.nom.toLowerCase() === trimmedNom.toLowerCase()
      );
      if (existing) return existing;

      const newFournisseur = {
        id: Date.now().toString(),
        nom: trimmedNom,
        dateCreation: new Date().toISOString()
      };

      fournisseurs.push(newFournisseur);
      fs.writeFileSync(fournisseursPath, JSON.stringify(fournisseurs, null, 2));
      console.log('✅ Fournisseur created:', newFournisseur.nom);
      return newFournisseur;
    } catch (error) {
      console.error('❌ Error creating fournisseur:', error);
      return null;
    }
  },

  /** Supprimer un fournisseur par ID */
  delete: (id) => {
    try {
      const fournisseurs = Fournisseur.getAll();
      const index = fournisseurs.findIndex(f => f.id === id);
      if (index === -1) return false;
      fournisseurs.splice(index, 1);
      fs.writeFileSync(fournisseursPath, JSON.stringify(fournisseurs, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Error deleting fournisseur:', error);
      return false;
    }
  }
};

module.exports = Fournisseur;