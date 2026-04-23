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

  /**
   * Créer un nouvel achat et gérer le produit associé
   * 
   * LOGIQUE DE FONCTIONNEMENT :
   * 1. Si productId est fourni et le produit existe → mise à jour du stock
   * 2. Si productId est fourni mais le produit n'existe pas → création du produit
   * 3. Si productId n'est pas fourni → création d'un nouveau produit
   * 4. Dans tous les cas → enregistrement de l'achat dans nouvelle_achat.json
   * 
   * @param {Object} achatData - Données de l'achat
   * @param {string} achatData.productId - ID du produit (optionnel)
   * @param {string} achatData.productDescription - Description du produit (obligatoire)
   * @param {number} achatData.purchasePrice - Prix d'achat unitaire (obligatoire)
   * @param {number} achatData.quantity - Quantité achetée (obligatoire)
   * @param {string} achatData.fournisseur - Nom du fournisseur (optionnel)
   * @param {string} achatData.caracteristiques - Caractéristiques du produit (optionnel)
   * @param {string} achatData.date - Date de l'achat (optionnel, défaut: maintenant)
   * @returns {Object|null} L'achat créé ou null en cas d'erreur
   */
  /**
   * Créer un nouvel achat et gérer le produit associé
   * 
   * LOGIQUE CENTRALISÉE (corrige le bug de double quantité) :
   * Le backend gère TOUTE la logique de création/mise à jour du produit.
   * Le frontend n'envoie que les données de l'achat.
   * 
   * CAS :
   * 1. productId fourni et produit existe → mise à jour du stock (quantité EXACTE du formulaire)
   * 2. productId fourni mais produit n'existe pas → création du produit
   * 3. Pas de productId → recherche par description, sinon création
   */
  create: (achatData) => {
    try {
      console.log('📝 Creating new achat:', achatData);
      
      // Lire les achats existants
      const data = fs.readFileSync(nouvelleAchatPath, 'utf8');
      const achats = JSON.parse(data);
      
      // Variable pour stocker l'ID du produit final
      let finalProductId = achatData.productId;
      const quantityToAdd = Number(achatData.quantity);
      
      // ========================================
      // GESTION DU PRODUIT
      // ========================================
      if (achatData.productId) {
        // CAS 1: Un productId est fourni
        const existingProduct = Product.getById(achatData.productId);
        
        if (existingProduct) {
          // CAS 1A: Le produit existe → mise à jour du stock
          console.log('📦 Updating existing product stock...');
          console.log(`   Current quantity: ${existingProduct.quantity}, Adding: ${quantityToAdd}`);
          
          const updatedProductData = {
            description: achatData.productDescription || existingProduct.description,
            purchasePrice: Number(achatData.purchasePrice) || existingProduct.purchasePrice,
            quantity: existingProduct.quantity + quantityToAdd,
            fournisseur: achatData.fournisseur || existingProduct.fournisseur || ''
          };
          
          Product.update(achatData.productId, updatedProductData);
          console.log(`✅ Product updated - New quantity: ${updatedProductData.quantity}`);
        } else {
          // CAS 1B: Le productId est fourni mais le produit n'existe pas → création
          console.log('🆕 Product ID provided but product not found, creating new product...');
          const newProduct = Product.create({
            description: achatData.productDescription,
            purchasePrice: Number(achatData.purchasePrice),
            quantity: quantityToAdd,
            sellingPrice: 0,
            fournisseur: achatData.fournisseur || ''
          });
          
          if (newProduct) {
            finalProductId = newProduct.id;
            console.log(`✅ New product created with quantity: ${quantityToAdd}`);
          }
        }
      } else {
        // CAS 2: Pas de productId fourni → vérifier si le produit existe par description
        console.log('🔍 No productId provided, checking if product exists by description...');
        
        const allProducts = Product.getAll();
        const existingProductByDescription = allProducts.find(
          p => p.description.toLowerCase().trim() === achatData.productDescription.toLowerCase().trim()
        );
        
        if (existingProductByDescription) {
          // CAS 2A: Un produit avec la même description existe → mise à jour
          console.log('📦 Found existing product by description, updating stock...');
          console.log(`   Current quantity: ${existingProductByDescription.quantity}, Adding: ${quantityToAdd}`);
          
          finalProductId = existingProductByDescription.id;
          
          const updatedProductData = {
            purchasePrice: Number(achatData.purchasePrice) || existingProductByDescription.purchasePrice,
            quantity: existingProductByDescription.quantity + quantityToAdd,
            fournisseur: achatData.fournisseur || existingProductByDescription.fournisseur || ''
          };
          
          Product.update(existingProductByDescription.id, updatedProductData);
          console.log(`✅ Existing product updated - New quantity: ${updatedProductData.quantity}`);
        } else {
          // CAS 2B: Aucun produit correspondant → création d'un nouveau produit
          console.log('🆕 No matching product found, creating new product...');
          const newProduct = Product.create({
            description: achatData.productDescription,
            purchasePrice: Number(achatData.purchasePrice),
            quantity: quantityToAdd,
            sellingPrice: 0,
            fournisseur: achatData.fournisseur || ''
          });
          
          if (newProduct) {
            finalProductId = newProduct.id;
            console.log(`✅ New product created with quantity: ${quantityToAdd}`);
          } else {
            console.error('❌ Failed to create new product');
          }
        }
      }
      
      // ========================================
      // CRÉATION DE L'ENREGISTREMENT D'ACHAT
      // ========================================
      const newAchat = {
        id: Date.now().toString(),
        date: achatData.date || new Date().toISOString(),
        productId: finalProductId,
        productDescription: achatData.productDescription,
        purchasePrice: Number(achatData.purchasePrice),
        quantity: quantityToAdd,
        fournisseur: achatData.fournisseur || '',
        caracteristiques: achatData.caracteristiques || '',
        totalCost: Number(achatData.purchasePrice) * quantityToAdd,
        type: 'achat_produit'
      };
      
      achats.push(newAchat);
      fs.writeFileSync(nouvelleAchatPath, JSON.stringify(achats, null, 2));
      
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
      
      const existing = achats[achatIndex];
      const nextType = achatData.type ?? existing.type;
      const isAchatProduit = nextType === 'achat_produit';

      // Calculer le nouveau totalCost
      // - Achat produit: totalCost = purchasePrice * quantity
      // - Dépense: totalCost = montant saisi (pas de quantity)
      const totalCost = isAchatProduit
        ? (Number(achatData.purchasePrice ?? existing.purchasePrice ?? 0) *
           Number(achatData.quantity ?? existing.quantity ?? 0))
        : Number(achatData.totalCost ?? achatData.montant ?? achatData.purchasePrice ?? existing.totalCost ?? 0);

      const updatedData = {
        ...existing,
        ...achatData,
        totalCost
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

      // Supprimer le fichier reçu associé si présent
      const target = achats[achatIndex];
      if (target && target.receiptUrl) {
        try {
          const rel = target.receiptUrl.replace(/^\/+/, ''); // 'uploads/depense/recu-xxx.pdf'
          const filePath = path.join(__dirname, '..', rel);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted receipt file: ${filePath}`);
          }
        } catch (e) {
          console.warn('⚠️ Could not delete receipt file:', e.message);
        }
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
        categorie: depenseData.categorie || 'divers',
        // URL du reçu (image ou PDF) — facultatif
        receiptUrl: depenseData.receiptUrl || null
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