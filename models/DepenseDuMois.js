
const fs = require('fs');
const path = require('path');

const depenseDuMoisPath = path.join(__dirname, '../db/depensedumois.json');
const depenseFixePath = path.join(__dirname, '../db/depensefixe.json');

// Fonction pour lire tous les mouvements du mois
const getAllMouvements = () => {
  try {
    if (!fs.existsSync(depenseDuMoisPath)) {
      return [];
    }
    const data = fs.readFileSync(depenseDuMoisPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur lors de la lecture des mouvements:', error);
    return [];
  }
};

// Fonction pour obtenir un mouvement par ID
const getMouvementById = (id) => {
  const mouvements = getAllMouvements();
  return mouvements.find(mouvement => mouvement.id === id);
};

// Fonction pour créer un nouveau mouvement
const createMouvement = (mouvement) => {
  try {
    const mouvements = getAllMouvements();
    
    // Générer un nouvel ID
    const newId = mouvements.length > 0 
      ? (Math.max(...mouvements.map(m => parseInt(m.id))) + 1).toString() 
      : '1';
    
    // Calculer le nouveau solde
    const lastMouvement = mouvements.length > 0 ? mouvements[mouvements.length - 1] : null;
    const lastSolde = lastMouvement ? lastMouvement.solde : 0;
    
    const newSolde = lastSolde + (mouvement.credit ? parseFloat(mouvement.credit) || 0 : 0) - (mouvement.debit ? parseFloat(mouvement.debit) || 0 : 0);
    
    const newMouvement = {
      id: newId,
      ...mouvement,
      solde: newSolde
    };
    
    mouvements.push(newMouvement);
    fs.writeFileSync(depenseDuMoisPath, JSON.stringify(mouvements, null, 2));
    
    return newMouvement;
  } catch (error) {
    console.error('Erreur lors de la création d\'un mouvement:', error);
    throw error;
  }
};

// Fonction pour mettre à jour un mouvement
const updateMouvement = (id, updatedMouvement) => {
  try {
    let mouvements = getAllMouvements();
    const index = mouvements.findIndex(mouvement => mouvement.id === id);
    
    if (index === -1) {
      throw new Error('Mouvement non trouvé');
    }
    
    // Conserver l'ID et mettre à jour les autres champs
    const mergedMouvement = {
      ...mouvements[index],
      ...updatedMouvement,
      id
    };
    
    mouvements[index] = mergedMouvement;
    
    // Recalculer tous les soldes après l'élément modifié
    for (let i = index; i < mouvements.length; i++) {
      if (i === 0) {
        // Premier élément: le solde est simplement crédit - débit
        mouvements[i].solde = (mouvements[i].credit ? parseFloat(mouvements[i].credit) || 0 : 0) - (mouvements[i].debit ? parseFloat(mouvements[i].debit) || 0 : 0);
      } else {
        // Autres éléments: solde précédent + crédit - débit
        mouvements[i].solde = mouvements[i-1].solde + (mouvements[i].credit ? parseFloat(mouvements[i].credit) || 0 : 0) - (mouvements[i].debit ? parseFloat(mouvements[i].debit) || 0 : 0);
      }
    }
    
    fs.writeFileSync(depenseDuMoisPath, JSON.stringify(mouvements, null, 2));
    
    return mouvements[index];
  } catch (error) {
    console.error('Erreur lors de la mise à jour d\'un mouvement:', error);
    throw error;
  }
};

// Fonction pour supprimer un mouvement
const deleteMouvement = (id) => {
  try {
    let mouvements = getAllMouvements();
    const index = mouvements.findIndex(mouvement => mouvement.id === id);
    
    if (index === -1) {
      throw new Error('Mouvement non trouvé');
    }
    
    mouvements.splice(index, 1);
    
    // Recalculer tous les soldes après la suppression
    for (let i = 0; i < mouvements.length; i++) {
      if (i === 0) {
        // Premier élément: le solde est simplement crédit - débit
        mouvements[i].solde = (mouvements[i].credit ? parseFloat(mouvements[i].credit) || 0 : 0) - (mouvements[i].debit ? parseFloat(mouvements[i].debit) || 0 : 0);
      } else {
        // Autres éléments: solde précédent + crédit - débit
        mouvements[i].solde = mouvements[i-1].solde + (mouvements[i].credit ? parseFloat(mouvements[i].credit) || 0 : 0) - (mouvements[i].debit ? parseFloat(mouvements[i].debit) || 0 : 0);
      }
    }
    
    fs.writeFileSync(depenseDuMoisPath, JSON.stringify(mouvements, null, 2));
    
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression d\'un mouvement:', error);
    throw error;
  }
};

// Fonction pour lire les dépenses fixes
const getDepensesFixe = () => {
  try {
    if (!fs.existsSync(depenseFixePath)) {
      // Valeurs par défaut
      const defaultDepensesFixe = {
        free: 19.99,
        internetZeop: 39.99,
        assuranceVoiture: 85,
        autreDepense: 45,
        assuranceVie: 120,
        total: 309.98
      };
      fs.writeFileSync(depenseFixePath, JSON.stringify(defaultDepensesFixe, null, 2));
      return defaultDepensesFixe;
    }
    const data = fs.readFileSync(depenseFixePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur lors de la lecture des dépenses fixes:', error);
    return {};
  }
};

// Fonction pour mettre à jour les dépenses fixes
const updateDepensesFixe = (depensesFixe) => {
  try {
    // Calculer le total
    const total = 
      parseFloat(depensesFixe.free || 0) + 
      parseFloat(depensesFixe.internetZeop || 0) + 
      parseFloat(depensesFixe.assuranceVoiture || 0) + 
      parseFloat(depensesFixe.autreDepense || 0) + 
      parseFloat(depensesFixe.assuranceVie || 0);
    
    const updatedDepensesFixe = {
      ...depensesFixe,
      total: parseFloat(total.toFixed(2))
    };
    
    fs.writeFileSync(depenseFixePath, JSON.stringify(updatedDepensesFixe, null, 2));
    
    return updatedDepensesFixe;
  } catch (error) {
    console.error('Erreur lors de la mise à jour des dépenses fixes:', error);
    throw error;
  }
};

// Fonction pour réinitialiser tous les mouvements
const resetAllMouvements = () => {
  try {
    fs.writeFileSync(depenseDuMoisPath, JSON.stringify([], null, 2));
    return true;
  } catch (error) {
    console.error('Erreur lors de la réinitialisation des mouvements:', error);
    throw error;
  }
};

module.exports = {
  getAllMouvements,
  getMouvementById,
  createMouvement,
  updateMouvement,
  deleteMouvement,
  getDepensesFixe,
  updateDepensesFixe,
  resetAllMouvements
};
