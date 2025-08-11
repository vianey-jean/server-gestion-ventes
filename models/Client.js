
const fs = require('fs');
const path = require('path');

const clientsPath = path.join(__dirname, '../db/clients.json');

const Client = {
  // Get all clients
  getAll: () => {
    try {
      const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
      return clients;
    } catch (error) {
      console.error("Error reading clients:", error);
      return [];
    }
  },

  // Get client by ID
  getById: (id) => {
    try {
      const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
      return clients.find(client => client.id === id);
    } catch (error) {
      console.error("Error reading client by ID:", error);
      return null;
    }
  },

  // Get client by name
  getByName: (nom) => {
    try {
      const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
      return clients.find(client => client.nom.toLowerCase() === nom.toLowerCase());
    } catch (error) {
      console.error("Error reading client by name:", error);
      return null;
    }
  },

  // Create new client
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
      
      // Create new client object
      const newClient = {
        id: Date.now().toString(),
        nom: clientData.nom,
        phone: clientData.phone,
        adresse: clientData.adresse,
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
      const existingClient = clients.find(client => 
        client.id !== id && client.nom.toLowerCase() === clientData.nom.toLowerCase()
      );
      
      if (existingClient) {
        return { error: 'Un autre client avec ce nom existe déjà' };
      }
      
      const oldClient = clients[clientIndex];
      
      // Update client data
      clients[clientIndex] = { 
        ...oldClient, 
        nom: clientData.nom,
        phone: clientData.phone,
        adresse: clientData.adresse
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
      
      // Find client index
      const clientIndex = clients.findIndex(client => client.id === id);
      if (clientIndex === -1) {
        return false;
      }
      
      // Remove from clients array
      clients.splice(clientIndex, 1);
      
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
