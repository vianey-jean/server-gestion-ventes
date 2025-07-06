
const express = require('express');
const router = express.Router();
const syncManager = require('../middleware/sync');
const authMiddleware = require('../middleware/auth');

// Endpoint pour Server-Sent Events avec meilleure gestion
router.get('/events', (req, res) => {
  console.log('Nouvelle connexion SSE demandée');
  
  // Configuration SSE optimisée
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  });

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`Client SSE connecté: ${clientId}`);
  
  // Fonction pour envoyer des événements au client
  const sendEvent = (event, data) => {
    try {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(message);
      console.log(`Événement envoyé à ${clientId}:`, event, data.type || 'no-type');
    } catch (error) {
      console.error(`Erreur envoi événement à ${clientId}:`, error);
    }
  };

  // Ajouter le client au gestionnaire de synchronisation
  syncManager.addClient(clientId, sendEvent);

  // Envoyer un événement de connexion
  sendEvent('connected', { 
    clientId, 
    timestamp: new Date(),
    message: 'Connexion SSE établie' 
  });

  // Gérer la fermeture de connexion
  req.on('close', () => {
    console.log(`Client ${clientId} déconnecté (close)`);
    syncManager.removeClient(clientId);
  });

  req.on('end', () => {
    console.log(`Client ${clientId} déconnecté (end)`);
    syncManager.removeClient(clientId);
  });

  // Gérer les erreurs
  req.on('error', (error) => {
    console.error(`Erreur client ${clientId}:`, error);
    syncManager.removeClient(clientId);
  });
});

// Endpoint pour forcer la synchronisation
router.post('/force-sync', authMiddleware, (req, res) => {
  try {
    console.log('Synchronisation forcée demandée');
    
    syncManager.notifyClients('force-sync', {
      timestamp: new Date(),
      source: 'manual',
      message: 'Synchronisation forcée'
    });
    
    res.json({ 
      success: true, 
      message: 'Synchronisation forcée', 
      clients: syncManager.clients.size 
    });
  } catch (error) {
    console.error('Erreur force sync:', error);
    res.status(500).json({ error: 'Erreur lors de la synchronisation' });
  }
});

// Endpoint pour obtenir le statut de synchronisation
router.get('/status', (req, res) => {
  try {
    const status = {
      clients: syncManager.clients.size,
      lastSync: new Date(),
      watchers: syncManager.watchers.size,
      isRunning: true
    };
    
    console.log('Statut synchronisation demandé:', status);
    res.json(status);
  } catch (error) {
    console.error('Erreur statut sync:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du statut' });
  }
});

// Endpoint de test pour vérifier la connectivité
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Serveur de synchronisation actif',
    timestamp: new Date(),
    clients: syncManager.clients.size
  });
});

module.exports = router;
