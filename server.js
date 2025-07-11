const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 10000;

// Configuration CORS améliorée pour production et développement
const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origine (mobile apps, postman, etc.)
    if (!origin) return callback(null, true);
    
    // Liste des origines autorisées
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'https://lovable.dev',
      process.env.FRONTEND_URL,
      // Ajouter d'autres domaines selon vos besoins
    ].filter(Boolean);
    
    // En développement, autoriser toutes les origines localhost
    if (process.env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('lovable.dev')) {
        return callback(null, true);
      }
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS: Origine non autorisée:', origin);
      callback(null, true); // Temporairement permissif pour le développement
    }
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
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'Authorization'
  ],
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 heures
};

// Middleware CORS global avec gestion préflight
app.use(cors(corsOptions));

// Middleware pour gérer les requêtes preflight OPTIONS
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Max-Age', '86400');
  res.sendStatus(200);
});

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Middleware de logging pour debug CORS
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.headers.origin || 'no-origin'}`);
  next();
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

// Créer les nouveaux fichiers JSON s'ils n'existent pas
const pretFamillesPath = path.join(dbPath, 'pretfamilles.json');
if (!fs.existsSync(pretFamillesPath)) {
  fs.writeFileSync(pretfamillesPath, JSON.stringify([
    { id: "1", nom: "Famille Martin", pretTotal: 2000, soldeRestant: 1500, dernierRemboursement: 500, dateRemboursement: "2024-04-15" },
    { id: "2", nom: "Famille Dupont", pretTotal: 1000, soldeRestant: 500, dernierRemboursement: 200, dateRemboursement: "2024-04-10" },
    { id: "3", nom: "Famille Bernard", pretTotal: 3000, soldeRestant: 2000, dernierRemboursement: 1000, dateRemboursement: "2024-04-05" }
  ], null, 2));
}

const pretProduitsPath = path.join(dbPath, 'pretproduits.json');
if (!fs.existsSync(pretProduitsPath)) {
  fs.writeFileSync(pretProduitsPath, JSON.stringify([
    { id: "1", date: "2023-04-10", description: "Perruque Blonde", prixVente: 450, avanceRecue: 200, reste: 250, estPaye: false },
    { id: "2", date: "2023-04-15", description: "Perruque Brune", prixVente: 300, avanceRecue: 300, reste: 0, estPaye: true },
    { id: "3", date: "2023-04-20", description: "Perruque Rousse", prixVente: 500, avanceRecue: 250, reste: 250, estPaye: false }
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

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const pretFamillesRoutes = require('./routes/pretfamilles');
const pretProduitsRoutes = require('./routes/pretproduits');
const depensesRoutes = require('./routes/depenses');
const syncRoutes = require('./routes/sync');
const beneficesRoutes = require('./routes/benefices');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/pretfamilles', pretFamillesRoutes);
app.use('/api/pretproduits', pretProduitsRoutes);
app.use('/api/depenses', depensesRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/benefices', beneficesRoutes);

// Static file serving for uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware de gestion d'erreur amélioré
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  // Gestion CORS pour les erreurs
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  res.status(err.status || 500).json({ 
    error: 'Something broke!', 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 CORS enabled for development origins`);
  console.log(`🔄 Sync events available at http://localhost:${PORT}/api/sync/events`);
  console.log(`💻 Environment: ${process.env.NODE_ENV || 'development'}`);
});
