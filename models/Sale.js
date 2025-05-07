
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
      
      // Calculate profit if not provided
      if (!saleData.profit) {
        saleData.profit = (saleData.sellingPrice - saleData.purchasePrice) * saleData.quantitySold;
      }
      
      // Create new sale object
      const newSale = {
        id: Date.now().toString(),
        ...saleData
      };
      
      // Update product quantity
      const productResult = Product.updateQuantity(saleData.productId, -saleData.quantitySold);
      if (productResult && productResult.error) {
        return { error: productResult.error };
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
      
      // Calculate quantity difference
      const quantityDifference = oldSale.quantitySold - saleData.quantitySold;
      
      // Update product quantity
      const productResult = Product.updateQuantity(oldSale.productId, quantityDifference);
      if (productResult && productResult.error) {
        return { error: productResult.error };
      }
      
      // Calculate profit if not provided
      if (!saleData.profit) {
        saleData.profit = (saleData.sellingPrice - saleData.purchasePrice) * saleData.quantitySold;
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
      
      // Return quantity to product
      Product.updateQuantity(sale.productId, sale.quantitySold);
      
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
