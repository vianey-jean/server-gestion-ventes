const fs = require('fs');
const path = require('path');

const notificationsPath = path.join(__dirname, '../db/rdvNotifications.json');

// Ensure the file exists
if (!fs.existsSync(notificationsPath)) {
  fs.writeFileSync(notificationsPath, JSON.stringify([], null, 2));
}

const RdvNotification = {
  // Get all notifications
  getAll: () => {
    try {
      const notifications = JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
      return notifications;
    } catch (error) {
      console.error("Error reading notifications:", error);
      return [];
    }
  },

  // Get notifications by rdv ID
  getByRdvId: (rdvId) => {
    try {
      const notifications = JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
      return notifications.find(n => n.rdvId === rdvId);
    } catch (error) {
      console.error("Error reading notification by rdv ID:", error);
      return null;
    }
  },

  // Get unread notifications count
  getUnreadCount: () => {
    try {
      const notifications = JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
      return notifications.filter(n => !n.read).length;
    } catch (error) {
      console.error("Error counting unread notifications:", error);
      return 0;
    }
  },

  // Get unread notifications
  getUnread: () => {
    try {
      const notifications = JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
      return notifications.filter(n => !n.read);
    } catch (error) {
      console.error("Error reading unread notifications:", error);
      return [];
    }
  },

  // Create notification for RDV less than 24h
  create: (rdvData) => {
    try {
      const notifications = JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
      
      // Check if notification already exists for this rdv
      const exists = notifications.find(n => n.rdvId === rdvData.id);
      if (exists) {
        return exists;
      }
      
      const now = new Date().toISOString();
      const newNotification = {
        id: Date.now().toString(),
        rdvId: rdvData.id,
        rdvTitre: rdvData.titre,
        rdvClientNom: rdvData.clientNom,
        rdvClientTelephone: rdvData.clientTelephone || '',
        rdvDate: rdvData.date,
        rdvHeureDebut: rdvData.heureDebut,
        rdvHeureFin: rdvData.heureFin,
        rdvLieu: rdvData.lieu || '',
        message: `Rendez-vous dans moins de 24h: ${rdvData.titre}`,
        read: false,
        createdAt: now
      };
      
      notifications.push(newNotification);
      fs.writeFileSync(notificationsPath, JSON.stringify(notifications, null, 2));
      
      return newNotification;
    } catch (error) {
      console.error("Error creating notification:", error);
      return null;
    }
  },

  // Mark notification as read
  markAsRead: (id) => {
    try {
      let notifications = JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
      
      const index = notifications.findIndex(n => n.id === id);
      if (index === -1) {
        return false;
      }
      
      notifications[index].read = true;
      fs.writeFileSync(notificationsPath, JSON.stringify(notifications, null, 2));
      
      return true;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }
  },

  // Delete notification
  delete: (id) => {
    try {
      let notifications = JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
      
      const index = notifications.findIndex(n => n.id === id);
      if (index === -1) {
        return false;
      }
      
      notifications.splice(index, 1);
      fs.writeFileSync(notificationsPath, JSON.stringify(notifications, null, 2));
      
      return true;
    } catch (error) {
      console.error("Error deleting notification:", error);
      return false;
    }
  },

  // Delete notification by rdv ID
  deleteByRdvId: (rdvId) => {
    try {
      let notifications = JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
      
      const filtered = notifications.filter(n => n.rdvId !== rdvId);
      fs.writeFileSync(notificationsPath, JSON.stringify(filtered, null, 2));
      
      return true;
    } catch (error) {
      console.error("Error deleting notification by rdv ID:", error);
      return false;
    }
  },

  // Check and create notifications for RDVs within 24 hours
  checkAndCreateNotifications: (rdvs) => {
    try {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const createdNotifications = [];
      
      rdvs.forEach(rdv => {
        if (rdv.statut === 'annule' || rdv.statut === 'termine') return;
        
        const rdvDateTime = new Date(`${rdv.date}T${rdv.heureDebut}`);
        
        // Check if RDV is within 24 hours and in the future
        if (rdvDateTime > now && rdvDateTime <= in24Hours) {
          const notification = RdvNotification.create(rdv);
          if (notification && notification.id) {
            createdNotifications.push(notification);
          }
        }
      });
      
      return createdNotifications;
    } catch (error) {
      console.error("Error checking and creating notifications:", error);
      return [];
    }
  }
};

module.exports = RdvNotification;