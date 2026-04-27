
const fs = require('fs');
const path = require('path');
const { readDb } = require('./dbHelper');

class SyncManager {
  constructor() {
    this.watchers = new Map();
    this.autoBackupWatchers = new Map();
    this.clients = new Set();
    this.lastModified = new Map();
    this.autoBackupLastModified = new Map();
    this.lastSyncData = new Map();
    this.lastAutoBackupData = new Map();
    this.dbPath = path.join(__dirname, '../db');
    this.autoBackupReadyTimer = null;
    this.autoBackupStableWindowMs = 5 * 60 * 1000;
    this.autoBackupCountdownMs = 5 * 60 * 1000;

    // ===== Sleep/Awake logic (72h idle => sleep) =====
    this.idleTimeoutMs = 72 * 60 * 60 * 1000; // 72 hours
    this.idleTimer = null;
    this.isSleeping = false;
    this.lastDataReceivedAt = new Date();
    this._startIdleTimer();
    this.autoBackupState = {
      signal: false,
      activationId: null,
      lastChangeAt: null,
      lastChangedFile: null,
      readyAt: null,
      countdownStartedAt: null,
      lastBackupAt: null,
      lastBackupMode: null,
      reason: 'idle',
      version: 0
    };
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

  getDataType(filePath) {
    return path.basename(filePath, '.json');
  }

  readFileData(filePath, options = {}) {
    const { filterSalesForCurrentMonth = false } = options;
    const rawData = readDb(filePath) || [];
    const dataType = this.getDataType(filePath);

    if (filterSalesForCurrentMonth && dataType === 'sales') {
      return this.filterCurrentMonthSales(rawData);
    }

    return rawData;
  }

  hasCachedDataChanged(cache, cacheKey, newData) {
    const lastData = cache.get(cacheKey);
    const currentDataStr = JSON.stringify(newData);

    if (!lastData) {
      cache.set(cacheKey, currentDataStr);
      return true;
    }

    if (lastData !== currentDataStr) {
      cache.set(cacheKey, currentDataStr);
      return true;
    }

    return false;
  }

  // Vérifier si les données ont réellement changé
  hasDataChanged(filePath, newData) {
    const dataType = this.getDataType(filePath);
    return this.hasCachedDataChanged(this.lastSyncData, dataType, newData);
  }

  hasAutoBackupDataChanged(filePath, newData) {
    const dataType = this.getDataType(filePath);
    return this.hasCachedDataChanged(this.lastAutoBackupData, dataType, newData);
  }

  scheduleAutoBackupSignal() {
    if (this.autoBackupReadyTimer) {
      clearTimeout(this.autoBackupReadyTimer);
      this.autoBackupReadyTimer = null;
    }

    const referenceChangeAt = this.autoBackupState.lastChangeAt;

    this.autoBackupState.signal = false;
    this.autoBackupState.activationId = null;
    this.autoBackupState.countdownStartedAt = null;
    this.autoBackupState.readyAt = referenceChangeAt
      ? new Date(referenceChangeAt.getTime() + this.autoBackupStableWindowMs)
      : null;
    this.autoBackupState.reason = referenceChangeAt ? 'waiting_for_stability' : 'idle';
    this.autoBackupState.version += 1;

    if (!referenceChangeAt) {
      return;
    }

    this.autoBackupReadyTimer = setTimeout(() => {
      const latestChangeAt = this.autoBackupState.lastChangeAt;
      if (!latestChangeAt || latestChangeAt.getTime() !== referenceChangeAt.getTime()) {
        return;
      }

      const countdownStartedAt = new Date();

      this.autoBackupState.signal = true;
      this.autoBackupState.activationId = `auto_backup_${referenceChangeAt.getTime()}_${countdownStartedAt.getTime()}`;
      this.autoBackupState.countdownStartedAt = countdownStartedAt;
      this.autoBackupState.reason = 'countdown_active';
      this.autoBackupState.version += 1;

      this.notifyClients('auto-backup-state', this.getAutoBackupState());
    }, this.autoBackupStableWindowMs);
  }

  // ===== Sleep/Awake helpers =====
  _startIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.idleTimer = setTimeout(() => {
      this._enterSleep();
    }, this.idleTimeoutMs);
  }

  _enterSleep() {
    if (this.isSleeping) return;
    this.isSleeping = true;
    try {
      this.notifyClients('server-sleep', {
        timestamp: new Date(),
        lastDataReceivedAt: this.lastDataReceivedAt,
        idleTimeoutMs: this.idleTimeoutMs
      });
    } catch {}
  }

  wakeUp(reason = 'data') {
    const wasSleeping = this.isSleeping;
    this.isSleeping = false;
    this.lastDataReceivedAt = new Date();
    this._startIdleTimer();
    if (wasSleeping) {
      try {
        this.notifyClients('server-awake', {
          timestamp: this.lastDataReceivedAt,
          reason
        });
      } catch {}
    }
  }

  registerDataChange(filePath) {
    const dataType = this.getDataType(filePath);

    if (dataType === 'settings') {
      return;
    }

    const changedAt = new Date();

    // Wake up + reset 72h countdown on every real data change
    this.wakeUp('data-change');

    this.autoBackupState.lastChangeAt = changedAt;
    this.autoBackupState.lastChangedFile = dataType;
    this.autoBackupState.lastBackupMode = null;

    this.scheduleAutoBackupSignal();
    this.notifyClients('auto-backup-state', this.getAutoBackupState());
  }

