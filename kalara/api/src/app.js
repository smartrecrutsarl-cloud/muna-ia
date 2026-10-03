const express = require('express');
const cors = require('cors');
const kalara = require('./routes/kalara');
const cinetpayWebhook = require('./routes/cinetpay-webhook');

const app = express();
app.set('trust proxy', true); // derrière le proxy Railway : vraie IP pour la limite de requêtes
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'kalara-api' }));
app.use('/api/kalara', kalara);
app.use('/webhook/cinetpay', cinetpayWebhook);

app.use((req, res) => res.status(404).json({ error: 'Route non trouvée' }));
app.use((err, req, res, next) => {
  console.error('[APP ERROR]', err.message);
  res.status(500).json({ error: 'Erreur interne' });
});

module.exports = app;
