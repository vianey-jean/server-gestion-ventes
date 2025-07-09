
const express = require('express');
const router = express.Router();
const syncManager = require('../middleware/sync');
const authMiddleware = require('../middleware/auth');

// Endpoint pour Server-Sent Events avec configuration CORS optimisée
router.get('/events', (req, res) => {
  console.log('Nouvelle connexion SSE demandée depuis:', req.get('Origin'));
  
  const origin = req.get('Origin');
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000', 
    'http://localhost:8080',
    'https://riziky-gestion-ventes.vercel.app',
    'https://server-gestion-ventes.onrender.com'
  ];
  
  // Vérifier si l'origine est autorisée - plus permissif pour les domaines Lovable
  const isAllowed = !origin || 
    allowedOrigins.includes(origin) || 
    origin.match(/^https:\/\/.*\.lovableproject\.com$/) ||
    origin.match(/^https:\/\/.*\.lovable\.app$/) ||
    origin.includes('lovable');
    
  if (!isAllowed) {
    console.log('CORS bloqué pour:', origin);
    return res.status(403).json({ error: 'Origin non autorisé' });
  }
  
  // Configuration SSE avec headers CORS optimisés
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Cache-Control, Authorization, Content-Type, X-Requested-With, Accept, Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
  
  res.writeHead(200, headers);

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`Client SSE connecté: ${clientId} depuis ${origin || 'unknown'}`);
  
  // Fonction pour envoyer des événements au client avec gestion d'erreurs
  const sendEvent = (event, data) => {
    try {
      if (res.writableEnded || res.destroyed) {
        console.log(`Connexion fermée pour ${clientId}, arrêt envoi événement`);
        return false;
      }
      
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(message);
      console.log(`Événement envoyé à ${clientId}:`, event, data.type || 'no-type');
      return true;
    } catch (error) {
      console.error(`Erreur envoi événement à ${clientId}:`, error);
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
    console.log(`Nettoyage connexion ${clientId}`);
    syncManager.removeClient(clientId);
    if (!res.writableEnded) {
      try {
        res.end();
      } catch (error) {
        console.log(`Connexion déjà fermée pour ${clientId}`);
      }
    }
  };

  req.on('close', () => {
    console.log(`Client ${clientId} déconnecté (close)`);
    cleanup();
  });

  req.on('end', () => {
    console.log(`Client ${clientId} déconnecté (end)`);
    cleanup();
  });

  req.on('error', (error) => {
    console.error(`Erreur client ${clientId}:`, error.code || error.message);
    cleanup();
  });

  // Timeout de sécurité pour éviter les connexions fantômes
  const timeout = setTimeout(() => {
    console.log(`Timeout connexion ${clientId}`);
    cleanup();
  }, 300000); // 5 minutes

  req.on('close', () => clearTimeout(timeout));
});

// Middleware OPTIONS pour préflight CORS sur SSE
router.options('/events', (req, res) => {
  const origin = req.get('Origin');
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Cache-Control, Authorization, Content-Type, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Max-Age', '86400');
  res.status(200).send();
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
