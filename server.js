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

// Configuration CORS mise à jour
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000', 
      'http://localhost:8080',
      'https://4d7ac2d5-2cf0-40f0-b5f2-c401087b8839.lovableproject.com',
      'https://riziky-gestion-ventes.vercel.app'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed origins or is a lovableproject.com subdomain
    if (allowedOrigins.includes(origin) || origin.match(/^https:\/\/.*\.lovableproject\.com$/)) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Cache-Control',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Add error handling middleware for CORS
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    console.error('CORS Error for origin:', req.get('Origin'));
    res.status(403).json({ 
      error: 'CORS not allowed',
      origin: req.get('Origin'),
      allowedOrigins: [
        'http://localhost:5173',
        'https://*.lovableproject.com',
        'https://riziky-gestion-ventes.vercel.app'
      ]
    });
  } else {
    next(err);
  }
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
  fs.writeFileSync(pretFamillesPath, JSON.stringify([
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

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const pretFamillesRoutes = require('./routes/pretfamilles');
const pretProduitsRoutes = require('./routes/pretproduits');
const depensesRoutes = require('./routes/depenses');
const syncRoutes = require('./routes/sync');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/pretfamilles', pretFamillesRoutes);
app.use('/api/pretproduits', pretProduitsRoutes);
app.use('/api/depenses', depensesRoutes);
app.use('/api/sync', syncRoutes);

// Static file serving for uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    error: 'Something broke!', 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS enabled for Lovable domains`);
  console.log(`Sync events available at https://riziky-gestion-ventes.vercel.app:${PORT}/api/sync/events`);
});
