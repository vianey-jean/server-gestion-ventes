
const fs = require('fs');
const path = require('path');

class SyncManager {
  constructor() {
    this.watchers = new Map();
    this.clients = new Set();
    this.lastModified = new Map();
    this.lastSyncData = new Map();
    this.dbPath = path.join(__dirname, '../db');
  }

  // Obtenir le mois et l'année actuels
  getCurrentMonthYear() {
    const now = new Date();
    return {
      month: now.getMonth() + 1,
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

  // Vérifier si les données ont réellement changé
  hasDataChanged(filePath, newData) {
    const dataType = path.basename(filePath, '.json');
    const lastData = this.lastSyncData.get(dataType);
    
    if (!lastData) {
      this.lastSyncData.set(dataType, JSON.stringify(newData));
      return true;
    }
    
    const currentDataStr = JSON.stringify(newData);
    if (lastData !== currentDataStr) {
      this.lastSyncData.set(dataType, currentDataStr);
      return true;
    }
    
    return false;
  }

  // Surveiller les changements de fichiers avec détection de vrais changements
  watchFile(filePath, callback) {
    if (this.watchers.has(filePath)) {
      return;
    }

    try {
      const watcher = fs.watch(filePath, { persistent: true }, (eventType, filename) => {
        if (eventType === 'change') {
          setTimeout(() => {
            try {
              const stats = fs.statSync(filePath);
              const lastMod = this.lastModified.get(filePath);
              
              if (!lastMod || stats.mtime > lastMod) {
                this.lastModified.set(filePath, stats.mtime);
                
                // Lire et vérifier si les données ont vraiment changé
                const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const dataType = path.basename(filePath, '.json');
                
                // Filtrer les ventes pour le mois en cours, garder les autres données telles quelles
                let processedData = dataType === 'sales' ? this.filterCurrentMonthSales(rawData) : rawData;
                
                // Vérifier si les données ont réellement changé
                if (this.hasDataChanged(filePath, processedData)) {
                  callback(filePath, processedData);
                }
              }
            } catch (error) {
              // Erreur silencieuse
            }
          }, 100);
        }
      });

      this.watchers.set(filePath, watcher);
      
    } catch (error) {
      // Erreur silencieuse
    }
  }

  // Arrêter la surveillance
  unwatchFile(filePath) {
    const watcher = this.watchers.get(filePath);
    
    if (watcher) {
      if (typeof watcher.close === 'function') {
        watcher.close();
      }
      this.watchers.delete(filePath);
    }
  }

  // Ajouter un client pour les notifications
  addClient(clientId, notifyCallback) {
    const client = { id: clientId, notify: notifyCallback, lastPing: Date.now() };
    this.clients.add(client);
    
    // Envoyer les données actuelles immédiatement
    this.sendCurrentData(client);
    
    // Heartbeat pour maintenir la connexion
    const heartbeat = setInterval(() => {
      try {
        notifyCallback('heartbeat', { timestamp: Date.now() });
        client.lastPing = Date.now();
      } catch (error) {
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
      'depensefixe.json',
      'clients.json',
      'messages.json'
    ];

    filesToWatch.forEach(fileName => {
      const filePath = path.join(this.dbPath, fileName);
      if (fs.existsSync(filePath)) {
        try {
          let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const dataType = path.basename(filePath, '.json');
          
          if (dataType === 'sales') {
            data = this.filterCurrentMonthSales(data);
          }
          
          client.notify('data-changed', {
            type: dataType,
            data: data,
            timestamp: new Date(),
            file: filePath
          });
          
        } catch (error) {
          // Erreur silencieuse
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
        break;
      }
    }
  }

  // Notifier tous les clients avec données (seulement si changement réel)
  notifyClients(event, data) {
    const clientsToRemove = [];
    
    this.clients.forEach(client => {
      try {
        client.notify(event, data);
      } catch (error) {
        clientsToRemove.push(client.id);
      }
    });
    
    clientsToRemove.forEach(clientId => this.removeClient(clientId));
  }

  // Obtenir la dernière modification
  getLastModified(filePath) {
    return this.lastModified.get(filePath) || new Date(0);
  }
}

const syncManager = new SyncManager();

// Surveiller les fichiers de données (inclut maintenant messages.json)
const filesToWatch = [
  'products.json',
  'sales.json',
  'pretfamilles.json',
  'pretproduits.json',
  'depensedumois.json',
  'depensefixe.json',
  'clients.json',
  'messages.json'
];

filesToWatch.forEach(fileName => {
  const filePath = path.join(syncManager.dbPath, fileName);
  if (fs.existsSync(filePath)) {
    syncManager.watchFile(filePath, (changedFile, processedData) => {
      const dataType = path.basename(changedFile, '.json');
      
      // Notification immédiate avec données déjà traitées
      syncManager.notifyClients('data-changed', {
        type: dataType,
        data: processedData,
        timestamp: new Date(),
        file: changedFile
      });
    });
  }
});

// Nettoyage à l'arrêt
process.on('SIGINT', () => {
  process.exit(0);
});

module.exports = syncManager;
