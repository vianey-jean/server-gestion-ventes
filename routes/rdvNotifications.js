const express = require('express');
const router = express.Router();
const RdvNotification = require('../models/RdvNotification');
const Rdv = require('../models/Rdv');
const authMiddleware = require('../middleware/auth');

// Get all notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = RdvNotification.getAll();
    res.json(notifications);
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread notifications
router.get('/unread', authMiddleware, async (req, res) => {
  try {
    const notifications = RdvNotification.getUnread();
    res.json(notifications);
  } catch (error) {
    console.error('Error getting unread notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread count
router.get('/count', authMiddleware, async (req, res) => {
  try {
    const count = RdvNotification.getUnreadCount();
    res.json({ count });
  } catch (error) {
    console.error('Error getting notification count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check and create notifications for RDVs within 24 hours
router.post('/check', authMiddleware, async (req, res) => {
  try {
    const rdvs = Rdv.getAll();
    const created = RdvNotification.checkAndCreateNotifications(rdvs);
    res.json({ created: created.length, notifications: created });
  } catch (error) {
    console.error('Error checking notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const success = RdvNotification.markAsRead(req.params.id);
    if (!success) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete notification
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const success = RdvNotification.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get notification by rdv ID
router.get('/by-rdv/:rdvId', authMiddleware, async (req, res) => {
  try {
    const notification = RdvNotification.getByRdvId(req.params.rdvId);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  } catch (error) {
    console.error('Error getting notification by rdv ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update notification status (for rdv validation/cancellation/report)
router.put('/status/:rdvId', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }
    const success = RdvNotification.updateStatus(req.params.rdvId, status);
    if (!success) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating notification status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update notification by rdv ID (for rdv reschedule)
router.put('/by-rdv/:rdvId', authMiddleware, async (req, res) => {
  try {
    const notification = RdvNotification.updateByRdvId(req.params.rdvId, req.body);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  } catch (error) {
    console.error('Error updating notification by rdv ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete notification by rdv ID
router.delete('/by-rdv/:rdvId', authMiddleware, async (req, res) => {
  try {
    const success = RdvNotification.deleteByRdvId(req.params.rdvId);
    res.json({ success });
  } catch (error) {
    console.error('Error deleting notification by rdv ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;