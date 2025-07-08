
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

    console.log(`Démarrage surveillance du fichier: ${filePath}`);

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
                
                // Filtrer les ventes pour le mois en cours
                let processedData = dataType === 'sales' ? this.filterCurrentMonthSales(rawData) : rawData;
                
                // Vérifier si les données ont réellement changé
                if (this.hasDataChanged(filePath, processedData)) {
                  console.log(`🔄 Changement détecté dans ${dataType} - Synchronisation nécessaire`);
                  callback(filePath, processedData);
                } else {
                  console.log(`⏭️ Pas de changement réel dans ${dataType} - Synchronisation ignorée`);
                }
              }
            } catch (error) {
              console.error('Erreur lors de la vérification des changements:', error);
            }
          }, 100);
        }
      });

      this.watchers.set(filePath, watcher);
      
    } catch (error) {
      console.error('Erreur création watcher:', error);
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

  // Notifier tous les clients avec données (seulement si changement réel)
  notifyClients(event, data) {
    console.log(`📡 Notification à ${this.clients.size} clients:`, event, data.type);
    
    const clientsToRemove = [];
    
    this.clients.forEach(client => {
      try {
        client.notify(event, data);
      } catch (error) {
        console.error('Erreur notification client:', client.id, error);
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

// Surveiller les fichiers de données
const filesToWatch = [
  'products.json',
  'sales.json',
  'pretfamilles.json',
  'pretproduits.json',
  'depensedumois.json',
  'depensefixe.json'
];

console.log('Initialisation des watchers de fichiers optimisés...');

filesToWatch.forEach(fileName => {
  const filePath = path.join(syncManager.dbPath, fileName);
  if (fs.existsSync(filePath)) {
    console.log(`Configuration surveillance: ${fileName}`);
    syncManager.watchFile(filePath, (changedFile, processedData) => {
      const dataType = path.basename(changedFile, '.json');
      console.log(`🔄 CHANGEMENT RÉEL DÉTECTÉ: ${dataType}`);
      
      // Notification immédiate avec données déjà traitées
      syncManager.notifyClients('data-changed', {
        type: dataType,
        data: processedData,
        timestamp: new Date(),
        file: changedFile
      });
    });
  } else {
    console.warn(`Fichier non trouvé: ${filePath}`);
  }
});

// Nettoyage à l'arrêt
process.on('SIGINT', () => {
  console.log('Arrêt du gestionnaire de synchronisation...');
  process.exit(0);
});

module.exports = syncManager;
