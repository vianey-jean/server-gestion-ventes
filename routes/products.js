
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
    res.status(500).json({ message: 'Server error' });
  }
});

// Create product (requires authentication)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { description, purchasePrice, quantity } = req.body;
    
    if (!description || !purchasePrice || !quantity) {
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
    
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update product (requires authentication)
router.put('/:id', authMiddleware, async (req, res) => {
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
    
    const updatedProduct = Product.update(req.params.id, productData);
    
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    if (updatedProduct.error) {
      return res.status(400).json({ message: updatedProduct.error });
    }
    
    res.json(updatedProduct);
  } catch (error) {
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
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

module.exports = router;
