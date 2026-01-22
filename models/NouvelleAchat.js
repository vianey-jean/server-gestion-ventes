const fs = require('fs');
const path = require('path');
const Product = require('./Product');

const nouvelleAchatPath = path.join(__dirname, '../db/nouvelle_achat.json');

// Initialiser le fichier s'il n'existe pas
if (!fs.existsSync(nouvelleAchatPath)) {
  fs.writeFileSync(nouvelleAchatPath, JSON.stringify([], null, 2));
}

const NouvelleAchat = {
  // Récupérer tous les achats
  getAll: () => {
    try {
      const data = fs.readFileSync(nouvelleAchatPath, 'utf8');
      const achats = JSON.parse(data);
      console.log(`📦 Retrieved ${achats.length} achats from database`);
      return achats;
    } catch (error) {
      console.error("❌ Error reading achats:", error);
      return [];
    }
  },

  // Récupérer un achat par ID
  getById: (id) => {
    try {
      const data = fs.readFileSync(nouvelleAchatPath, 'utf8');
      const achats = JSON.parse(data);
      return achats.find(achat => achat.id === id) || null;
    } catch (error) {
      console.error("❌ Error finding achat by id:", error);
      return null;
    }
  },

  // Récupérer les achats par mois et année
  getByMonthYear: (month, year) => {
    try {
      const data = fs.readFileSync(nouvelleAchatPath, 'utf8');
      const achats = JSON.parse(data);
      
      return achats.filter(achat => {
        const date = new Date(achat.date);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      });
    } catch (error) {
      console.error("❌ Error filtering achats by month/year:", error);
      return [];
    }
  },

  // Récupérer les achats par année
  getByYear: (year) => {
    try {
      const data = fs.readFileSync(nouvelleAchatPath, 'utf8');
      const achats = JSON.parse(data);
      
      return achats.filter(achat => {
        const date = new Date(achat.date);
        return date.getFullYear() === year;
      });
    } catch (error) {
      console.error("❌ Error filtering achats by year:", error);
      return [];
    }
  },

  // Créer un nouvel achat et mettre à jour le produit
  create: (achatData) => {
    try {
      console.log('📝 Creating new achat:', achatData);
      
      const data = fs.readFileSync(nouvelleAchatPath, 'utf8');
      const achats = JSON.parse(data);
      
      // Créer l'objet achat
      const newAchat = {
        id: Date.now().toString(),
        date: achatData.date || new Date().toISOString(),
        productId: achatData.productId,
        productDescription: achatData.productDescription,
        purchasePrice: Number(achatData.purchasePrice),
        quantity: Number(achatData.quantity),
        fournisseur: achatData.fournisseur || '',
        caracteristiques: achatData.caracteristiques || '',
        totalCost: Number(achatData.purchasePrice) * Number(achatData.quantity),
        type: 'achat_produit'
      };
      
      achats.push(newAchat);
      fs.writeFileSync(nouvelleAchatPath, JSON.stringify(achats, null, 2));
      
      // Mettre à jour le produit dans products.json
      if (achatData.productId) {
        const existingProduct = Product.getById(achatData.productId);
        
        if (existingProduct) {
          // Mettre à jour la quantité et le prix si nécessaire
          const updatedProductData = {
            description: achatData.productDescription || existingProduct.description,
            purchasePrice: Number(achatData.purchasePrice),
            quantity: existingProduct.quantity + Number(achatData.quantity)
          };
          
          Product.update(achatData.productId, updatedProductData);
          console.log('✅ Product updated with new stock:', updatedProductData);
        }
      }
      
      console.log('✅ Achat created successfully:', newAchat);
      return newAchat;
    } catch (error) {
      console.error("❌ Error creating achat:", error);
      return null;
    }
  },

  // Mettre à jour un achat
  update: (id, achatData) => {
    try {
      console.log(`📝 Updating achat ${id}:`, achatData);
      
      const data = fs.readFileSync(nouvelleAchatPath, 'utf8');
      let achats = JSON.parse(data);
      
      const achatIndex = achats.findIndex(achat => achat.id === id);
      if (achatIndex === -1) {
        console.log(`❌ Achat not found for update: ${id}`);
        return null;
      }
      
      // Calculer le nouveau totalCost
      const updatedData = {
        ...achats[achatIndex],
        ...achatData,
        totalCost: Number(achatData.purchasePrice || achats[achatIndex].purchasePrice) * 
                   Number(achatData.quantity || achats[achatIndex].quantity)
      };
      
      achats[achatIndex] = updatedData;
      fs.writeFileSync(nouvelleAchatPath, JSON.stringify(achats, null, 2));
      
      console.log('✅ Achat updated successfully:', updatedData);
      return updatedData;
    } catch (error) {
      console.error("❌ Error updating achat:", error);
      return null;
    }
  },

  // Supprimer un achat
  delete: (id) => {
    try {
      console.log(`🗑️ Deleting achat ${id}`);
      
      const data = fs.readFileSync(nouvelleAchatPath, 'utf8');
      let achats = JSON.parse(data);
      
      const achatIndex = achats.findIndex(achat => achat.id === id);
      if (achatIndex === -1) {
        console.log(`❌ Achat not found for deletion: ${id}`);
        return false;
      }
      
      achats.splice(achatIndex, 1);
      fs.writeFileSync(nouvelleAchatPath, JSON.stringify(achats, null, 2));
      
      console.log('✅ Achat deleted successfully');
      return true;
    } catch (error) {
      console.error("❌ Error deleting achat:", error);
      return false;
    }
  },

  // Ajouter une dépense (taxes, carburant, autres)
  addDepense: (depenseData) => {
    try {
      console.log('📝 Adding depense:', depenseData);
      
      const data = fs.readFileSync(nouvelleAchatPath, 'utf8');
      const achats = JSON.parse(data);
      
      const newDepense = {
        id: Date.now().toString(),
        date: depenseData.date || new Date().toISOString(),
        description: depenseData.description,
        totalCost: Number(depenseData.montant),
        type: depenseData.type || 'autre_depense', // taxes, carburant, autre_depense
        categorie: depenseData.categorie || 'divers'
      };
      
      achats.push(newDepense);
      fs.writeFileSync(nouvelleAchatPath, JSON.stringify(achats, null, 2));
      
      console.log('✅ Depense added successfully:', newDepense);
      return newDepense;
    } catch (error) {
      console.error("❌ Error adding depense:", error);
      return null;
    }
  },

  // Calculer les statistiques mensuelles
  getMonthlyStats: (month, year) => {
    try {
      const achats = NouvelleAchat.getByMonthYear(month, year);
      
      const stats = {
        totalAchats: 0,
        totalDepenses: 0,
        achatsCount: 0,
        depensesCount: 0,
        byType: {}
      };
      
      achats.forEach(item => {
        if (item.type === 'achat_produit') {
          stats.totalAchats += item.totalCost;
          stats.achatsCount++;
        } else {
          stats.totalDepenses += item.totalCost;
          stats.depensesCount++;
        }
        
        // Regrouper par type
        if (!stats.byType[item.type]) {
          stats.byType[item.type] = { total: 0, count: 0 };
        }
        stats.byType[item.type].total += item.totalCost;
        stats.byType[item.type].count++;
      });
      
      stats.totalGeneral = stats.totalAchats + stats.totalDepenses;
      
      return stats;
    } catch (error) {
      console.error("❌ Error calculating monthly stats:", error);
      return null;
    }
  },

  // Calculer les statistiques annuelles
  getYearlyStats: (year) => {
    try {
      const achats = NouvelleAchat.getByYear(year);
      
      const stats = {
        totalAchats: 0,
        totalDepenses: 0,
        achatsCount: 0,
        depensesCount: 0,
        byMonth: {},
        byType: {}
      };
      
      achats.forEach(item => {
        const date = new Date(item.date);
        const month = date.getMonth() + 1;
        
        // Statistiques par mois
        if (!stats.byMonth[month]) {
          stats.byMonth[month] = { achats: 0, depenses: 0 };
        }
        
        if (item.type === 'achat_produit') {
          stats.totalAchats += item.totalCost;
          stats.achatsCount++;
          stats.byMonth[month].achats += item.totalCost;
        } else {
          stats.totalDepenses += item.totalCost;
          stats.depensesCount++;
          stats.byMonth[month].depenses += item.totalCost;
        }
        
        // Regrouper par type
        if (!stats.byType[item.type]) {
          stats.byType[item.type] = { total: 0, count: 0 };
        }
        stats.byType[item.type].total += item.totalCost;
        stats.byType[item.type].count++;
      });
      
      stats.totalGeneral = stats.totalAchats + stats.totalDepenses;
      
      return stats;
    } catch (error) {
      console.error("❌ Error calculating yearly stats:", error);
      return null;
    }
  }
};

module.exports = NouvelleAchat;