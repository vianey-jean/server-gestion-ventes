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

// Update comment (requires auth)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { comment, rating, clientName } = req.body;
    if (!comment || rating === undefined) {
      return res.status(400).json({ message: 'comment and rating are required' });
    }

    const updatedComment = ProductComment.update(req.params.id, {
      comment,
      rating,
      clientName: clientName || '',
    });

    if (!updatedComment) return res.status(404).json({ message: 'Comment not found' });
    res.json(updatedComment);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete multiple comments (requires auth)
router.delete('/bulk', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' });
    }

    const count = ProductComment.deleteMany(ids);
    res.json({ message: `${count} comments deleted`, count });
  } catch (error) {
    console.error('Error deleting comments:', error);
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
