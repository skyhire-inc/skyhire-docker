const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cvRoutes = require('./routes/cvRoutes');

// Configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/cv', cvRoutes);

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'CV Parser API is running',
    timestamp: new Date().toISOString()
  });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Une erreur est survenue',
    message: err.message 
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur demarre sur le port ${PORT}`);
  console.log(`API disponible sur http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
