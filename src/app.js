const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const watiWebhook = require('./routes/wati-webhook');
const cinetpayWebhook = require('./routes/cinetpay-webhook');
const dashboard = require('./routes/dashboard');
const kalara = require('./routes/kalara');

const app = express();

// ── Middlewares ────────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('[:date[iso]] :method :url :status :response-time ms'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Fichiers statiques (dashboard)
app.use(express.static(path.join(__dirname, '../public')));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/webhook/wati', watiWebhook);
app.use('/webhook/cinetpay', cinetpayWebhook);
app.use('/api/kalara', kalara);
app.use('/', dashboard);

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// ── Erreurs globales ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[APP ERROR]', err.message);
  res.status(500).json({ error: 'Erreur interne', message: err.message });
});

module.exports = app;
