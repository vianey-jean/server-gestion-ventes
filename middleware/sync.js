
const fs = require('fs');
const path = require('path');

class SyncManager {
  constructor() {
    this.watchers = new Map();
    this.clients = new Set();
    this.lastModified = new Map();
    this.syncInterval = null;
    this.lastSyncData = new Map();
    this.dbPath = path.join(__dirname, '../db');
  }

  // Surveiller les changements de fichiers avec détection immédiate
  watchFile(filePath, callback) {
    if (this.watchers.has(filePath)) {
      return;
    }

    console.log(`Démarrage surveillance du fichier: ${filePath}`);

    try {
      // Surveillance immédiate avec fs.watch
      const watcher = fs.watch(filePath, { persistent: true }, (eventType, filename) => {
        if (eventType === 'change') {
          console.log(`Changement détecté dans ${filePath}`);
          
          // Petit délai pour éviter les lectures partielles
          setTimeout(() => {
            const stats = fs.statSync(filePath);
            const lastMod = this.lastModified.get(filePath);
            
            if (!lastMod || stats.mtime > lastMod) {
              this.lastModified.set(filePath, stats.mtime);
              callback(filePath);
            }
          }, 50);
        }
      });

      this.watchers.set(filePath, watcher);
      
      // Backup avec polling pour être sûr
      const pollWatcher = setInterval(() => {
        try {
          const stats = fs.statSync(filePath);
          const lastMod = this.lastModified.get(filePath) || new Date(0);
          
          if (stats.mtime > lastMod) {
            this.lastModified.set(filePath, stats.mtime);
            console.log(`Changement détecté par polling dans ${filePath}`);
            callback(filePath);
          }
        } catch (error) {
          console.error('Erreur polling:', error);
        }
      }, 1000); // Poll toutes les secondes
      
      this.watchers.set(filePath + '_poll', pollWatcher);
      
    } catch (error) {
      console.error('Erreur création watcher:', error);
    }
  }

  // Arrêter la surveillance
  unwatchFile(filePath) {
    const watcher = this.watchers.get(filePath);
    const pollWatcher = this.watchers.get(filePath + '_poll');
    
    if (watcher) {
      if (typeof watcher.close === 'function') {
        watcher.close();
      }
      this.watchers.delete(filePath);
    }
    
    if (pollWatcher) {
      clearInterval(pollWatcher);
      this.watchers.delete(filePath + '_poll');
    }
  }

  // Ajouter un client pour les notifications
  addClient(clientId, notifyCallback) {
    const client = { id: clientId, notify: notifyCallback, lastPing: Date.now() };
    this.clients.add(client);
    console.log(`Client SSE ajouté: ${clientId}, total: ${this.clients.size}`);
    
    // Envoyer les données actuelles immédiatement
    this.sendCurrentData(client);
    
    // Heartbeat pour maintenir la connexion
    const heartbeat = setInterval(() => {
      try {
        notifyCallback('heartbeat', { timestamp: Date.now() });
        client.lastPing = Date.now();
      } catch (error) {
        console.error('Client déconnecté:', clientId);
        this.removeClient(clientId);
        clearInterval(heartbeat);
      }
    }, 30000); // Heartbeat toutes les 30 secondes
    
    client.heartbeat = heartbeat;
  }

  // Envoyer les données actuelles à un client
  sendCurrentData(client) {
    const filesToWatch = [
      'products.json',
      'sales.json',
      'pretfamilles.json',
      'pretproduits.json',
      'depensedumois.json',
      'depensefixe.json'
    ];

    filesToWatch.forEach(fileName => {
      const filePath = path.join(this.dbPath, fileName);
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const dataType = path.basename(filePath, '.json');
          
          client.notify('data-changed', {
            type: dataType,
            data: data,
            timestamp: new Date(),
            file: filePath
          });
          
          console.log(`Données ${dataType} envoyées au client ${client.id}`);
        } catch (error) {
          console.error(`Erreur lecture ${fileName}:`, error);
        }
      }
    });
  }

  // Supprimer un client
  removeClient(clientId) {
    for (let client of this.clients) {
      if (client.id === clientId) {
        if (client.heartbeat) {
          clearInterval(client.heartbeat);
        }
        this.clients.delete(client);
        console.log(`Client SSE supprimé: ${clientId}, restants: ${this.clients.size}`);
        break;
      }
    }
  }

  // Notifier tous les clients avec données
  notifyClients(event, data) {
    console.log(`Notification à ${this.clients.size} clients:`, event, data.type);
    
    const clientsToRemove = [];
    
    this.clients.forEach(client => {
      try {
        client.notify(event, data);
      } catch (error) {
        console.error('Erreur notification client:', client.id, error);
        clientsToRemove.push(client.id);
      }
    });
    
    // Supprimer les clients déconnectés
    clientsToRemove.forEach(clientId => this.removeClient(clientId));
  }

  // Obtenir la dernière modification
  getLastModified(filePath) {
    return this.lastModified.get(filePath) || new Date(0);
  }
  
  // Démarrer la synchronisation périodique
  startPeriodicSync() {
    if (this.syncInterval) return;
    
    console.log('Démarrage synchronisation périodique');
    
    this.syncInterval = setInterval(() => {
      // Vérifier tous les fichiers surveillés
      for (let [filePath] of this.watchers) {
        if (filePath.endsWith('_poll')) continue;
        
        try {
          const stats = fs.statSync(filePath);
          const lastMod = this.lastModified.get(filePath) || new Date(0);
          
          if (stats.mtime > lastMod) {
            this.lastModified.set(filePath, stats.mtime);
            const dataType = path.basename(filePath, '.json');
            
            // Lire et envoyer les nouvelles données
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            this.notifyClients('data-changed', {
              type: dataType,
              data: data,
              timestamp: new Date(),
              file: filePath
            });
          }
        } catch (error) {
          console.error('Erreur sync périodique:', filePath, error);
        }
      }
    }, 1000); // Vérification toutes les secondes
  }
  
  // Arrêter la synchronisation périodique
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Synchronisation périodique arrêtée');
    }
  }
}

const syncManager = new SyncManager();

// Surveiller les fichiers de données
const filesToWatch = [
  'products.json',
  'sales.json',
  'pretfamilles.json',
  'pretproduits.json',
  'depensedumois.json',
  'depensefixe.json'
];

console.log('Initialisation des watchers de fichiers...');

filesToWatch.forEach(fileName => {
  const filePath = path.join(syncManager.dbPath, fileName);
  if (fs.existsSync(filePath)) {
    console.log(`Configuration surveillance: ${fileName}`);
    syncManager.watchFile(filePath, (changedFile) => {
      const dataType = path.basename(changedFile, '.json');
      console.log(`CHANGEMENT DÉTECTÉ: ${dataType}`);
      
      try {
        // Lire les nouvelles données
        const data = JSON.parse(fs.readFileSync(changedFile, 'utf8'));
        
        // Notification immédiate avec données
        syncManager.notifyClients('data-changed', {
          type: dataType,
          data: data,
          timestamp: new Date(),
          file: changedFile
        });
      } catch (error) {
        console.error(`Erreur lecture ${dataType}:`, error);
      }
    });
  } else {
    console.warn(`Fichier non trouvé: ${filePath}`);
  }
});

// Démarrer la synchronisation périodique
syncManager.startPeriodicSync();

// Nettoyage à l'arrêt
process.on('SIGINT', () => {
  console.log('Arrêt du gestionnaire de synchronisation...');
  syncManager.stopPeriodicSync();
  process.exit(0);
});

module.exports = syncManager;
