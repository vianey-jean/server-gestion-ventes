
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = Product.getAll();
    res.json(products);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate codes for existing products without codes
router.post('/generate-codes', authMiddleware, async (req, res) => {
  try {
    console.log('🔧 API: Generating codes for existing products...');
    const result = Product.generateCodesForExistingProducts();
    
    if (result.success) {
      console.log(`✅ API: Generated codes for ${result.updatedCount} products`);
      res.json({ 
        message: `Codes générés pour ${result.updatedCount} produits`,
        updatedCount: result.updatedCount 
      });
    } else {
      console.error('❌ API: Error generating codes:', result.error);
      res.status(500).json({ message: 'Error generating codes', error: result.error });
    }
  } catch (error) {
    console.error('❌ API: Error generating codes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search products
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 3) {
      return res.json([]);
    }
    
    const products = Product.search(query);
    res.json(products);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = Product.getById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error getting product by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create product (requires authentication)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { description, purchasePrice, quantity } = req.body;
    
    if (!description || purchasePrice === undefined || quantity === undefined) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    const productData = {
      description,
      purchasePrice: Number(purchasePrice),
      quantity: Number(quantity)
    };
    
    const newProduct = Product.create(productData);
    
    if (!newProduct) {
      return res.status(500).json({ message: 'Error creating product' });
    }
    
    console.log('✅ Product created successfully:', newProduct);
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('❌ Error creating product:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update product (requires authentication)
// Cette route accepte des mises à jour partielles - seuls les champs fournis seront mis à jour
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { description, purchasePrice, quantity, reserver } = req.body;
    
    // Vérifier qu'au moins un champ est fourni pour la mise à jour
    if (description === undefined && purchasePrice === undefined && quantity === undefined && reserver === undefined) {
      return res.status(400).json({ message: 'At least one field is required for update' });
    }
    
    // Construire l'objet de mise à jour avec seulement les champs fournis
    const productData = {};
    if (description !== undefined) productData.description = description;
    if (purchasePrice !== undefined) productData.purchasePrice = Number(purchasePrice);
    if (quantity !== undefined) productData.quantity = Number(quantity);
    if (reserver !== undefined) productData.reserver = reserver;
    
    const updatedProduct = Product.update(req.params.id, productData);
    
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    if (updatedProduct.error) {
      return res.status(400).json({ message: updatedProduct.error });
    }
    
    console.log('✅ Product updated successfully:', updatedProduct);
    res.json(updatedProduct);
  } catch (error) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete product (requires authentication)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    console.log('🗑️ Attempting to delete product with ID:', req.params.id);
    
    const product = Product.getById(req.params.id);
    
    if (!product) {
      console.log('❌ Product not found for deletion:', req.params.id);
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const success = Product.delete(req.params.id);
    
    if (!success) {
      console.log('❌ Failed to delete product:', req.params.id);
      return res.status(500).json({ message: 'Error deleting product' });
    }
    
    console.log('✅ Product deleted successfully:', req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting product:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update product quantity (requires authentication)
router.patch('/:id/quantity', authMiddleware, async (req, res) => {
  try {
    const { quantityChange } = req.body;
    
    if (quantityChange === undefined) {
      return res.status(400).json({ message: 'Quantity change is required' });
    }
    
    const result = Product.updateQuantity(req.params.id, Number(quantityChange));
    
    if (!result) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error updating product quantity:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload product image (requires authentication)
router.post('/:id/image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }
    
    const product = Product.getById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Update product with image URL
    const imageUrl = `/uploads/${req.file.filename}`;
    const updatedProduct = Product.update(req.params.id, { imageUrl });
    
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error uploading product image:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

module.exports = router;
