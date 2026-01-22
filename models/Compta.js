const fs = require('fs');
const path = require('path');
const Sale = require('./Sale');
const NouvelleAchat = require('./NouvelleAchat');

const comptaPath = path.join(__dirname, '../db/compta.json');

// Initialiser le fichier s'il n'existe pas
if (!fs.existsSync(comptaPath)) {
  fs.writeFileSync(comptaPath, JSON.stringify([], null, 2));
}

const Compta = {
  // Récupérer toutes les données de comptabilité
  getAll: () => {
    try {
      const data = fs.readFileSync(comptaPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error("❌ Error reading compta:", error);
      return [];
    }
  },

  // Récupérer les données par mois et année
  getByMonthYear: (month, year) => {
    try {
      const data = fs.readFileSync(comptaPath, 'utf8');
      const comptaData = JSON.parse(data);
      return comptaData.find(c => c.month === month && c.year === year) || null;
    } catch (error) {
      console.error("❌ Error finding compta by month/year:", error);
      return null;
    }
  },

  // Récupérer les données par année
  getByYear: (year) => {
    try {
      const data = fs.readFileSync(comptaPath, 'utf8');
      const comptaData = JSON.parse(data);
      return comptaData.filter(c => c.year === year);
    } catch (error) {
      console.error("❌ Error filtering compta by year:", error);
      return [];
    }
  },

  // Calculer et sauvegarder les données de comptabilité pour un mois
  calculateAndSave: (month, year) => {
    try {
      console.log(`📊 Calculating compta for ${month}/${year}...`);
      
      // Récupérer les ventes du mois
      const allSales = Sale.getAll();
      const monthlySales = allSales.filter(sale => {
        const date = new Date(sale.date);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      });

      // Calculer les totaux des ventes
      let salesTotal = 0;
      let salesCost = 0;
      let salesProfit = 0;

      monthlySales.forEach(sale => {
        if (sale.products && Array.isArray(sale.products)) {
          salesTotal += sale.totalSellingPrice || 0;
          salesCost += sale.totalPurchasePrice || 0;
          salesProfit += sale.totalProfit || 0;
        } else {
          salesTotal += (sale.sellingPrice || 0) * (sale.quantitySold || 0);
          salesCost += (sale.purchasePrice || 0) * (sale.quantitySold || 0);
          salesProfit += sale.profit || 0;
        }
      });

      // Récupérer les achats et dépenses du mois
      const monthlyAchats = NouvelleAchat.getByMonthYear(month, year);
      
      const achatsProducts = monthlyAchats.filter(a => a.type === 'achat_produit');
      const depenses = monthlyAchats.filter(a => a.type !== 'achat_produit');

      const achatsTotal = achatsProducts.reduce((sum, a) => sum + (a.totalCost || 0), 0);
      const depensesTotal = depenses.reduce((sum, a) => sum + (a.totalCost || 0), 0);

      // Calcul du bénéfice réel
      const beneficeReel = salesProfit - (achatsTotal + depensesTotal);

      // Solde
      const totalCredit = salesTotal;
      const totalDebit = achatsTotal + depensesTotal;
      const soldeNet = totalCredit - totalDebit;

      // Créer l'objet de comptabilité
      const comptaEntry = {
        id: `${year}-${month.toString().padStart(2, '0')}`,
        month,
        year,
        updatedAt: new Date().toISOString(),
        salesTotal,
        salesCost,
        salesProfit,
        salesCount: monthlySales.length,
        achatsTotal,
        depensesTotal,
        beneficeReel,
        totalCredit,
        totalDebit,
        soldeNet,
        achatsCount: achatsProducts.length,
        depensesCount: depenses.length
      };

      // Sauvegarder
      const data = fs.readFileSync(comptaPath, 'utf8');
      let comptaData = JSON.parse(data);
      
      // Mettre à jour ou ajouter
      const existingIndex = comptaData.findIndex(c => c.month === month && c.year === year);
      if (existingIndex >= 0) {
        comptaData[existingIndex] = comptaEntry;
      } else {
        comptaData.push(comptaEntry);
      }

      // Trier par date
      comptaData.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

      fs.writeFileSync(comptaPath, JSON.stringify(comptaData, null, 2));
      
      console.log(`✅ Compta saved for ${month}/${year}:`, comptaEntry);
      return comptaEntry;
    } catch (error) {
      console.error("❌ Error calculating compta:", error);
      return null;
    }
  },

  // Recalculer toute l'année
  recalculateYear: (year) => {
    try {
      console.log(`📊 Recalculating compta for year ${year}...`);
      
      const results = [];
      for (let month = 1; month <= 12; month++) {
        const result = Compta.calculateAndSave(month, year);
        if (result) {
          results.push(result);
        }
      }
      
      console.log(`✅ Recalculated ${results.length} months for year ${year}`);
      return results;
    } catch (error) {
      console.error("❌ Error recalculating year:", error);
      return [];
    }
  },

  // Obtenir le résumé annuel
  getYearlySummary: (year) => {
    try {
      const yearData = Compta.getByYear(year);
      
      if (yearData.length === 0) {
        return null;
      }

      const summary = {
        year,
        totalSales: yearData.reduce((sum, m) => sum + m.salesTotal, 0),
        totalProfit: yearData.reduce((sum, m) => sum + m.salesProfit, 0),
        totalAchats: yearData.reduce((sum, m) => sum + m.achatsTotal, 0),
        totalDepenses: yearData.reduce((sum, m) => sum + m.depensesTotal, 0),
        beneficeReel: yearData.reduce((sum, m) => sum + m.beneficeReel, 0),
        salesCount: yearData.reduce((sum, m) => sum + m.salesCount, 0),
        monthlyData: yearData.map(m => ({
          month: m.month,
          salesProfit: m.salesProfit,
          achats: m.achatsTotal,
          depenses: m.depensesTotal,
          beneficeReel: m.beneficeReel
        }))
      };

      return summary;
    } catch (error) {
      console.error("❌ Error getting yearly summary:", error);
      return null;
    }
  }
};

module.exports = Compta;
