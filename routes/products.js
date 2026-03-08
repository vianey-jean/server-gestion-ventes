
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

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
      quantity: Number(quantity),
      fournisseur: req.body.fournisseur || '',
      sellingPrice: req.body.sellingPrice !== undefined ? Number(req.body.sellingPrice) : undefined
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
    const { description, purchasePrice, quantity, reserver, fournisseur, sellingPrice } = req.body;
    
    // Vérifier qu'au moins un champ est fourni pour la mise à jour
    if (description === undefined && purchasePrice === undefined && quantity === undefined && reserver === undefined && fournisseur === undefined && sellingPrice === undefined) {
      return res.status(400).json({ message: 'At least one field is required for update' });
    }
    
    // Construire l'objet de mise à jour avec seulement les champs fournis
    const productData = {};
    if (description !== undefined) productData.description = description;
    if (purchasePrice !== undefined) productData.purchasePrice = Number(purchasePrice);
    if (quantity !== undefined) productData.quantity = Number(quantity);
    if (reserver !== undefined) productData.reserver = reserver;
    if (fournisseur !== undefined) productData.fournisseur = fournisseur;
    if (sellingPrice !== undefined) productData.sellingPrice = Number(sellingPrice);
    
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

// Upload multiple photos for a product (requires authentication)
router.post('/:id/photos', authMiddleware, upload.array('photos', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No photos uploaded' });
    }

    const product = Product.getById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const mainPhotoIndex = req.body.mainPhotoIndex !== undefined ? parseInt(req.body.mainPhotoIndex) : 0;
    
    // Build photo URLs
    const newPhotoUrls = req.files.map(file => `/uploads/${file.filename}`);
    
    // Merge with existing photos if any
    const existingPhotos = product.photos || [];
    const allPhotos = [...existingPhotos, ...newPhotoUrls];
    
    // Determine main photo
    let mainPhoto = req.body.mainPhotoUrl || newPhotoUrls[mainPhotoIndex] || newPhotoUrls[0];
    if (!mainPhoto && allPhotos.length > 0) mainPhoto = allPhotos[0];

    const updatedProduct = Product.update(req.params.id, { 
      photos: allPhotos, 
      mainPhoto 
    });

    console.log(`✅ Photos uploaded for product ${req.params.id}: ${newPhotoUrls.length} photos`);
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error uploading product photos:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Replace all photos for a product (requires authentication)
router.put('/:id/photos', authMiddleware, upload.array('photos', 6), async (req, res) => {
  try {
    const product = Product.getById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const mainPhotoIndex = req.body.mainPhotoIndex !== undefined ? parseInt(req.body.mainPhotoIndex) : 0;
    
    // Parse kept existing photo URLs
    let keptExistingUrls = [];
    if (req.body.photosJson) {
      try {
        keptExistingUrls = JSON.parse(req.body.photosJson);
      } catch(e) {}
    }

    // New uploaded file URLs
    const newPhotoUrls = (req.files || []).map(file => `/uploads/${file.filename}`);
    
    // Combined photos: kept existing + new uploads
    const photos = [...keptExistingUrls, ...newPhotoUrls];
    const mainPhoto = photos[mainPhotoIndex] || photos[0] || null;

    // Delete old photo files that are no longer kept
    const oldPhotos = product.photos || [];
    oldPhotos.forEach(oldUrl => {
      if (!keptExistingUrls.includes(oldUrl)) {
        try {
          const filename = oldUrl.replace('/uploads/', '');
          const filePath = path.join(__dirname, '../uploads', filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted replaced photo: ${filename}`);
          }
        } catch (e) {
          console.warn(`⚠️ Could not delete old photo: ${oldUrl}`);
        }
      }
    });

    const updatedProduct = Product.update(req.params.id, { photos, mainPhoto });
    console.log(`✅ Photos updated for product ${req.params.id}`);
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product photos:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Delete a specific photo from a product (requires authentication)
router.delete('/:id/photos/:photoIndex', authMiddleware, async (req, res) => {
  try {
    const product = Product.getById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const photoIndex = parseInt(req.params.photoIndex);
    const photos = product.photos || [];
    
    if (photoIndex < 0 || photoIndex >= photos.length) {
      return res.status(400).json({ message: 'Invalid photo index' });
    }

    // Try to delete file from disk
    const photoUrl = photos[photoIndex];
    const filename = photoUrl.replace('/uploads/', '');
    const filePath = path.join(__dirname, '../uploads', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    photos.splice(photoIndex, 1);
    
    // Update main photo if needed
    let mainPhoto = product.mainPhoto;
    if (mainPhoto === photoUrl) {
      mainPhoto = photos[0] || null;
    }

    const updatedProduct = Product.update(req.params.id, { photos, mainPhoto });
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error deleting product photo:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

module.exports = router;
