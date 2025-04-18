
const fs = require('fs');
const path = require('path');

const productsPath = path.join(__dirname, '../db/products.json');

const Product = {
  // Get all products
  getAll: () => {
    try {
      const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
      return products;
    } catch (error) {
      console.error("Error reading products:", error);
      return [];
    }
  },

  // Get product by ID
  getById: (id) => {
    try {
      const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
      return products.find(product => product.id === id) || null;
    } catch (error) {
      console.error("Error finding product by id:", error);
      return null;
    }
  },

  // Search products by description
  search: (query) => {
    try {
      const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
      if (!query || query.length < 3) return [];
      
      return products.filter(product => 
        product.description.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error("Error searching products:", error);
      return [];
    }
  },

  // Create new product
  create: (productData) => {
    try {
      const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
      
      // Create new product object
      const newProduct = {
        id: Date.now().toString(),
        ...productData
      };
      
      // Add to products array
      products.push(newProduct);
      
      // Write back to file
      fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
      
      return newProduct;
    } catch (error) {
      console.error("Error creating product:", error);
      return null;
    }
  },

  // Update product
  update: (id, productData) => {
    try {
      let products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
      
      // Find product index
      const productIndex = products.findIndex(product => product.id === id);
      if (productIndex === -1) {
        return null;
      }
      
      // Update product data
      products[productIndex] = { ...products[productIndex], ...productData };
      
      // Write back to file
      fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
      
      return products[productIndex];
    } catch (error) {
      console.error("Error updating product:", error);
      return null;
    }
  },

  // Update product quantity
  updateQuantity: (id, quantityChange) => {
    try {
      let products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
      
      // Find product index
      const productIndex = products.findIndex(product => product.id === id);
      if (productIndex === -1) {
        return null;
      }
      
      // Check if enough quantity is available
      if (products[productIndex].quantity + quantityChange < 0) {
        return { error: "Not enough quantity available" };
      }
      
      // Update quantity
      products[productIndex].quantity += quantityChange;
      
      // Write back to file
      fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
      
      return products[productIndex];
    } catch (error) {
      console.error("Error updating product quantity:", error);
      return null;
    }
  }
};

module.exports = Product;
