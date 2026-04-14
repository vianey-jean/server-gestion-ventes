/**
 * rdv.js - Routes API pour la gestion des rendez-vous
 * 
 * CRUD complet avec notifications, rappels et lien avec les clients.
 */
const express = require('express');
const router = express.Router();
const Rdv = require('../models/Rdv');
const Client = require('../models/Client');
const RdvNotification = require('../models/RdvNotification');
const authMiddleware = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const readJson = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return []; }
};

const checkIndisponibilite = (date, heureDebut, heureFin) => {
  const indispoPath = path.join(__dirname, '../db/indisponible.json');
  const indispos = readJson(indispoPath);
  const indispoForDate = indispos.filter(d => d.date === date);
  if (indispoForDate.length === 0) return { disponible: true };
  const conflicts = indispoForDate.filter(d => {
    if (d.journeeComplete) return true;
    if (!heureDebut || !heureFin) return true;
    return d.heureDebut < heureFin && d.heureFin > heureDebut;
  });
  if (conflicts.length > 0) {
    const c = conflicts[0];
    return {
      disponible: false,
      message: c.journeeComplete
        ? `Journée indisponible${c.motif ? ` (${c.motif})` : ''}`
        : `Créneau indisponible: ${c.heureDebut} - ${c.heureFin}${c.motif ? ` (${c.motif})` : ''}`
    };
  }
  return { disponible: true };
};

// Get all rdvs
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rdvs = Rdv.getAll();
    res.json(rdvs);
  } catch (error) {
    console.error('Error getting all rdvs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search rdvs
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }
    const rdvs = Rdv.search(q);
    res.json(rdvs);
  } catch (error) {
    console.error('Error searching rdvs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search clients for autocomplete
router.get('/search-clients', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 3) {
      return res.json([]);
    }
    
    const clients = Client.getAll();
    const lowerQuery = q.toLowerCase();
    const matchedClients = clients.filter(client => 
      client.nom.toLowerCase().includes(lowerQuery)
    ).slice(0, 10); // Limit to 10 results
    
    res.json(matchedClients);
  } catch (error) {
    console.error('Error searching clients:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get rdvs by week
router.get('/week', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ message: 'Start and end dates are required' });
    }
    const rdvs = Rdv.getByDateRange(start, end);
    res.json(rdvs);
  } catch (error) {
    console.error('Error getting rdvs by week:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check conflicts
router.get('/conflicts', authMiddleware, async (req, res) => {
  try {
    const { date, heureDebut, heureFin, excludeId } = req.query;
    if (!date || !heureDebut || !heureFin) {
      return res.status(400).json({ message: 'Date, heureDebut and heureFin are required' });
    }
    const conflicts = Rdv.checkConflicts(date, heureDebut, heureFin, excludeId);
    res.json(conflicts);
  } catch (error) {
    console.error('Error checking conflicts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get rdv by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const rdv = Rdv.getById(req.params.id);
    
    if (!rdv) {
      return res.status(404).json({ message: 'RDV not found' });
    }
    
    res.json(rdv);
  } catch (error) {
    console.error('Error getting rdv by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new rdv
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { titre, clientNom, date, heureDebut, heureFin } = req.body;
    
    if (!titre || !clientNom || !date || !heureDebut || !heureFin) {
      return res.status(400).json({ message: 'Titre, clientNom, date, heureDebut et heureFin sont obligatoires' });
    }

    // Check indisponibilité
    const indispoCheck = checkIndisponibilite(date, heureDebut, heureFin);
    if (!indispoCheck.disponible) {
      return res.status(409).json({ message: `🚫 ${indispoCheck.message}. Impossible de créer un RDV pendant un créneau indisponible.` });
    }
    
    const newRdv = Rdv.create(req.body);
    
    if (!newRdv) {
      return res.status(500).json({ message: 'Error creating rdv' });
    }
    
    // Créer automatiquement une notification pour ce nouveau RDV
    RdvNotification.create(newRdv);
    
    res.status(201).json(newRdv);
  } catch (error) {
    console.error('Error creating rdv:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update rdv
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const oldRdv = Rdv.getById(req.params.id);
    const updatedRdv = Rdv.update(req.params.id, req.body);
    
    if (!updatedRdv) {
      return res.status(404).json({ message: 'RDV not found' });
    }
    
    // Synchroniser la notification selon le statut
    if (req.body.statut) {
      if (req.body.statut === 'annule' || req.body.statut === 'termine' || req.body.statut === 'valide') {
        // Désactiver la notification
        RdvNotification.updateStatus(req.params.id, req.body.statut);
      } else if (req.body.statut === 'reporte') {
        // Mettre à jour la notification avec les nouvelles infos
        RdvNotification.updateByRdvId(req.params.id, updatedRdv);
      }
    } else if (oldRdv && (oldRdv.date !== updatedRdv.date || oldRdv.heureDebut !== updatedRdv.heureDebut)) {
      // Date/heure modifiée, mettre à jour la notification
      RdvNotification.updateByRdvId(req.params.id, updatedRdv);
    }
    
    res.json(updatedRdv);
  } catch (error) {
    console.error('Error updating rdv:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update rdv by commande ID (for reservation reschedule)
router.put('/by-commande/:commandeId', authMiddleware, async (req, res) => {
  try {
    const oldRdv = Rdv.getByCommandeId(req.params.commandeId);
    const updatedRdv = Rdv.updateByCommandeId(req.params.commandeId, req.body);
    
    if (!updatedRdv) {
      return res.status(404).json({ message: 'RDV not found for this commande' });
    }
    
    // Synchroniser la notification selon le statut
    if (req.body.statut) {
      if (req.body.statut === 'annule' || req.body.statut === 'termine' || req.body.statut === 'valide') {
        RdvNotification.updateStatus(updatedRdv.id, req.body.statut);
      } else if (req.body.statut === 'reporte') {
        RdvNotification.updateByRdvId(updatedRdv.id, updatedRdv);
      }
    } else if (oldRdv && (oldRdv.date !== updatedRdv.date || oldRdv.heureDebut !== updatedRdv.heureDebut)) {
      RdvNotification.updateByRdvId(updatedRdv.id, updatedRdv);
    }
    
    res.json(updatedRdv);
  } catch (error) {
    console.error('Error updating rdv by commande:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete rdv
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Supprimer d'abord la notification associée
    RdvNotification.deleteByRdvId(req.params.id);
    
    const success = Rdv.delete(req.params.id);
    
    if (!success) {
      return res.status(404).json({ message: 'RDV not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting rdv:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
