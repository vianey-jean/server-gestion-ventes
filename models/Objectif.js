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
      totalVentesMois: 0, 
      mois: new Date().getMonth() + 1, 
      annee: new Date().getFullYear(),
      historique: []
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
        const monthObjectif = data.objectif || DEFAULT_OBJECTIF;
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
      
      data.totalVentesMois = 0;
      data.mois = currentMonth;
      data.annee = currentYear;
      // Reset objectif to DEFAULT for new month only
      data.objectif = DEFAULT_OBJECTIF;
      writeData(data);
    }
    
    return data;
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
    
    // Update main objectif only if it's the current month
    if (monthToUpdate === currentMonth && yearToUpdate === currentYear) {
      data.objectif = Number(newObjectif);
    }
    
    // Also update in historique
    if (!data.historique) data.historique = [];
    
    const existingIndex = data.historique.findIndex(
      h => h.mois === monthToUpdate && h.annee === yearToUpdate
    );
    
    if (existingIndex >= 0) {
      data.historique[existingIndex].objectif = Number(newObjectif);
      data.historique[existingIndex].pourcentage = Number(newObjectif) > 0 
        ? Math.round((data.historique[existingIndex].totalVentesMois / Number(newObjectif)) * 100)
        : 0;
    } else {
      // Create new entry for current month if it doesn't exist
      const pourcentage = Number(newObjectif) > 0 
        ? Math.round((data.totalVentesMois / Number(newObjectif)) * 100)
        : 0;
      data.historique.push({
        mois: monthToUpdate,
        annee: yearToUpdate,
        totalVentesMois: data.totalVentesMois || 0,
        objectif: Number(newObjectif),
        pourcentage
      });
    }
    
    writeData(data);
    return data;
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
    
    // Update current month data - PRESERVE current objectif if set
    const currentMonthKey = `${currentYear}-${currentMonth}`;
    const currentMonthTotal = monthlyTotals[currentMonthKey]?.total || 0;
    
    data.totalVentesMois = currentMonthTotal;
    data.mois = currentMonth;
    data.annee = currentYear;
    // PRESERVE existing objectif - don't reset to DEFAULT
    if (!data.objectif || data.objectif === 0) {
      data.objectif = DEFAULT_OBJECTIF;
    }
    
    // Sort historique by month
    data.historique.sort((a, b) => {
      if (a.annee !== b.annee) return a.annee - b.annee;
      return a.mois - b.mois;
    });
    
    writeData(data);
    
    return data;
  },

  getHistorique: () => {
    const data = readData();
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Filter historique for current year only
    const yearHistorique = (data.historique || [])
      .filter(h => h.annee === currentYear)
      .sort((a, b) => a.mois - b.mois);
    
    return {
      currentData: {
        objectif: data.objectif || DEFAULT_OBJECTIF,
        totalVentesMois: data.totalVentesMois,
        mois: data.mois,
        annee: data.annee
      },
      historique: yearHistorique,
      annee: currentYear
    };
  },

  saveMonthlyData: (sales) => {
    const data = Objectif.recalculateFromSales(sales);
    return Objectif.getHistorique();
  }
};

module.exports = Objectif;
