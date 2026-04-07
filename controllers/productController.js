/**
 * =============================================================================
 * Contrôleur Produits - Logique métier CRUD des produits
 * =============================================================================
 * 
 * Gère : liste, recherche, création, mise à jour, suppression, photos produits.
 * 
 * @module controllers/productController
 */

const Product = require('../models/Product');
const path = require('path');
const fs = require('fs');

exports.getAll = async (req, res) => {
  try { res.json(Product.getAll()); }
  catch (error) { console.error('Error getting products:', error); res.status(500).json({ message: 'Server error' }); }
};

exports.generateCodes = async (req, res) => {
  try {
    const result = Product.generateCodesForExistingProducts();
    if (result.success) res.json({ message: `Codes générés pour ${result.updatedCount} produits`, updatedCount: result.updatedCount });
    else res.status(500).json({ message: 'Error generating codes', error: result.error });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.search = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 3) return res.json([]);
    res.json(Product.search(query));
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.getById = async (req, res) => {
  try {
    const product = Product.getById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.create = async (req, res) => {
  try {
    const { description, purchasePrice, quantity } = req.body;
    if (!description || purchasePrice === undefined || quantity === undefined) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const productData = {
      description, purchasePrice: Number(purchasePrice), quantity: Number(quantity),
      fournisseur: req.body.fournisseur || '',
      sellingPrice: req.body.sellingPrice !== undefined ? Number(req.body.sellingPrice) : undefined
    };
    const newProduct = Product.create(productData);
    if (!newProduct) return res.status(500).json({ message: 'Error creating product' });
    res.status(201).json(newProduct);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.update = async (req, res) => {
  try {
    const { description, purchasePrice, quantity, reserver, fournisseur, sellingPrice } = req.body;
    if ([description, purchasePrice, quantity, reserver, fournisseur, sellingPrice].every(v => v === undefined)) {
      return res.status(400).json({ message: 'At least one field is required for update' });
    }
    const productData = {};
    if (description !== undefined) productData.description = description;
    if (purchasePrice !== undefined) productData.purchasePrice = Number(purchasePrice);
    if (quantity !== undefined) productData.quantity = Number(quantity);
    if (reserver !== undefined) productData.reserver = reserver;
    if (fournisseur !== undefined) productData.fournisseur = fournisseur;
    if (sellingPrice !== undefined) productData.sellingPrice = Number(sellingPrice);

    const updatedProduct = Product.update(req.params.id, productData);
    if (!updatedProduct) return res.status(404).json({ message: 'Product not found' });
    if (updatedProduct.error) return res.status(400).json({ message: updatedProduct.error });
    res.json(updatedProduct);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.delete = async (req, res) => {
  try {
    const product = Product.getById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const success = Product.delete(req.params.id);
    if (!success) return res.status(500).json({ message: 'Error deleting product' });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.updateQuantity = async (req, res) => {
  try {
    const { quantityChange } = req.body;
    if (quantityChange === undefined) return res.status(400).json({ message: 'Quantity change is required' });
    const result = Product.updateQuantity(req.params.id, Number(quantityChange));
    if (!result) return res.status(404).json({ message: 'Product not found' });
    if (result.error) return res.status(400).json({ message: result.error });
    res.json(result);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    const product = Product.getById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json(Product.update(req.params.id, { imageUrl }));
  } catch (error) { res.status(500).json({ message: error.message || 'Server error' }); }
};

exports.uploadPhotos = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No photos uploaded' });
    const product = Product.getById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const mainPhotoIndex = req.body.mainPhotoIndex !== undefined ? parseInt(req.body.mainPhotoIndex) : 0;
    const newPhotoUrls = req.files.map(file => `/uploads/${file.filename}`);
    const existingPhotos = product.photos || [];
    const allPhotos = [...existingPhotos, ...newPhotoUrls];
    let mainPhoto = req.body.mainPhotoUrl || newPhotoUrls[mainPhotoIndex] || newPhotoUrls[0];
    if (!mainPhoto && allPhotos.length > 0) mainPhoto = allPhotos[0];

    res.json(Product.update(req.params.id, { photos: allPhotos, mainPhoto }));
  } catch (error) { res.status(500).json({ message: error.message || 'Server error' }); }
};

exports.replacePhotos = async (req, res) => {
  try {
    const product = Product.getById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const mainPhotoIndex = req.body.mainPhotoIndex !== undefined ? parseInt(req.body.mainPhotoIndex) : 0;
    let keptExistingUrls = [];
    if (req.body.photosJson) try { keptExistingUrls = JSON.parse(req.body.photosJson); } catch {}

    const newPhotoUrls = (req.files || []).map(file => `/uploads/${file.filename}`);
    const photos = [...keptExistingUrls, ...newPhotoUrls];
    const mainPhoto = photos[mainPhotoIndex] || photos[0] || null;

    // Supprimer les anciennes photos
    (product.photos || []).forEach(oldUrl => {
      if (!keptExistingUrls.includes(oldUrl)) {
        try {
          const filePath = path.join(__dirname, '../uploads', oldUrl.replace('/uploads/', ''));
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
      }
    });

    res.json(Product.update(req.params.id, { photos, mainPhoto }));
  } catch (error) { res.status(500).json({ message: error.message || 'Server error' }); }
};

exports.deletePhoto = async (req, res) => {
  try {
    const product = Product.getById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const photoIndex = parseInt(req.params.photoIndex);
    const photos = product.photos || [];
    if (photoIndex < 0 || photoIndex >= photos.length) return res.status(400).json({ message: 'Invalid photo index' });

    const photoUrl = photos[photoIndex];
    const filePath = path.join(__dirname, '../uploads', photoUrl.replace('/uploads/', ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    photos.splice(photoIndex, 1);
    let mainPhoto = product.mainPhoto;
    if (mainPhoto === photoUrl) mainPhoto = photos[0] || null;

    res.json(Product.update(req.params.id, { photos, mainPhoto }));
  } catch (error) { res.status(500).json({ message: error.message || 'Server error' }); }
};