  markBackupCompleted(mode = 'manual') {
    if (this.autoBackupReadyTimer) {
      clearTimeout(this.autoBackupReadyTimer);
      this.autoBackupReadyTimer = null;
    }

    this.autoBackupState.signal = false;
    this.autoBackupState.activationId = null;
    this.autoBackupState.readyAt = null;
    this.autoBackupState.countdownStartedAt = null;
    this.autoBackupState.lastBackupAt = new Date();
    this.autoBackupState.lastBackupMode = mode;
    this.autoBackupState.reason = 'backup_completed';
    this.autoBackupState.version += 1;

    this.notifyClients('auto-backup-state', this.getAutoBackupState());
  }

  getAutoBackupState() {
    return {
      signal: this.autoBackupState.signal,
      activationId: this.autoBackupState.activationId,
      lastChangeAt: this.autoBackupState.lastChangeAt ? this.autoBackupState.lastChangeAt.toISOString() : null,
      lastChangedFile: this.autoBackupState.lastChangedFile,
      readyAt: this.autoBackupState.readyAt ? this.autoBackupState.readyAt.toISOString() : null,
      countdownStartedAt: this.autoBackupState.countdownStartedAt ? this.autoBackupState.countdownStartedAt.toISOString() : null,
      lastBackupAt: this.autoBackupState.lastBackupAt ? this.autoBackupState.lastBackupAt.toISOString() : null,
      lastBackupMode: this.autoBackupState.lastBackupMode,
      stableWindowMs: this.autoBackupStableWindowMs,
      countdownDurationMs: this.autoBackupCountdownMs,
      reason: this.autoBackupState.reason,
      version: this.autoBackupState.version
    };
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
                const dataType = this.getDataType(filePath);
                
                // Filtrer les ventes pour le mois en cours, garder les autres données telles quelles
                const processedData = this.readFileData(filePath, { filterSalesForCurrentMonth: true });
                
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

  watchFileForAutoBackup(filePath) {
    if (this.autoBackupWatchers.has(filePath)) {
      return;
    }

    try {
      const watcher = fs.watch(filePath, { persistent: true }, (eventType) => {
        if (eventType === 'change') {
          setTimeout(() => {
            try {
              const stats = fs.statSync(filePath);
              const lastMod = this.autoBackupLastModified.get(filePath);

              if (!lastMod || stats.mtime > lastMod) {
                this.autoBackupLastModified.set(filePath, stats.mtime);

                const rawData = this.readFileData(filePath);

                if (this.hasAutoBackupDataChanged(filePath, rawData)) {
                  this.registerDataChange(filePath);
                }
              }
            } catch (error) {
              // Erreur silencieuse
            }
          }, 100);
        }
      });

      this.autoBackupWatchers.set(filePath, watcher);
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

  unwatchAutoBackupFile(filePath) {
    const watcher = this.autoBackupWatchers.get(filePath);

    if (watcher) {
      if (typeof watcher.close === 'function') {
        watcher.close();
      }
      this.autoBackupWatchers.delete(filePath);
    }
  }

  // Ajouter un client pour les notifications
  addClient(clientId, notifyCallback) {
    const client = { id: clientId, notify: notifyCallback, lastPing: Date.now() };
    this.clients.add(client);

    // Wake server immediately on new connection (e.g. user just logged in)
    // and reset 72h idle countdown so the user gets fresh data fast.
    this.wakeUp('client-connected');

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
      'nouvelle_achat.json',
      'clients.json',
      'messages.json',
      'rdv.json',
      'rdvNotifications.json',
      'remboursement.json'
    ];

    filesToWatch.forEach(fileName => {
      const filePath = path.join(this.dbPath, fileName);
      if (fs.existsSync(filePath)) {
        try {
          let data = this.readFileData(filePath, { filterSalesForCurrentMonth: true });
          const dataType = path.basename(filePath, '.json');
          
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
  'nouvelle_achat.json',
  'clients.json',
  'messages.json',
  'rdv.json',
  'rdvNotifications.json',
  'remboursement.json'
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

const autoBackupFilesToWatch = (() => {
  try {
    return fs.readdirSync(syncManager.dbPath).filter(fileName => fileName.endsWith('.json') && fileName !== 'settings.json');
  } catch {
    return [];
  }
})();

autoBackupFilesToWatch.forEach(fileName => {
  const filePath = path.join(syncManager.dbPath, fileName);
  if (fs.existsSync(filePath)) {
    syncManager.watchFileForAutoBackup(filePath);
  }
});

// Nettoyage à l'arrêt
process.on('SIGINT', () => {
  filesToWatch.forEach(fileName => {
    syncManager.unwatchFile(path.join(syncManager.dbPath, fileName));
  });
  autoBackupFilesToWatch.forEach(fileName => {
    syncManager.unwatchAutoBackupFile(path.join(syncManager.dbPath, fileName));
  });
  if (syncManager.autoBackupReadyTimer) {
    clearTimeout(syncManager.autoBackupReadyTimer);
  }
  if (syncManager.idleTimer) {
    clearTimeout(syncManager.idleTimer);
  }
  process.exit(0);
});

module.exports = syncManager;
