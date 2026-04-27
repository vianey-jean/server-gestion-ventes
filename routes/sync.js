/**
 * sync.js - Routes API pour la synchronisation en temps réel (SSE)
 * 
 * Gère les Server-Sent Events pour notifier les clients des changements de données.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const syncManager = require('../middleware/sync');
const authMiddleware = require('../middleware/auth');

// CORS is handled by the global cors() middleware in server.js.
// SSE endpoints only need to set SSE-specific headers.

// Endpoint pour Server-Sent Events avec configuration CORS améliorée
router.get('/events', (req, res) => {
  // Explicit CORS headers for SSE (belt-and-suspenders)
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);
  res.flushHeaders?.();

  // Keep TCP alive
  req.socket?.setKeepAlive?.(true, 15000);
  req.socket?.setNoDelay?.(true);

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

// OPTIONS preflight handled by global cors() middleware

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
    const fs = require('fs');
    const path = require('path');
    const dbPath = path.join(__dirname, '../db');
    
    // Retourner un hash réel du contenu JSON pour éviter de relancer le chrono
    // sur une simple synchronisation sans modification de données.
    const fileStats = {};
    const fileContentHashes = {};
    const dataChangeEntries = [];

    try {
      const files = fs.readdirSync(dbPath).filter(f => f.endsWith('.json'));
      files.forEach(file => {
        try {
          const filePath = path.join(dbPath, file);
          const stats = fs.statSync(filePath);
          const rawContent = fs.readFileSync(filePath, 'utf8');

          let normalizedContent = rawContent;
          try {
            normalizedContent = JSON.stringify(JSON.parse(rawContent));
          } catch {
            normalizedContent = rawContent;
          }

          const contentHash = crypto
            .createHash('sha256')
            .update(normalizedContent)
            .digest('hex');

          fileStats[file] = stats.mtimeMs;
          fileContentHashes[file] = contentHash;

          if (file !== 'settings.json') {
            dataChangeEntries.push(`${file}:${contentHash}`);
          }
        } catch {}
      });
    } catch {}

    const dataChangeToken = crypto
      .createHash('sha256')
      .update(dataChangeEntries.sort().join('|'))
      .digest('hex');

    res.json({
      clients: syncManager.clients.size,
      lastSync: new Date(),
      watchers: syncManager.watchers.size,
      isRunning: true,
      fileStats,
      fileContentHashes,
      dataChangeToken,
      autoBackupState: syncManager.getAutoBackupState(),
      sleepState: {
        isSleeping: syncManager.isSleeping,
        lastDataReceivedAt: syncManager.lastDataReceivedAt,
        idleTimeoutMs: syncManager.idleTimeoutMs,
        sleepsAt: new Date(syncManager.lastDataReceivedAt.getTime() + syncManager.idleTimeoutMs)
      }
    });
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
