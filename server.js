/**
 * =============================================================================
 * Serveur Express - Point d'entrée principal
 * =============================================================================
 * 
 * Serveur API REST avec :
 * - Authentification JWT (8h expiration)
 * - Base de données JSON (fichiers dans server/db/)
 * - Synchronisation temps réel via SSE (/api/sync/events)
 * - Sécurité : rate limiting, sanitization, headers sécurisés
 * - CORS configuré pour Vercel et localhost
 * 
 * @module server
 * @version 4.2.0
 */

// Patch db I/O for transparent encryption — MUST be before any model imports
require('./middleware/patchDbIO');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const compression = require('compression');

// Middleware de sécurité
const {
  rateLimitMiddleware,
  sanitizeMiddleware,
  securityHeadersMiddleware,
  suspiciousActivityLogger
} = require('./middleware/security');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 10000;

// ===================
// SECURITY MIDDLEWARE
// ===================

// Compression pour performance
app.use(compression({
  filter: (req, res) => {
    if (req.path === '/api/sync/events' || req.path === '/api/messagerie/events') {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Security headers
app.use(securityHeadersMiddleware);

// ===================
// CORS (DOIT ÊTRE AVANT LE RATE LIMIT)
// ===================

// Configuration CORS avec toutes les origines autorisées
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:8081',
  'https://server-gestion-ventes.onrender.com',
  'https://riziky-gestion-ventes.vercel.app',
  'https://riziky-boutic.vercel.app',
  'https://sales-gestion-ventes.lovable.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permettre les requêtes sans origine (comme les apps mobiles ou curl)
    if (!origin) return callback(null, true);

    // Permettre toutes les origines Lovable preview
    if (origin.includes('lovable.app') || origin.includes('lovableproject.com')) {
      return callback(null, true);
    }

    // Permettre les origines dans la liste
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Par défaut, autoriser (évite les blocages preview)
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Last-Event-ID'
  ],
  exposedHeaders: ['Content-Type', 'Cache-Control'],
  optionsSuccessStatus: 200
};

// Middleware CORS global
app.use(cors(corsOptions));

// ===================
// RATE LIMIT (APRÈS CORS)
// ===================

// Ne pas bloquer SSE (connexion longue) avec le rate-limit global
app.use((req, res, next) => {
  if (req.path === '/api/sync/events' || req.path === '/api/messagerie/events') {
    return next();
  }
  return rateLimitMiddleware('general')(req, res, next);
});

// Détection d'activités suspectes
app.use(suspiciousActivityLogger);

// Body parsing avec limites de taille
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Sanitization de tous les inputs
// Skip pour payloads volumineux/chiffrés qui seraient tronqués par la sanitization
app.use((req, res, next) => {
  if (req.path === '/api/notes/upload-drawing' || req.path === '/api/settings/restore') {
    return next();
  }
  return sanitizeMiddleware(req, res, next);
});

// Create db directory if it doesn't exist
const dbPath = path.join(__dirname, 'db');
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath);
}

// Create uploads directory if it doesn't exist
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath);
}

// Hash a password
const hashPassword = (password) => {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
};

const productsPath = path.join(dbPath, 'products.json');
if (!fs.existsSync(productsPath)) {
  fs.writeFileSync(productsPath, JSON.stringify([
    {
      id: "1",
      description: "Laptop",
      purchasePrice: 500,
      quantity: 10
    },
    {
      id: "2",
      description: "Smartphone",
      purchasePrice: 300,
      quantity: 15
    },
    {
      id: "3",
      description: "Headphones",
      purchasePrice: 50,
      quantity: 30
    }
  ], null, 2));
}

const salesPath = path.join(dbPath, 'sales.json');
if (!fs.existsSync(salesPath)) {
  fs.writeFileSync(salesPath, JSON.stringify([], null, 2));
}

