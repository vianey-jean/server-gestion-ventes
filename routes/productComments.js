const express = require('express');
const router = express.Router();
const ProductComment = require('../models/ProductComment');
const authMiddleware = require('../middleware/auth');

// Get all ratings summary (public)
router.get('/ratings', async (req, res) => {
  try {
    res.json(ProductComment.getAllRatings());
  } catch (error) {
    console.error('Error getting ratings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get comments for a product
router.get('/product/:productId', async (req, res) => {
  try {
    res.json(ProductComment.getByProductId(req.params.productId));
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add comment (requires auth)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { productId, comment, rating, clientName } = req.body;
    if (!productId || !comment || !rating) {
      return res.status(400).json({ message: 'productId, comment, and rating are required' });
    }
    const newComment = ProductComment.create({ productId, comment, rating, clientName: clientName || '' });
    res.status(201).json(newComment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete comment (requires auth)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const success = ProductComment.delete(req.params.id);
    if (!success) return res.status(404).json({ message: 'Comment not found' });
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete all comments for a product
router.delete('/product/:productId', authMiddleware, async (req, res) => {
  try {
    const count = ProductComment.deleteByProductId(req.params.productId);
    res.json({ message: `${count} comments deleted`, count });
  } catch (error) {
    console.error('Error deleting product comments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
