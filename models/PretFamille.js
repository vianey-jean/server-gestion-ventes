
const fs = require('fs');
const path = require('path');

const pretFamillesPath = path.join(__dirname, '../db/pretfamilles.json');

// Fonction pour lire tous les prêts familles
const getAllPretFamilles = () => {
  try {
    if (!fs.existsSync(pretFamillesPath)) {
      return [];
    }
    const data = fs.readFileSync(pretFamillesPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur lors de la lecture des prêts familles:', error);
    return [];
  }
};

// Fonction pour obtenir un prêt famille par ID
const getPretFamilleById = (id) => {
  const pretFamilles = getAllPretFamilles();
  return pretFamilles.find(pretFamille => pretFamille.id === id);
};

// Fonction pour créer un nouveau prêt famille
const createPretFamille = (pretFamille) => {
  try {
    const pretFamilles = getAllPretFamilles();
    
    // Générer un nouvel ID
    const newId = pretFamilles.length > 0 
      ? (Math.max(...pretFamilles.map(p => parseInt(p.id))) + 1).toString() 
      : '1';
    
    const newPretFamille = {
      id: newId,
      ...pretFamille
    };
    
    pretFamilles.push(newPretFamille);
    fs.writeFileSync(pretFamillesPath, JSON.stringify(pretFamilles, null, 2));
    
    return newPretFamille;
  } catch (error) {
    console.error('Erreur lors de la création d\'un prêt famille:', error);
    throw error;
  }
};

// Fonction pour mettre à jour un prêt famille
const updatePretFamille = (id, updatedPretFamille) => {
  try {
    let pretFamilles = getAllPretFamilles();
    const index = pretFamilles.findIndex(pretFamille => pretFamille.id === id);
    
    if (index === -1) {
      throw new Error('Prêt famille non trouvé');
    }
    
    pretFamilles[index] = {
      ...pretFamilles[index],
      ...updatedPretFamille,
      id // S'assurer que l'ID reste inchangé
    };
    
    fs.writeFileSync(pretFamillesPath, JSON.stringify(pretFamilles, null, 2));
    
    return pretFamilles[index];
  } catch (error) {
    console.error('Erreur lors de la mise à jour d\'un prêt famille:', error);
    throw error;
  }
};

// Fonction pour supprimer un prêt famille
const deletePretFamille = (id) => {
  try {
    let pretFamilles = getAllPretFamilles();
    const index = pretFamilles.findIndex(pretFamille => pretFamille.id === id);
    
    if (index === -1) {
      throw new Error('Prêt famille non trouvé');
    }
    
    pretFamilles.splice(index, 1);
    fs.writeFileSync(pretFamillesPath, JSON.stringify(pretFamilles, null, 2));
    
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression d\'un prêt famille:', error);
    throw error;
  }
};

// Fonction pour rechercher des prêts familles par nom
const searchPretFamillesByName = (query) => {
  try {
    const pretFamilles = getAllPretFamilles();
    if (!query || query.length < 3) {
      return [];
    }
    
    const normalizedQuery = query.toLowerCase();
    return pretFamilles.filter(pretFamille => 
      pretFamille.nom.toLowerCase().includes(normalizedQuery)
    );
  } catch (error) {
    console.error('Erreur lors de la recherche de prêts familles:', error);
    return [];
  }
};

module.exports = {
  getAllPretFamilles,
  getPretFamilleById,
  createPretFamille,
  updatePretFamille,
  deletePretFamille,
  searchPretFamillesByName
};