// Créer le fichier clients.json s'il n'existe pas
const clientsPath = path.join(dbPath, 'clients.json');
if (!fs.existsSync(clientsPath)) {
  fs.writeFileSync(clientsPath, JSON.stringify([
    {
      id: "1",
      nom: "Marie Dupont",
      phone: "0692123456",
      adresse: "123 Rue de la Paix, Saint-Denis",
      dateCreation: "2024-01-15T10:30:00.000Z"
    },
    {
      id: "2", 
      nom: "Jean Martin",
      phone: "0693987654",
      adresse: "45 Avenue des Palmiers, Saint-Paul",
      dateCreation: "2024-01-20T14:15:00.000Z"
    }
  ], null, 2));
}

// Créer les nouveaux fichiers JSON s'ils n'existent pas
const pretFamillesPath = path.join(dbPath, 'pretfamilles.json');
if (!fs.existsSync(pretFamillesPath)) {
  fs.writeFileSync(pretFamillesPath, JSON.stringify([
    { id: "1", nom: "Famille Martin", pretTotal: 2000, soldeRestant: 1500, dernierRemboursement: 500, dateRemboursement: "2024-04-15" },
    { id: "2", nom: "Famille Dupont", pretTotal: 1000, soldeRestant: 500, dernierRemboursement: 200, dateRemboursement: "2024-04-10" },
    { id: "3", nom: "Famille Bernard", pretTotal: 3000, soldeRestant: 2000, dernierRemboursement: 1000, dateRemboursement: "2024-04-05" }
  ], null, 2));
}

const pretProduitsPath = path.join(dbPath, 'pretproduits.json');
if (!fs.existsSync(pretProduitsPath)) {
  fs.writeFileSync(pretProduitsPath, JSON.stringify([
    { id: "1", nom: "Marie Dupont", phone: "0692123456", date: "2023-04-10", description: "Perruque Blonde", prixVente: 450, avanceRecue: 200, reste: 250, estPaye: false, dateProchaineVente: null },
    { id: "2", nom: "Jean Martin", phone: "0693987654", date: "2023-04-15", description: "Perruque Brune", prixVente: 300, avanceRecue: 300, reste: 0, estPaye: true, dateProchaineVente: null },
    { id: "3", nom: "Marie Dupont", phone: "0692123456", date: "2023-04-20", description: "Perruque Rousse", prixVente: 500, avanceRecue: 250, reste: 250, estPaye: false, dateProchaineVente: null }
  ], null, 2));
}

const depenseDuMoisPath = path.join(dbPath, 'depensedumois.json');
if (!fs.existsSync(depenseDuMoisPath)) {
  fs.writeFileSync(depenseDuMoisPath, JSON.stringify([
    { id: "1", date: "2023-04-05", description: "Salaire", categorie: "salaire", debit: 0, credit: 2000, solde: 2000 },
    { id: "2", date: "2023-04-10", description: "Courses Leclerc", categorie: "courses", debit: 150, credit: 0, solde: 1850 },
    { id: "3", date: "2023-04-15", description: "Restaurant", categorie: "restaurant", debit: 45, credit: 0, solde: 1805 },
    { id: "4", date: "2023-04-20", description: "Free Mobile", categorie: "free", debit: 19.99, credit: 0, solde: 1785.01 }
  ], null, 2));
}

const depenseFixePath = path.join(dbPath, 'depensefixe.json');
if (!fs.existsSync(depenseFixePath)) {
  fs.writeFileSync(depenseFixePath, JSON.stringify({
    free: 19.99,
    internetZeop: 39.99,
    assuranceVoiture: 85,
    autreDepense: 45,
    assuranceVie: 120,
    total: 309.98
  }, null, 2));
}

const beneficePath = path.join(dbPath, 'benefice.json');
if (!fs.existsSync(beneficePath)) {
  fs.writeFileSync(beneficePath, JSON.stringify([], null, 2));
}

const commandesPath = path.join(dbPath, 'commandes.json');
if (!fs.existsSync(commandesPath)) {
  fs.writeFileSync(commandesPath, JSON.stringify([], null, 2));
}

const remboursementPath = path.join(dbPath, 'remboursement.json');
if (!fs.existsSync(remboursementPath)) {
  fs.writeFileSync(remboursementPath, JSON.stringify([], null, 2));
}

