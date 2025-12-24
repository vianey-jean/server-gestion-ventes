const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../db/objectif.json');

const readData = () => {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { objectif: 2000, totalVentesMois: 0, mois: new Date().getMonth() + 1, annee: new Date().getFullYear() };
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
    
    // Reset total if month changed
    if (data.mois !== currentMonth || data.annee !== currentYear) {
      data.totalVentesMois = 0;
      data.mois = currentMonth;
      data.annee = currentYear;
      writeData(data);
    }
    
    return data;
  },
  
  updateObjectif: (newObjectif) => {
    const data = readData();
    data.objectif = Number(newObjectif);
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
  
  recalculateFromSales: (sales) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    // Calculate total from current month sales
    const monthlyTotal = sales
      .filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate.getMonth() + 1 === currentMonth && saleDate.getFullYear() === currentYear;
      })
      .reduce((sum, sale) => {
        if (sale.totalSellingPrice) {
          return sum + Number(sale.totalSellingPrice);
        } else if (sale.sellingPrice) {
          return sum + Number(sale.sellingPrice);
        }
        return sum;
      }, 0);
    
    const data = readData();
    data.totalVentesMois = monthlyTotal;
    data.mois = currentMonth;
    data.annee = currentYear;
    writeData(data);
    
    return data;
  }
};

module.exports = Objectif;
