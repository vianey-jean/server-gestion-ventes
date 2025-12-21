const fs = require('fs');
const path = require('path');

const rdvPath = path.join(__dirname, '../db/rdv.json');

// Ensure the file exists
if (!fs.existsSync(rdvPath)) {
  fs.writeFileSync(rdvPath, JSON.stringify([], null, 2));
}

const Rdv = {
  // Get all rdv
  getAll: () => {
    try {
      const rdvs = JSON.parse(fs.readFileSync(rdvPath, 'utf8'));
      return rdvs;
    } catch (error) {
      console.error("Error reading rdvs:", error);
      return [];
    }
  },

  // Get rdv by ID
  getById: (id) => {
    try {
      const rdvs = JSON.parse(fs.readFileSync(rdvPath, 'utf8'));
      return rdvs.find(rdv => rdv.id === id);
    } catch (error) {
      console.error("Error reading rdv by ID:", error);
      return null;
    }
  },

  // Get rdv by client name
  getByClientNom: (clientNom) => {
    try {
      const rdvs = JSON.parse(fs.readFileSync(rdvPath, 'utf8'));
      return rdvs.filter(rdv => 
        rdv.clientNom.toLowerCase().includes(clientNom.toLowerCase())
      );
    } catch (error) {
      console.error("Error reading rdv by client:", error);
      return [];
    }
  },

  // Get rdv by commande ID
  getByCommandeId: (commandeId) => {
    try {
      const rdvs = JSON.parse(fs.readFileSync(rdvPath, 'utf8'));
      return rdvs.find(rdv => rdv.commandeId === commandeId);
    } catch (error) {
      console.error("Error reading rdv by commande:", error);
      return null;
    }
  },

  // Get rdvs by date range
  getByDateRange: (startDate, endDate) => {
    try {
      const rdvs = JSON.parse(fs.readFileSync(rdvPath, 'utf8'));
      return rdvs.filter(rdv => rdv.date >= startDate && rdv.date <= endDate);
    } catch (error) {
      console.error("Error reading rdvs by date range:", error);
      return [];
    }
  },

  // Search rdvs
  search: (query) => {
    try {
      const rdvs = JSON.parse(fs.readFileSync(rdvPath, 'utf8'));
      const lowerQuery = query.toLowerCase();
      return rdvs.filter(rdv => 
        rdv.titre.toLowerCase().includes(lowerQuery) ||
        rdv.clientNom.toLowerCase().includes(lowerQuery) ||
        (rdv.description && rdv.description.toLowerCase().includes(lowerQuery)) ||
        (rdv.lieu && rdv.lieu.toLowerCase().includes(lowerQuery))
      );
    } catch (error) {
      console.error("Error searching rdvs:", error);
      return [];
    }
  },

  // Check conflicts
  checkConflicts: (date, heureDebut, heureFin, excludeId = null) => {
    try {
      const rdvs = JSON.parse(fs.readFileSync(rdvPath, 'utf8'));
      return rdvs.filter(rdv => {
        if (excludeId && rdv.id === excludeId) return false;
        if (rdv.date !== date) return false;
        if (rdv.statut === 'annule' || rdv.statut === 'termine') return false;
        
        // Check time overlap
        const start1 = rdv.heureDebut;
        const end1 = rdv.heureFin;
        const start2 = heureDebut;
        const end2 = heureFin;
        
        return (start1 < end2 && end1 > start2);
      });
    } catch (error) {
      console.error("Error checking conflicts:", error);
      return [];
    }
  },

  // Create new rdv
  create: (rdvData) => {
    try {
      const rdvs = JSON.parse(fs.readFileSync(rdvPath, 'utf8'));
      
      const now = new Date().toISOString();
      const newRdv = {
        id: Date.now().toString(),
        titre: rdvData.titre,
        description: rdvData.description || '',
        clientNom: rdvData.clientNom,
        clientTelephone: rdvData.clientTelephone || '',
        clientAdresse: rdvData.clientAdresse || '',
        date: rdvData.date,
        heureDebut: rdvData.heureDebut,
        heureFin: rdvData.heureFin,
        lieu: rdvData.lieu || '',
        statut: rdvData.statut || 'planifie',
        notes: rdvData.notes || '',
        produits: rdvData.produits || [],
        commandeId: rdvData.commandeId || null,
        notificationEnvoyee: false,
        rappelEnvoye: false,
        createdAt: now,
        updatedAt: now
      };
      
      rdvs.push(newRdv);
      fs.writeFileSync(rdvPath, JSON.stringify(rdvs, null, 2));
      
      return newRdv;
    } catch (error) {
      console.error("Error creating rdv:", error);
      return null;
    }
  },

  // Update rdv
  update: (id, rdvData) => {
    try {
      let rdvs = JSON.parse(fs.readFileSync(rdvPath, 'utf8'));
      
      const rdvIndex = rdvs.findIndex(rdv => rdv.id === id);
      if (rdvIndex === -1) {
        return null;
      }
      
      const oldRdv = rdvs[rdvIndex];
      
      rdvs[rdvIndex] = { 
        ...oldRdv, 
        ...rdvData,
        id: oldRdv.id,
        createdAt: oldRdv.createdAt,
        updatedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(rdvPath, JSON.stringify(rdvs, null, 2));
      
      return rdvs[rdvIndex];
    } catch (error) {
      console.error("Error updating rdv:", error);
      return null;
    }
  },

  // Update rdv by commande ID (for reservation reschedule)
  updateByCommandeId: (commandeId, rdvData) => {
    try {
      let rdvs = JSON.parse(fs.readFileSync(rdvPath, 'utf8'));
      
      const rdvIndex = rdvs.findIndex(rdv => rdv.commandeId === commandeId);
      if (rdvIndex === -1) {
        return null;
      }
      
      const oldRdv = rdvs[rdvIndex];
      
      rdvs[rdvIndex] = { 
        ...oldRdv, 
        ...rdvData,
        id: oldRdv.id,
        createdAt: oldRdv.createdAt,
        updatedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(rdvPath, JSON.stringify(rdvs, null, 2));
      
      return rdvs[rdvIndex];
    } catch (error) {
      console.error("Error updating rdv by commande:", error);
      return null;
    }
  },

  // Delete rdv
  delete: (id) => {
    try {
      let rdvs = JSON.parse(fs.readFileSync(rdvPath, 'utf8'));
      
      const rdvIndex = rdvs.findIndex(rdv => rdv.id === id);
      if (rdvIndex === -1) {
        return false;
      }
      
      rdvs.splice(rdvIndex, 1);
      fs.writeFileSync(rdvPath, JSON.stringify(rdvs, null, 2));
      
      return true;
    } catch (error) {
      console.error("Error deleting rdv:", error);
      return false;
    }
  }
};

module.exports = Rdv;
