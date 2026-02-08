/**
 * Schémas de validation pour les différentes routes
 */

// Schémas de validation pré-définis
const validationSchemas = {
  // Auth
  login: {
    email: { required: true, type: 'email' },
    password: { required: true, type: 'password' }
  },
  
  register: {
    email: { required: true, type: 'email' },
    password: { required: true, type: 'password' },
    confirmPassword: { required: true, type: 'password' },
    firstName: { required: true, type: 'text', maxLength: 100 },
    lastName: { required: true, type: 'text', maxLength: 100 },
    phone: { required: true, type: 'phone' },
    address: { required: true, type: 'text', maxLength: 500 },
    gender: { required: true, type: 'text', maxLength: 20 },
    acceptTerms: { required: true, type: 'boolean' }
  },
  
  resetPassword: {
    email: { required: true, type: 'email' },
    newPassword: { required: true, type: 'password' },
    confirmPassword: { required: true, type: 'password' }
  },
  
  // Products
  product: {
    description: { required: true, type: 'text', maxLength: 500 },
    purchasePrice: { required: true, type: 'number', min: 0, max: 10000000 },
    quantity: { required: true, type: 'number', min: 0, max: 1000000 }
  },
  
  // Sales
  sale: {
    productId: { required: true, type: 'text', maxLength: 50 },
    quantity: { required: true, type: 'number', min: 1, max: 10000 },
    salePrice: { required: true, type: 'number', min: 0, max: 10000000 }
  },
  
  // Clients
  client: {
    nom: { required: true, type: 'text', maxLength: 200 },
    phone: { required: false, type: 'phone' },
    adresse: { required: false, type: 'text', maxLength: 500 }
  },
  
  // Messages
  message: {
    content: { required: true, type: 'text', maxLength: 5000 },
    type: { required: false, type: 'text', maxLength: 50 }
  },
  
  // RDV
  rdv: {
    titre: { required: true, type: 'text', maxLength: 200 },
    date: { required: true, type: 'date' },
    clientId: { required: false, type: 'text', maxLength: 50 }
  },
  
  // Commandes
  commande: {
    clientId: { required: false, type: 'text', maxLength: 50 },
    clientNom: { required: true, type: 'text', maxLength: 200 },
    description: { required: true, type: 'text', maxLength: 1000 },
    montant: { required: true, type: 'number', min: 0, max: 10000000 }
  },
  
  // Depenses
  depense: {
    description: { required: true, type: 'text', maxLength: 500 },
    categorie: { required: true, type: 'text', maxLength: 100 },
    debit: { required: false, type: 'number', min: 0, max: 10000000 },
    credit: { required: false, type: 'number', min: 0, max: 10000000 }
  },
  
  // Pret Familles
  pretFamille: {
    nom: { required: true, type: 'text', maxLength: 200 },
    pretTotal: { required: true, type: 'number', min: 0, max: 100000000 },
    soldeRestant: { required: false, type: 'number', min: 0, max: 100000000 }
  },
  
  // Pret Produits
  pretProduit: {
    nom: { required: true, type: 'text', maxLength: 200 },
    phone: { required: false, type: 'phone' },
    description: { required: true, type: 'text', maxLength: 500 },
    prixVente: { required: true, type: 'number', min: 0, max: 10000000 },
    avanceRecue: { required: false, type: 'number', min: 0, max: 10000000 }
  }
};

module.exports = validationSchemas;
