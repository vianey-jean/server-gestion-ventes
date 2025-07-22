
const express = require('express');
const router = express.Router();
const syncManager = require('../middleware/sync');
const authMiddleware = require('../middleware/auth');

// Middleware CORS spécifique pour SSE avec gestion des origines multiples
const setCORSHeaders = (req, res) => {
  const origin = req.get('Origin');
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'https://loving-river-0c35b7710.5.azurestaticapps.net',
    'https://server-gestion-ventes.onrender.com'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Cache-Control, Authorization, Content-Type, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Max-Age', '86400');
};

// Endpoint pour Server-Sent Events avec configuration CORS améliorée
router.get('/events', (req, res) => {
  // Configuration des headers CORS pour SSE
  setCORSHeaders(req, res);
  
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  };
  
  res.writeHead(200, headers);

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Fonction pour envoyer des événements au client avec gestion d'erreurs
  const sendEvent = (event, data) => {
    try {
      if (res.writableEnded || res.destroyed) {
        return false;
      }
      
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(message);
      return true;
    } catch (error) {
      syncManager.removeClient(clientId);
      return false;
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

  // Gérer la fermeture de connexion proprement
  const cleanup = () => {
    syncManager.removeClient(clientId);
    if (!res.writableEnded) {
      try {
        res.end();
      } catch (error) {
        // Connexion déjà fermée
      }
    }
  };

  req.on('close', cleanup);
  req.on('end', cleanup);
  req.on('error', cleanup);

  // Timeout de sécurité pour éviter les connexions fantômes
  const timeout = setTimeout(cleanup, 300000); // 5 minutes
  req.on('close', () => clearTimeout(timeout));
});

// Middleware OPTIONS pour préflight CORS sur SSE
router.options('/events', (req, res) => {
  setCORSHeaders(req, res);
  res.status(200).send();
});

// Endpoint pour forcer la synchronisation
router.post('/force-sync', authMiddleware, (req, res) => {
  try {
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
    
    res.json(status);
  } catch (error) {
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
