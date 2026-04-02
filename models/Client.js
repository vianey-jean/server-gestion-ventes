
const fs = require('fs');
const path = require('path');

const clientsPath = path.join(__dirname, '../db/clients.json');

/**
 * Normalise un client pour s'assurer que phones est toujours un tableau.
 * Gère la rétrocompatibilité avec l'ancien champ "phone" (string).
 */
const normalizeClient = (client) => {
  if (!client) return client;
  // Migration: ancien format phone (string) → nouveau format phones (array)
  if (!client.phones && client.phone) {
    client.phones = [client.phone];
  }
  if (!client.phones) {
    client.phones = [];
  }
  // Garder phone comme alias du premier numéro pour rétrocompatibilité
  client.phone = client.phones[0] || '';
  return client;
};

const Client = {
  // Get all clients
  getAll: () => {
    try {
      const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
      return clients.map(normalizeClient);
    } catch (error) {
      console.error("Error reading clients:", error);
      return [];
    }
  },

  // Get client by ID
  getById: (id) => {
    try {
      const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
      const client = clients.find(client => client.id === id);
      return normalizeClient(client);
    } catch (error) {
      console.error("Error reading client by ID:", error);
      return null;
    }
  },

  // Get client by name
  getByName: (nom) => {
    try {
      const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
      const client = clients.find(client => client.nom.toLowerCase() === nom.toLowerCase());
      return normalizeClient(client);
    } catch (error) {
      console.error("Error reading client by name:", error);
      return null;
    }
  },

  // Create new client - accepte phones (array) ou phone (string)
  create: (clientData) => {
    try {
      const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
      
      // Check if client already exists
      const existingClient = clients.find(client => 
        client.nom.toLowerCase() === clientData.nom.toLowerCase()
      );
      
      if (existingClient) {
        return { error: 'Un client avec ce nom existe déjà' };
      }
      
      // Normaliser les phones
      let phones = [];
      if (clientData.phones && Array.isArray(clientData.phones)) {
        phones = clientData.phones.filter(p => p && p.trim());
      } else if (clientData.phone) {
        phones = [clientData.phone];
      }
      
      if (phones.length === 0) {
        return { error: 'Au moins un numéro de téléphone est requis' };
      }

      // Create new client object
      const newClient = {
        id: Date.now().toString(),
        nom: clientData.nom,
        phones: phones,
        phone: phones[0], // rétrocompatibilité
        adresse: clientData.adresse,
        photo: clientData.photo || '',
        dateCreation: new Date().toISOString()
      };
      
      // Add to clients array
      clients.push(newClient);
      
      // Write back to file
      fs.writeFileSync(clientsPath, JSON.stringify(clients, null, 2));
      
      return newClient;
    } catch (error) {
      console.error("Error creating client:", error);
      return null;
    }
  },

  // Update client
  update: (id, clientData) => {
    try {
      let clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
      
      // Find client index
      const clientIndex = clients.findIndex(client => client.id === id);
      if (clientIndex === -1) {
        return null;
      }
      
      // Check if another client with the same name exists (excluding current client)
      if (clientData.nom) {
        const existingClient = clients.find(client => 
          client.id !== id && client.nom.toLowerCase() === clientData.nom.toLowerCase()
        );
        
        if (existingClient) {
          return { error: 'Un autre client avec ce nom existe déjà' };
        }
      }
      
      const oldClient = clients[clientIndex];
      
      // Normaliser les phones
      let phones;
      if (clientData.phones && Array.isArray(clientData.phones)) {
        phones = clientData.phones.filter(p => p && p.trim());
      } else if (clientData.phone) {
        phones = [clientData.phone];
      } else {
        // Garder les anciens phones
        phones = normalizeClient(oldClient).phones;
      }

      // Update client data
      clients[clientIndex] = { 
        ...normalizeClient(oldClient), 
        nom: clientData.nom || oldClient.nom,
        phones: phones,
        phone: phones[0] || '', // rétrocompatibilité
        adresse: clientData.adresse || oldClient.adresse,
        photo: clientData.photo !== undefined ? clientData.photo : (oldClient.photo || '')
      };
      
      // Write back to file
      fs.writeFileSync(clientsPath, JSON.stringify(clients, null, 2));
      
      return clients[clientIndex];
    } catch (error) {
      console.error("Error updating client:", error);
      return null;
    }
  },

  // Delete client
  delete: (id) => {
    try {
      let clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
      
      // Find client
      const client = clients.find(c => c.id === id);
      if (!client) {
        return false;
      }

      // Delete associated photo if exists
      if (client.photo) {
        const photoPath = path.join(__dirname, '..', client.photo);
        if (fs.existsSync(photoPath)) {
          try { fs.unlinkSync(photoPath); } catch (e) { console.error('Error deleting client photo:', e); }
        }
      }
      
      // Remove from clients array
      clients = clients.filter(c => c.id !== id);
      
      // Write back to file
      fs.writeFileSync(clientsPath, JSON.stringify(clients, null, 2));
      
      return true;
    } catch (error) {
      console.error("Error deleting client:", error);
      return false;
    }
  }
};

module.exports = Client;
