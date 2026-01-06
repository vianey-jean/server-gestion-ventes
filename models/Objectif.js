const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../db/objectif.json');

const DEFAULT_OBJECTIF = 2000;

const readData = () => {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { 
      objectif: DEFAULT_OBJECTIF, 
      objectifMax: DEFAULT_OBJECTIF,
      totalVentesMois: 0, 
      mois: new Date().getMonth() + 1, 
      annee: new Date().getFullYear(),
      historique: [],
      objectifChanges: [],
      beneficesHistorique: [] // Historique des bénéfices mensuels
    };
  }
};

const writeData = (data) => {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};

const Objectif = {
  get: () => {
    const data = readData();
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    // Reset total if month changed and save previous month to historique
    if (data.mois !== currentMonth || data.annee !== currentYear) {
      // Save previous month data to historique before resetting - PRESERVE custom objectif
      if (data.totalVentesMois > 0 || data.objectif > 0) {
        if (!data.historique) data.historique = [];
        
        const existingIndex = data.historique.findIndex(
          h => h.mois === data.mois && h.annee === data.annee
        );
        
        // Use the actual objectif that was set for that month
        const monthObjectif = data.objectifMax || data.objectif || DEFAULT_OBJECTIF;
        const pourcentage = monthObjectif > 0 
          ? Math.round((data.totalVentesMois / monthObjectif) * 100) 
          : 0;
        
        const monthData = {
          mois: data.mois,
          annee: data.annee,
          totalVentesMois: data.totalVentesMois,
          objectif: monthObjectif,
          pourcentage
        };
        
        if (existingIndex >= 0) {
          data.historique[existingIndex] = monthData;
        } else {
          data.historique.push(monthData);
        }
      }
      
      // Reset to DEFAULT for new month
      data.totalVentesMois = 0;
      data.mois = currentMonth;
      data.annee = currentYear;
      data.objectif = DEFAULT_OBJECTIF;
      data.objectifMax = DEFAULT_OBJECTIF;
      
      // Créer immédiatement une entrée pour le nouveau mois dans l'historique
      if (!data.historique) data.historique = [];
      const newMonthIndex = data.historique.findIndex(
        h => h.mois === currentMonth && h.annee === currentYear
      );
      
      if (newMonthIndex < 0) {
        data.historique.push({
          mois: currentMonth,
          annee: currentYear,
          totalVentesMois: 0,
          objectif: DEFAULT_OBJECTIF,
          pourcentage: 0
        });
      }
      
      writeData(data);
    }
    
    // Toujours retourner l'objectif max
    return {
      ...data,
      objectif: data.objectifMax || data.objectif || DEFAULT_OBJECTIF
    };
  },
  
  updateObjectif: (newObjectif, targetMonth = null, targetYear = null) => {
    const data = readData();
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    // Determine which month to update
    const monthToUpdate = targetMonth || currentMonth;
    const yearToUpdate = targetYear || currentYear;
    
    // ONLY allow updating current month - past months are locked
    if (yearToUpdate < currentYear || (yearToUpdate === currentYear && monthToUpdate < currentMonth)) {
      throw new Error('Cannot modify objectif for past months');
    }
    
    const newValue = Number(newObjectif);
    const currentMax = data.objectifMax || data.objectif || DEFAULT_OBJECTIF;
    
    // RÈGLE: Interdire la diminution - seul un objectif supérieur est autorisé
    if (newValue <= currentMax) {
      throw new Error('OBJECTIF_MUST_INCREASE');
    }
    
    // Enregistrer le changement dans l'historique des changements
    if (!data.objectifChanges) data.objectifChanges = [];
    data.objectifChanges.push({
      date: now.toISOString(),
      ancienObjectif: currentMax,
      nouveauObjectif: newValue,
      mois: monthToUpdate,
      annee: yearToUpdate
    });
    
    // Update main objectif only if it's the current month
    if (monthToUpdate === currentMonth && yearToUpdate === currentYear) {
      data.objectif = newValue;
      data.objectifMax = newValue; // Mettre à jour le max
    }
    
    // Also update in historique
    if (!data.historique) data.historique = [];
    
    const existingIndex = data.historique.findIndex(
      h => h.mois === monthToUpdate && h.annee === yearToUpdate
    );
    
    if (existingIndex >= 0) {
      data.historique[existingIndex].objectif = newValue;
      data.historique[existingIndex].pourcentage = newValue > 0 
        ? Math.round((data.historique[existingIndex].totalVentesMois / newValue) * 100)
        : 0;
    } else {
      // Create new entry for current month if it doesn't exist
      const pourcentage = newValue > 0 
        ? Math.round((data.totalVentesMois / newValue) * 100)
        : 0;
      data.historique.push({
        mois: monthToUpdate,
        annee: yearToUpdate,
        totalVentesMois: data.totalVentesMois || 0,
        objectif: newValue,
        pourcentage
      });
    }
    
    writeData(data);
    
    // Retourner avec l'objectif max
    return {
      ...data,
      objectif: data.objectifMax || data.objectif
    };
  },
  
  updateTotalVentes: (newTotal) => {
    const data = readData();
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    // Reset if month changed
    if (data.mois !== currentMonth || data.annee !== currentYear) {
      data.totalVentesMois = 0;
      data.mois = currentMonth;
      data.annee = currentYear;
    }
    
    data.totalVentesMois = Number(newTotal);
    writeData(data);
    return data;
  },
  
  // Recalculate all months from sales data - PRESERVES custom objectif values
  recalculateFromSales: (sales) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    // Calculate totals for ALL months from sales
    const monthlyTotals = {};
    
    sales.forEach(sale => {
      const saleDate = new Date(sale.date);
      const month = saleDate.getMonth() + 1;
      const year = saleDate.getFullYear();
      
      // Only process current year sales
      if (year === currentYear) {
        const key = `${year}-${month}`;
        if (!monthlyTotals[key]) {
          monthlyTotals[key] = { month, year, total: 0 };
        }
        
        if (sale.totalSellingPrice) {
          monthlyTotals[key].total += Number(sale.totalSellingPrice);
        } else if (sale.sellingPrice) {
          monthlyTotals[key].total += Number(sale.sellingPrice);
        }
      }
    });
    
    const data = readData();
    if (!data.historique) data.historique = [];
    
    // DÉTECTION DU CHANGEMENT DE MOIS - Réinitialiser si nouveau mois
    const isNewMonth = data.mois !== currentMonth || data.annee !== currentYear;
    
    // Update historique for all months with data - PRESERVE existing objectif values
    Object.values(monthlyTotals).forEach(({ month, year, total }) => {
      const existingIndex = data.historique.findIndex(
        h => h.mois === month && h.annee === year
      );
      
      // Get existing objectif or use default
      const existingObjectif = existingIndex >= 0 
        ? data.historique[existingIndex].objectif 
        : DEFAULT_OBJECTIF;
      
      const objectifToUse = existingObjectif || DEFAULT_OBJECTIF;
      const pourcentage = objectifToUse > 0 
        ? Math.round((total / objectifToUse) * 100) 
        : 0;
      
      const monthData = {
        mois: month,
        annee: year,
        totalVentesMois: total,
        objectif: objectifToUse,
        pourcentage
      };
      
      if (existingIndex >= 0) {
        data.historique[existingIndex] = monthData;
      } else {
        data.historique.push(monthData);
      }
    });
    
    // Update current month data
    const currentMonthKey = `${currentYear}-${currentMonth}`;
    const currentMonthTotal = monthlyTotals[currentMonthKey]?.total || 0;
    
    data.totalVentesMois = currentMonthTotal;
    data.mois = currentMonth;
    data.annee = currentYear;
    
    // SI NOUVEAU MOIS: Réinitialiser objectif à 2000
    if (isNewMonth) {
      data.objectif = DEFAULT_OBJECTIF;
      data.objectifMax = DEFAULT_OBJECTIF;
      
      // Créer entrée pour le nouveau mois si elle n'existe pas
      const newMonthIndex = data.historique.findIndex(
        h => h.mois === currentMonth && h.annee === currentYear
      );
      
      if (newMonthIndex < 0) {
        data.historique.push({
          mois: currentMonth,
          annee: currentYear,
          totalVentesMois: currentMonthTotal,
          objectif: DEFAULT_OBJECTIF,
          pourcentage: 0
        });
      } else {
        // Mettre à jour l'entrée existante avec l'objectif par défaut
        data.historique[newMonthIndex].objectif = DEFAULT_OBJECTIF;
      }
    } else {
      // Mois actuel: préserver l'objectif existant
      if (!data.objectif || data.objectif === 0) {
        data.objectif = DEFAULT_OBJECTIF;
      }
      if (!data.objectifMax || data.objectifMax === 0) {
        data.objectifMax = data.objectif || DEFAULT_OBJECTIF;
      }
    }
    
    // Sort historique by month
    data.historique.sort((a, b) => {
      if (a.annee !== b.annee) return a.annee - b.annee;
      return a.mois - b.mois;
    });
    
    writeData(data);
    
    // Retourner avec l'objectif max
    return {
      ...data,
      objectif: data.objectifMax || data.objectif
    };
  },

  getHistorique: () => {
    const data = readData();
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Filter historique for current year only
    const yearHistorique = (data.historique || [])
      .filter(h => h.annee === currentYear)
      .sort((a, b) => a.mois - b.mois);
    
    // Filter objectifChanges for current year only
    const yearObjectifChanges = (data.objectifChanges || [])
      .filter(c => c.annee === currentYear)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Filter beneficesHistorique for current year only
    const yearBeneficesHistorique = (data.beneficesHistorique || [])
      .filter(b => b.annee === currentYear)
      .sort((a, b) => a.mois - b.mois);
    
    return {
      currentData: {
        objectif: data.objectifMax || data.objectif || DEFAULT_OBJECTIF,
        totalVentesMois: data.totalVentesMois,
        mois: data.mois,
        annee: data.annee
      },
      historique: yearHistorique,
      objectifChanges: yearObjectifChanges,
      beneficesHistorique: yearBeneficesHistorique,
      annee: currentYear
    };
  },

  saveMonthlyData: (sales) => {
    const data = Objectif.recalculateFromSales(sales);
    return Objectif.getHistorique();
  },

  // Mettre à jour les bénéfices mensuels
  updateBeneficesMensuels: (beneficesData) => {
    const data = readData();
    if (!data.beneficesHistorique) data.beneficesHistorique = [];
    
    const { mois, annee, totalBenefice } = beneficesData;
    
    const existingIndex = data.beneficesHistorique.findIndex(
      b => b.mois === mois && b.annee === annee
    );
    
    const beneficeEntry = {
      mois,
      annee,
      totalBenefice: Number(totalBenefice),
      updatedAt: new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
      data.beneficesHistorique[existingIndex] = beneficeEntry;
    } else {
      data.beneficesHistorique.push(beneficeEntry);
    }
    
    // Sort by month
    data.beneficesHistorique.sort((a, b) => {
      if (a.annee !== b.annee) return a.annee - b.annee;
      return a.mois - b.mois;
    });
    
    writeData(data);
    return data.beneficesHistorique;
  },

  // Calculer les bénéfices à partir des ventes
  calculateBeneficesFromSales: (sales) => {
    const data = readData();
    const now = new Date();
    const currentYear = now.getFullYear();
    
    if (!data.beneficesHistorique) data.beneficesHistorique = [];
    
    // Calculate monthly benefices
    const monthlyBenefices = {};
    
    sales.forEach(sale => {
      const saleDate = new Date(sale.date);
      const month = saleDate.getMonth() + 1;
      const year = saleDate.getFullYear();
      
      if (year === currentYear) {
        const key = `${year}-${month}`;
        if (!monthlyBenefices[key]) {
          monthlyBenefices[key] = { month, year, total: 0 };
        }
        
        // Calculate profit from sale
        const sellingPrice = sale.totalSellingPrice || sale.sellingPrice || 0;
        const purchasePrice = sale.totalPurchasePrice || sale.purchasePrice || 0;
        const profit = Number(sellingPrice) - Number(purchasePrice);
        
        monthlyBenefices[key].total += profit;
      }
    });
    
    // Update beneficesHistorique
    Object.values(monthlyBenefices).forEach(({ month, year, total }) => {
      const existingIndex = data.beneficesHistorique.findIndex(
        b => b.mois === month && b.annee === year
      );
      
      const beneficeEntry = {
        mois: month,
        annee: year,
        totalBenefice: total,
        updatedAt: new Date().toISOString()
      };
      
      if (existingIndex >= 0) {
        data.beneficesHistorique[existingIndex] = beneficeEntry;
      } else {
        data.beneficesHistorique.push(beneficeEntry);
      }
    });
    
    // Sort by month
    data.beneficesHistorique.sort((a, b) => {
      if (a.annee !== b.annee) return a.annee - b.annee;
      return a.mois - b.mois;
    });
    
    writeData(data);
    return data.beneficesHistorique;
  }
};

module.exports = Objectif;
