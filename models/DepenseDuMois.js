
const fs = require('fs');
const path = require('path');

const depenseDuMoisPath = path.join(__dirname, '../db/depensedumois.json');
const depenseFixePath = path.join(__dirname, '../db/depensefixe.json');
const rsaPath = path.join(__dirname, '../db/rsa.json');

// Fonction pour lire toutes les données de la base
const getAllData = () => {
  try {
    if (!fs.existsSync(depenseDuMoisPath)) {
      fs.writeFileSync(depenseDuMoisPath, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(depenseDuMoisPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur lors de la lecture des données:', error);
    return [];
  }
};

// Fonction pour sauvegarder toutes les données
const saveAllData = (data) => {
  try {
    fs.writeFileSync(depenseDuMoisPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des données:', error);
    return false;
  }
};

// Fonction pour obtenir l'entrée du mois en cours (ou la créer si elle n'existe pas)
const getOrCreateCurrentMonthEntry = () => {
  const now = new Date();
  const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  const currentYear = now.getFullYear().toString();
  
  const allData = getAllData();
  
  // Chercher une entrée pour le mois et année en cours
  let currentEntry = allData.find(entry => 
    entry.mois === currentMonth && entry.annee === currentYear
  );
  
  if (!currentEntry) {
    // Créer une nouvelle entrée pour le mois en cours
    const newId = allData.length > 0 
      ? (Math.max(...allData.map(e => parseInt(e.id) || 0)) + 1).toString()
      : '1';
    
    currentEntry = {
      id: newId,
      mois: currentMonth,
      annee: currentYear,
      mouvements: []
    };
    
    allData.push(currentEntry);
    saveAllData(allData);
  }
  
  return currentEntry;
};

// Fonction pour lire tous les mouvements du mois en cours
const getAllMouvements = () => {
  const currentEntry = getOrCreateCurrentMonthEntry();
  return currentEntry.mouvements || [];
};

// Fonction pour obtenir un mouvement par ID (dans le mois en cours)
const getMouvementById = (id) => {
  const mouvements = getAllMouvements();
  return mouvements.find(mouvement => mouvement.id === id);
};

// Fonction pour créer un nouveau mouvement (dans le mois en cours)
const createMouvement = (mouvement) => {
  try {
    const now = new Date();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentYear = now.getFullYear().toString();
    
    const allData = getAllData();
    let currentEntryIndex = allData.findIndex(entry => 
      entry.mois === currentMonth && entry.annee === currentYear
    );
    
    if (currentEntryIndex === -1) {
      // Créer l'entrée du mois si elle n'existe pas
      const newId = allData.length > 0 
        ? (Math.max(...allData.map(e => parseInt(e.id) || 0)) + 1).toString()
        : '1';
      
      allData.push({
        id: newId,
        mois: currentMonth,
        annee: currentYear,
        mouvements: []
      });
      currentEntryIndex = allData.length - 1;
    }
    
    const mouvements = allData[currentEntryIndex].mouvements || [];
    
    // Générer un nouvel ID pour le mouvement
    const newMouvementId = mouvements.length > 0 
      ? (Math.max(...mouvements.map(m => parseInt(m.id) || 0)) + 1).toString() 
      : '1';
    
    // Calculer le nouveau solde
    const lastMouvement = mouvements.length > 0 ? mouvements[mouvements.length - 1] : null;
    const lastSolde = lastMouvement ? lastMouvement.solde : 0;
    
    const newSolde = lastSolde + (mouvement.credit ? parseFloat(mouvement.credit) || 0 : 0) - (mouvement.debit ? parseFloat(mouvement.debit) || 0 : 0);
    
    const newMouvement = {
      id: newMouvementId,
      ...mouvement,
      solde: newSolde
    };
    
    mouvements.push(newMouvement);
    allData[currentEntryIndex].mouvements = mouvements;
    saveAllData(allData);
    
    return newMouvement;
  } catch (error) {
    console.error('Erreur lors de la création d\'un mouvement:', error);
    throw error;
  }
};

// Fonction pour mettre à jour un mouvement (dans le mois en cours)
const updateMouvement = (id, updatedMouvement) => {
  try {
    const now = new Date();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentYear = now.getFullYear().toString();
    
    const allData = getAllData();
    const currentEntryIndex = allData.findIndex(entry => 
      entry.mois === currentMonth && entry.annee === currentYear
    );
    
    if (currentEntryIndex === -1) {
      throw new Error('Aucune entrée pour le mois en cours');
    }
    
    let mouvements = allData[currentEntryIndex].mouvements || [];
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
        mouvements[i].solde = (mouvements[i].credit ? parseFloat(mouvements[i].credit) || 0 : 0) - (mouvements[i].debit ? parseFloat(mouvements[i].debit) || 0 : 0);
      } else {
        mouvements[i].solde = mouvements[i-1].solde + (mouvements[i].credit ? parseFloat(mouvements[i].credit) || 0 : 0) - (mouvements[i].debit ? parseFloat(mouvements[i].debit) || 0 : 0);
      }
    }
    
    allData[currentEntryIndex].mouvements = mouvements;
    saveAllData(allData);
    
    return mouvements[index];
  } catch (error) {
    console.error('Erreur lors de la mise à jour d\'un mouvement:', error);
    throw error;
  }
};

// Fonction pour supprimer un mouvement (dans le mois en cours)
const deleteMouvement = (id) => {
  try {
    const now = new Date();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentYear = now.getFullYear().toString();
    
    const allData = getAllData();
    const currentEntryIndex = allData.findIndex(entry => 
      entry.mois === currentMonth && entry.annee === currentYear
    );
    
    if (currentEntryIndex === -1) {
      throw new Error('Aucune entrée pour le mois en cours');
    }
    
    let mouvements = allData[currentEntryIndex].mouvements || [];
    const index = mouvements.findIndex(mouvement => mouvement.id === id);
    
    if (index === -1) {
      throw new Error('Mouvement non trouvé');
    }
    
    mouvements.splice(index, 1);
    
    // Recalculer tous les soldes après la suppression
    for (let i = 0; i < mouvements.length; i++) {
      if (i === 0) {
        mouvements[i].solde = (mouvements[i].credit ? parseFloat(mouvements[i].credit) || 0 : 0) - (mouvements[i].debit ? parseFloat(mouvements[i].debit) || 0 : 0);
      } else {
        mouvements[i].solde = mouvements[i-1].solde + (mouvements[i].credit ? parseFloat(mouvements[i].credit) || 0 : 0) - (mouvements[i].debit ? parseFloat(mouvements[i].debit) || 0 : 0);
      }
    }
    
    allData[currentEntryIndex].mouvements = mouvements;
    saveAllData(allData);
    
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

// Fonction pour réinitialiser les mouvements du mois en cours uniquement
const resetAllMouvements = () => {
  try {
    const now = new Date();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentYear = now.getFullYear().toString();
    
    const allData = getAllData();
    const currentEntryIndex = allData.findIndex(entry => 
      entry.mois === currentMonth && entry.annee === currentYear
    );
    
    if (currentEntryIndex !== -1) {
      allData[currentEntryIndex].mouvements = [];
      saveAllData(allData);
    }
    
    return true;
  } catch (error) {
    console.error('Erreur lors de la réinitialisation des mouvements:', error);
    throw error;
  }
};

// Fonction pour vérifier et créer l'entrée du mois si nécessaire
const checkAndCreateMonthEntry = () => {
  try {
    const now = new Date();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentYear = now.getFullYear().toString();
    
    const allData = getAllData();
    
    // Chercher une entrée pour le mois et année en cours
    const existingEntry = allData.find(entry => 
      entry.mois === currentMonth && entry.annee === currentYear
    );
    
    if (existingEntry) {
      return { 
        created: false, 
        message: 'Entrée existante pour le mois en cours',
        entry: existingEntry
      };
    }
    
    // Créer une nouvelle entrée vide pour le mois en cours
    const newId = allData.length > 0 
      ? (Math.max(...allData.map(e => parseInt(e.id) || 0)) + 1).toString()
      : '1';
    
    const newEntry = {
      id: newId,
      mois: currentMonth,
      annee: currentYear,
      mouvements: []
    };
    
    allData.push(newEntry);
    saveAllData(allData);
    
    return { 
      created: true, 
      message: 'Nouvelle entrée créée pour le mois en cours',
      entry: newEntry
    };
  } catch (error) {
    console.error('Erreur lors de la vérification/création de l\'entrée mensuelle:', error);
    throw error;
  }
};

// ===== RSA =====
const getRsa = () => {
  try {
    if (!fs.existsSync(rsaPath)) {
      const defaultRsa = { montant: 607.75, lastUpdated: null };
      fs.writeFileSync(rsaPath, JSON.stringify(defaultRsa, null, 2));
      return defaultRsa;
    }
    const data = fs.readFileSync(rsaPath, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed.montant === 'undefined') {
      return { montant: 607.75, lastUpdated: null };
    }
    return parsed;
  } catch (error) {
    console.error('Erreur lors de la lecture du RSA:', error);
    return { montant: 607.75, lastUpdated: null };
  }
};

const updateRsa = (montant) => {
  try {
    const rsaData = {
      montant: parseFloat(montant) || 607.75,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(rsaPath, JSON.stringify(rsaData, null, 2));
    return rsaData;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du RSA:', error);
    throw error;
  }
};

// Auto-ajout RSA (le 6) et Charge Fixe (le 10) du mois
const autoAddMonthlyEntries = () => {
  try {
    const now = new Date();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentYear = now.getFullYear().toString();
    const currentDay = now.getDate();

    const allData = getAllData();
    let currentEntryIndex = allData.findIndex(entry =>
      entry.mois === currentMonth && entry.annee === currentYear
    );

    if (currentEntryIndex === -1) {
      const newId = allData.length > 0
        ? (Math.max(...allData.map(e => parseInt(e.id) || 0)) + 1).toString()
        : '1';
      allData.push({ id: newId, mois: currentMonth, annee: currentYear, mouvements: [] });
      currentEntryIndex = allData.length - 1;
    }

    const mouvements = allData[currentEntryIndex].mouvements || [];
    const added = { rsa: false, chargeFixe: false };

    // Check if RSA already added this month (manual or auto)
    const rsaExists = mouvements.some(m => m.categorie === 'RSA');

    // Check if Charge Fixe already added this month (manual or auto)
    const chargeFixeExists = mouvements.some(m => m.categorie === 'chargeFixe');

    // Auto-add RSA on or after the 6th
    if (currentDay >= 6 && !rsaExists) {
      const rsaData = getRsa();
      const lastMouvement = mouvements.length > 0 ? mouvements[mouvements.length - 1] : null;
      const lastSolde = lastMouvement ? lastMouvement.solde : 0;
      const newMouvementId = mouvements.length > 0
        ? (Math.max(...mouvements.map(m => parseInt(m.id) || 0)) + 1).toString()
        : '1';

      mouvements.push({
        id: newMouvementId,
        description: 'RSA - Revenu mensuel',
        categorie: 'RSA',
        date: `${currentYear}-${currentMonth}-06`,
        debit: '',
        credit: rsaData.montant.toString(),
        solde: lastSolde + rsaData.montant,
        autoAdded: true
      });
      added.rsa = true;
    }

    // Auto-add Charge Fixe on or after the 10th
    if (currentDay >= 10 && !chargeFixeExists) {
      const depensesFixeData = getDepensesFixe();
      const lastMouvement = mouvements.length > 0 ? mouvements[mouvements.length - 1] : null;
      const lastSolde = lastMouvement ? lastMouvement.solde : 0;
      const newMouvementId = mouvements.length > 0
        ? (Math.max(...mouvements.map(m => parseInt(m.id) || 0)) + 1).toString()
        : '1';

      mouvements.push({
        id: newMouvementId,
        description: 'Charges fixes mensuelles',
        categorie: 'chargeFixe',
        date: `${currentYear}-${currentMonth}-10`,
        debit: (depensesFixeData.total || 0).toString(),
        credit: '',
        solde: lastSolde - (depensesFixeData.total || 0),
        autoAdded: true
      });
      added.chargeFixe = true;
    }

    if (added.rsa || added.chargeFixe) {
      allData[currentEntryIndex].mouvements = mouvements;
      saveAllData(allData);
    }

    return added;
  } catch (error) {
    console.error('Erreur lors de l\'ajout automatique des entrées mensuelles:', error);
    return { rsa: false, chargeFixe: false };
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
  resetAllMouvements,
  checkAndCreateMonthEntry,
  getOrCreateCurrentMonthEntry,
  getRsa,
  updateRsa,
  autoAddMonthlyEntries
};
