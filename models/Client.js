
const fs = require('fs');
const path = require('path');

const clientsPath = path.join(__dirname, '../db/clients.json');

const getClientPhotoFilePath = (photoUrl) => {
  if (!photoUrl) return null;
  return path.join(__dirname, '..', photoUrl.replace(/^\/+/, ''));
};

/**
 * Normalise un client pour s'assurer que phones/addresses sont toujours des tableaux.
 * Gère la rétrocompatibilité avec les anciens champs "phone" / "adresse" (string).
 */
const normalizeClient = (client) => {
  if (!client) return client;
  // Phones
  if (!client.phones && client.phone) client.phones = [client.phone];
  if (!client.phones) client.phones = [];
  client.phone = client.phones[0] || '';
  // Addresses
  if (!client.addresses && client.adresse) client.addresses = [client.adresse];
  if (!client.addresses) client.addresses = client.adresse ? [client.adresse] : [];
  client.adresse = client.addresses[0] || client.adresse || '';
  return client;
};

const Client = {
  getAll: () => {
    try {
      const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
      return clients.map(normalizeClient);
    } catch (error) {
      console.error("Error reading clients:", error);
      return [];
    }
  },

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

  create: (clientData) => {
    try {
      const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));

      const existingClient = clients.find(client =>
        client.nom.toLowerCase() === clientData.nom.toLowerCase()
      );
      if (existingClient) {
        return { error: 'Un client avec ce nom existe déjà' };
      }

      // Phones
      let phones = [];
      if (clientData.phones && Array.isArray(clientData.phones)) {
        phones = clientData.phones.filter(p => p && p.trim());
      } else if (clientData.phone) {
        phones = [clientData.phone];
      }
      if (phones.length === 0) {
        return { error: 'Au moins un numéro de téléphone est requis' };
      }

      // Addresses
      let addresses = [];
      if (clientData.addresses && Array.isArray(clientData.addresses)) {
        addresses = clientData.addresses.filter(a => a && a.trim());
      } else if (clientData.adresse) {
        addresses = [clientData.adresse];
      }
      if (addresses.length === 0) {
        return { error: 'Au moins une adresse est requise' };
      }

      const newClient = {
        id: Date.now().toString(),
        nom: clientData.nom,
        phones,
        phone: phones[0],
        addresses,
        adresse: addresses[0],
        photo: clientData.photo || '',
        dateCreation: new Date().toISOString()
      };

      clients.push(newClient);
      fs.writeFileSync(clientsPath, JSON.stringify(clients, null, 2));
      return newClient;
    } catch (error) {
      console.error("Error creating client:", error);
      return null;
    }
  },

  update: (id, clientData) => {
    try {
      let clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
      const clientIndex = clients.findIndex(client => client.id === id);
      if (clientIndex === -1) return null;

      if (clientData.nom) {
        const existingClient = clients.find(client =>
          client.id !== id && client.nom.toLowerCase() === clientData.nom.toLowerCase()
        );
        if (existingClient) return { error: 'Un autre client avec ce nom existe déjà' };
      }

      const oldClient = normalizeClient(clients[clientIndex]);

      // Phones
      let phones;
      if (clientData.phones && Array.isArray(clientData.phones)) {
        phones = clientData.phones.filter(p => p && p.trim());
      } else if (clientData.phone) {
        phones = [clientData.phone];
      } else {
        phones = oldClient.phones;
      }

      // Addresses
      let addresses;
      if (clientData.addresses && Array.isArray(clientData.addresses)) {
        addresses = clientData.addresses.filter(a => a && a.trim());
      } else if (clientData.adresse) {
        addresses = [clientData.adresse];
      } else {
        addresses = oldClient.addresses;
      }

      clients[clientIndex] = {
        ...oldClient,
        nom: clientData.nom || oldClient.nom,
        phones,
        phone: phones[0] || '',
        addresses,
        adresse: addresses[0] || '',
        photo: clientData.photo !== undefined ? clientData.photo : (oldClient.photo || '')
      };

      fs.writeFileSync(clientsPath, JSON.stringify(clients, null, 2));
      return clients[clientIndex];
    } catch (error) {
      console.error("Error updating client:", error);
      return null;
    }
  },

  delete: (id) => {
    try {
      let clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
      const client = clients.find(c => c.id === id);
      if (!client) return false;

      if (client.photo) {
        const photoPath = getClientPhotoFilePath(client.photo);
        if (fs.existsSync(photoPath)) {
          try { fs.unlinkSync(photoPath); } catch (e) { console.error('Error deleting client photo:', e); }
        }
      }

      clients = clients.filter(c => c.id !== id);
      fs.writeFileSync(clientsPath, JSON.stringify(clients, null, 2));
      return true;
    } catch (error) {
      console.error("Error deleting client:", error);
      return false;
    }
  }
};

module.exports = Client;
