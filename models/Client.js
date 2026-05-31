
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
  // Villes (par adresse) - même longueur que addresses
  if (!Array.isArray(client.villes)) client.villes = [];
  while (client.villes.length < client.addresses.length) client.villes.push('');
  if (client.villes.length > client.addresses.length) client.villes = client.villes.slice(0, client.addresses.length);
  // Ville (rétrocompatibilité = ville de l'adresse principale)
  if (typeof client.ville !== 'string') client.ville = client.ville || '';
  if (client.villes[0]) client.ville = client.villes[0];
  else if (client.ville) client.villes[0] = client.ville;
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

      // Villes (par adresse)
      let villes = [];
      if (Array.isArray(clientData.villes)) {
        villes = clientData.villes.map(v => (typeof v === 'string' ? v.trim() : ''));
      }
      while (villes.length < addresses.length) villes.push('');
      villes = villes.slice(0, addresses.length);
      if (!villes[0] && typeof clientData.ville === 'string' && clientData.ville.trim()) {
        villes[0] = clientData.ville.trim();
      }

      const newClient = {
        id: Date.now().toString(),
        nom: clientData.nom,
        phones,
        phone: phones[0],
        addresses,
        adresse: addresses[0],
        villes,
        ville: villes[0] || (typeof clientData.ville === 'string' ? clientData.ville.trim() : ''),
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

      // Villes (par adresse)
      let villes;
      if (Array.isArray(clientData.villes)) {
        villes = clientData.villes.map(v => (typeof v === 'string' ? v.trim() : ''));
      } else {
        villes = Array.isArray(oldClient.villes) ? [...oldClient.villes] : [];
      }
      while (villes.length < addresses.length) villes.push('');
      villes = villes.slice(0, addresses.length);
      // Si la ville scalaire est fournie, l'écrire en position 0
      if (clientData.ville !== undefined && typeof clientData.ville === 'string') {
        villes[0] = clientData.ville.trim();
      }

      clients[clientIndex] = {
        ...oldClient,
        nom: clientData.nom || oldClient.nom,
        phones,
        phone: phones[0] || '',
        addresses,
        adresse: addresses[0] || '',
        villes,
        ville: villes[0] || (clientData.ville !== undefined ? (typeof clientData.ville === 'string' ? clientData.ville.trim() : '') : (oldClient.ville || '')),
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
