
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// Initialize JSON files if they don't exist
const usersPath = path.join(dbPath, 'users.json');
if (!fs.existsSync(usersPath)) {
  fs.writeFileSync(usersPath, JSON.stringify([
    {
      id: "1",
      email: "demo@example.com",
      password: "Demo@123",
      firstName: "Demo",
      lastName: "User",
      gender: "male",
      address: "123 Demo Street",
      phone: "123-456-7890"
    }
  ], null, 2));
}

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

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);

// Static file serving for uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ error: 'Something broke!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
