
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

  // Obtenir le mois et l'année actuels
  getCurrentMonthYear() {
    const now = new Date();
    return {
      month: now.getMonth() + 1, // JavaScript months are 0-based
      year: now.getFullYear()
    };
  }

  // Filtrer les ventes pour le mois en cours seulement
  filterCurrentMonthSales(sales) {
    const { month, year } = this.getCurrentMonthYear();
    
    return sales.filter(sale => {
      const saleDate = new Date(sale.date);
      return (saleDate.getMonth() + 1) === month && saleDate.getFullYear() === year;
    });
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
      }, 100); // Poll toutes les 100ms pour une réactivité maximale
      
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
    
    // Envoyer les données actuelles immédiatement (seulement ventes du mois en cours)
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
    }, 30000);
    
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
          let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const dataType = path.basename(filePath, '.json');
          
          // Filtrer les ventes pour le mois en cours seulement
          if (dataType === 'sales') {
            data = this.filterCurrentMonthSales(data);
            console.log(`Envoi de ${data.length} ventes du mois en cours au client ${client.id}`);
          }
          
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
            let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Filtrer les ventes pour le mois en cours seulement
            if (dataType === 'sales') {
              data = this.filterCurrentMonthSales(data);
              console.log(`Synchronisation: ${data.length} ventes du mois en cours`);
            }
            
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
    }, 100); // Vérification toutes les 100ms pour une réactivité maximale
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
        let data = JSON.parse(fs.readFileSync(changedFile, 'utf8'));
        
        // Filtrer les ventes pour le mois en cours seulement
        if (dataType === 'sales') {
          data = syncManager.filterCurrentMonthSales(data);
          console.log(`Notification changement: ${data.length} ventes du mois en cours`);
        }
        
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
