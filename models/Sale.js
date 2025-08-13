
const fs = require('fs');
const path = require('path');

const salesPath = path.join(__dirname, '../db/sales.json');
const Product = require('./Product');

const Sale = {
  // Get all sales
  getAll: () => {
    try {
      const sales = JSON.parse(fs.readFileSync(salesPath, 'utf8'));
      return sales;
    } catch (error) {
      console.error("Error reading sales:", error);
      return [];
    }
  },

  // Get sales by month and year
  getByMonthYear: (month, year) => {
    try {
      const sales = JSON.parse(fs.readFileSync(salesPath, 'utf8'));
      
      if (month === undefined || year === undefined) {
        return sales;
      }
      
      // Make sure month is treated as a number
      const monthNum = Number(month);
      const yearNum = Number(year);

      return sales.filter(sale => {
        const saleDate = new Date(sale.date);
        // JavaScript months are 0-based, DB months are 1-based
        // saleDate.getMonth() returns 0-11, but our parameter is 1-12
        // So we add 1 to getMonth() for comparison
        return (saleDate.getMonth() + 1) === monthNum && saleDate.getFullYear() === yearNum;
      });
    } catch (error) {
      console.error("Error filtering sales by month/year:", error);
      return [];
    }
  },

  // Create new sale
  create: (saleData) => {
    try {
      const sales = JSON.parse(fs.readFileSync(salesPath, 'utf8'));
      
      // Détecter le format (multi-produits ou single-produit)
      const isMultiProduct = saleData.products && Array.isArray(saleData.products);
      
      // Create new sale object
      const newSale = {
        id: Date.now().toString(),
        ...saleData
      };
      
      if (isMultiProduct) {
        // Format multi-produits - la gestion des stocks a déjà été faite dans la route
        console.log('💾 Sauvegarde vente multi-produits:', newSale);
      } else {
        // Format single-produit (ancien format)
        const isAdvanceProduct = saleData.description.toLowerCase().includes('avance');
        
        // For advance products, ensure quantity is 0
        if (isAdvanceProduct) {
          newSale.quantitySold = 0;
        }
        
        // For regular products, update product quantity
        if (!isAdvanceProduct) {
          // Update product quantity
          const productResult = Product.updateQuantity(saleData.productId, -saleData.quantitySold);
          if (productResult && productResult.error) {
            return { error: productResult.error };
          }
        }
        
        console.log('💾 Sauvegarde vente single-produit:', newSale);
      }
      
      // Add to sales array
      sales.push(newSale);
      
      // Write back to file
      fs.writeFileSync(salesPath, JSON.stringify(sales, null, 2));
      
      return newSale;
    } catch (error) {
      console.error("Error creating sale:", error);
      return null;
    }
  },

  // Update sale
  update: (id, saleData) => {
    try {
      let sales = JSON.parse(fs.readFileSync(salesPath, 'utf8'));
      
      // Find sale index
      const saleIndex = sales.findIndex(sale => sale.id === id);
      if (saleIndex === -1) {
        return null;
      }
      
      const oldSale = sales[saleIndex];
      
      // Détecter le format (multi-produits ou single-produit)
      const isMultiProduct = saleData.products && Array.isArray(saleData.products);
      const isOldSaleMultiProduct = oldSale.products && Array.isArray(oldSale.products);
      
      if (isMultiProduct || isOldSaleMultiProduct) {
        console.log('💾 Mise à jour vente multi-produits');
        
        // Pour les ventes multi-produits, on remplace complètement les données
        // La gestion des stocks est déjà faite côté frontend
        const updatedSale = { ...oldSale, ...saleData };
        
        // Update sale data
        sales[saleIndex] = updatedSale;
        
        // Write back to file
        fs.writeFileSync(salesPath, JSON.stringify(sales, null, 2));
        
        console.log('✅ Vente multi-produits mise à jour:', updatedSale);
        return updatedSale;
      } else {
        console.log('💾 Mise à jour vente single-produit');
        
        // Check if this is an advance product (case insensitive)
        const isAdvanceProduct = saleData.description.toLowerCase().includes('avance');
        
        // For advance products, force quantity to 0
        if (isAdvanceProduct) {
          saleData.quantitySold = 0;
        }
        
        // Handle product quantity update only for non-advance products
        if (!isAdvanceProduct) {
          // Calculate quantity difference
          const quantityDifference = oldSale.quantitySold - saleData.quantitySold;
          
          // Update product quantity
          const productResult = Product.updateQuantity(oldSale.productId, quantityDifference);
          if (productResult && productResult.error) {
            return { error: productResult.error };
          }
        }
        
        // Update sale data
        sales[saleIndex] = { ...oldSale, ...saleData };
        
        // Write back to file
        fs.writeFileSync(salesPath, JSON.stringify(sales, null, 2));
        
        console.log('✅ Vente single-produit mise à jour:', sales[saleIndex]);
        return sales[saleIndex];
      }
    } catch (error) {
      console.error("Error updating sale:", error);
      return null;
    }
  },

  // Delete sale and return quantity to product
  delete: (id) => {
    try {
      let sales = JSON.parse(fs.readFileSync(salesPath, 'utf8'));
      
      // Find sale index
      const saleIndex = sales.findIndex(sale => sale.id === id);
      if (saleIndex === -1) {
        console.log('❌ Vente non trouvée pour suppression:', id);
        return false;
      }
      
      const sale = sales[saleIndex];
      console.log('🗑️ Suppression de la vente:', sale);
      
      // Détecter le format (multi-produits ou single-produit)
      const isMultiProduct = sale.products && Array.isArray(sale.products);
      
      if (isMultiProduct) {
        console.log('🗑️ Suppression vente multi-produits');
        
        // Pour les ventes multi-produits, restaurer le stock pour chaque produit non-avance
        sale.products.forEach(productData => {
          const isAdvanceProduct = productData.description.toLowerCase().includes('avance');
          if (!isAdvanceProduct && productData.quantitySold > 0) {
            console.log(`🔄 Restauration stock pour ${productData.description}: +${productData.quantitySold}`);
            Product.updateQuantity(productData.productId, productData.quantitySold);
          }
        });
      } else {
        console.log('🗑️ Suppression vente single-produit');
        
        // Check if this is an advance product (case insensitive)
        const isAdvanceProduct = sale.description.toLowerCase().includes('avance');
        
        // Only return quantity to product inventory if it's not an advance product
        if (!isAdvanceProduct) {
          console.log(`🔄 Restauration stock pour ${sale.description}: +${sale.quantitySold}`);
          Product.updateQuantity(sale.productId, sale.quantitySold);
        }
      }
      
      // Remove from sales array
      sales.splice(saleIndex, 1);
      
      // Write back to file
      fs.writeFileSync(salesPath, JSON.stringify(sales, null, 2));
      
      console.log('✅ Vente supprimée avec succès');
      return true;
    } catch (error) {
      console.error("Error deleting sale:", error);
      return false;
    }
  },

  // Clear sales for a specific month and year
  clearByMonthYear: (month, year) => {
    try {
      let sales = JSON.parse(fs.readFileSync(salesPath, 'utf8'));
      
      // Filter out sales for the specified month
      sales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        // JavaScript months are 0-based (0-11), but our parameter is 1-based (1-12)
        return saleDate.getMonth() + 1 !== month || saleDate.getFullYear() !== year;
      });
      
      // Write back to file
      fs.writeFileSync(salesPath, JSON.stringify(sales, null, 2));
      
      return true;
    } catch (error) {
      console.error("Error clearing sales by month/year:", error);
      return false;
    }
  }
};

module.exports = Sale;