// Garantit l'existence du fichier pointage automatique pour qu'il soit
// toujours inclus dans les sauvegardes/restaurations dynamiques.
const pointageAutoPath = path.join(dbPath, 'pointageauto.json');
if (!fs.existsSync(pointageAutoPath)) {
  fs.writeFileSync(pointageAutoPath, JSON.stringify([], null, 2));
}

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const clientRoutes = require('./routes/clients');
const pretFamillesRoutes = require('./routes/pretfamilles');
const pretProduitsRoutes = require('./routes/pretproduits');
const depensesRoutes = require('./routes/depenses');
const syncRoutes = require('./routes/sync');
const beneficesRoutes = require('./routes/benefices');
const messagesRoutes = require('./routes/messages');

const commandesRoutes = require('./routes/commandes');
const rdvRoutes = require('./routes/rdv');
const rdvNotificationsRoutes = require('./routes/rdvNotifications');
const objectifRoutes = require('./routes/objectif');
const nouvelleAchatRoutes = require('./routes/nouvelleAchat');
const comptaRoutes = require('./routes/compta');
const remboursementsRoutes = require('./routes/remboursements');
const fournisseursRoutes = require('./routes/fournisseurs');
const entrepriseRoutes = require('./routes/entreprise');
const pointageRoutes = require('./routes/pointage');
const pointageAutoRoutes = require('./routes/pointageAuto');
const travailleurRoutes = require('./routes/travailleur');
const tacheRoutes = require('./routes/tache');
const notesRoutes = require('./routes/notes');
const notesShareRoutes = require('./routes/notesShare');
const shareLinksRoutes = require('./routes/shareLinks');
const avanceRoutes = require('./routes/avance');
const profileRoutes = require('./routes/profile');
const messagerieRoutes = require('./routes/messagerie');
const settingsRoutes = require('./routes/settings');
const indisponibleRoutes = require('./routes/indisponible');
const moduleSettingsRoutes = require('./routes/moduleSettings');
const parametresRoutes = require('./routes/parametres');
const encryptionRoutes = require('./routes/encryption');
const shareCommentsRoutes = require('./routes/shareComments');
const productCommentsRoutes = require('./routes/productComments');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/pretfamilles', pretFamillesRoutes);
app.use('/api/pretproduits', pretProduitsRoutes);
app.use('/api/depenses', depensesRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/benefices', beneficesRoutes);
app.use('/api/messages', messagesRoutes);

app.use('/api/commandes', commandesRoutes);
app.use('/api/rdv', rdvRoutes);
app.use('/api/rdv-notifications', rdvNotificationsRoutes);
app.use('/api/objectif', objectifRoutes);
app.use('/api/nouvelle-achat', nouvelleAchatRoutes);
app.use('/api/compta', comptaRoutes);
app.use('/api/remboursements', remboursementsRoutes);
app.use('/api/fournisseurs', fournisseursRoutes);
app.use('/api/entreprises', entrepriseRoutes);
app.use('/api/pointages', pointageRoutes);
app.use('/api/pointages-auto', pointageAutoRoutes);
app.use('/api/travailleurs', travailleurRoutes);
app.use('/api/taches', tacheRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/notes-share', notesShareRoutes);
app.use('/api/share-links', shareLinksRoutes);
app.use('/api/avances', avanceRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/messagerie', messagerieRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/indisponible', indisponibleRoutes);
app.use('/api/module-settings', moduleSettingsRoutes);
app.use('/api/parametres', parametresRoutes);
app.use('/api/encryption', encryptionRoutes);
app.use('/api/share-comments', shareCommentsRoutes);
app.use('/api/product-comments', productCommentsRoutes);

// Static file serving for uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Error handling middleware avec sécurité
app.use((err, req, res, next) => {
  // Log l'erreur en interne
  console.error('Server error:', err.message);
  
  // Ne jamais exposer les stack traces en production
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(err.status || 500).json({ 
    error: 'Une erreur est survenue', 
    message: isProduction ? 'Erreur serveur interne' : err.message,
    ...(isProduction ? {} : { stack: err.stack })
  });
});

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', () => {
  console.log('SIGTERM reçu, arrêt gracieux...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('Exception non capturée:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesse rejetée non gérée:', reason);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔒 Security middleware enabled`);
  console.log(`📡 Sync events available at /api/sync/events`);
});
