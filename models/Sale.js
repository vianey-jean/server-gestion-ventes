
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
      
      // Check if this is an advance product (case insensitive)
      const isAdvanceProduct = saleData.description.toLowerCase().includes('avance');
      
      // For advance products, ensure quantity is 0 and recalculate profit
      if (isAdvanceProduct) {
        saleData.quantitySold = 0;
        saleData.profit = saleData.sellingPrice - saleData.purchasePrice;
      } else {
        // For regular products, calculate profit based on quantity
        saleData.profit = (saleData.sellingPrice - saleData.purchasePrice) * saleData.quantitySold;
      }
      
      // Create new sale object
      const newSale = {
        id: Date.now().toString(),
        ...saleData
      };
      
      // For regular products, update product quantity
      if (!isAdvanceProduct) {
        // Update product quantity
        const productResult = Product.updateQuantity(saleData.productId, -saleData.quantitySold);
        if (productResult && productResult.error) {
          return { error: productResult.error };
        }
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
      
      // Check if this is an advance product (case insensitive)
      const isAdvanceProduct = saleData.description.toLowerCase().includes('avance');
      
      // For advance products, force quantity to 0 and recalculate profit
      if (isAdvanceProduct) {
        saleData.quantitySold = 0;
        saleData.profit = saleData.sellingPrice - saleData.purchasePrice;
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
      
      return sales[saleIndex];
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
        return false;
      }
      
      const sale = sales[saleIndex];
      
      // Check if this is an advance product (case insensitive)
      const isAdvanceProduct = sale.description.toLowerCase().includes('avance');
      
      // Only return quantity to product inventory if it's not an advance product
      if (!isAdvanceProduct) {
        // Return quantity to product
        Product.updateQuantity(sale.productId, sale.quantitySold);
      }
      
      // Remove from sales array
      sales.splice(saleIndex, 1);
      
      // Write back to file
      fs.writeFileSync(salesPath, JSON.stringify(sales, null, 2));
      
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
