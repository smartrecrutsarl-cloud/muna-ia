const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');

// ── Dashboard HTML ─────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/dashboard.html'));
});

// ── API Stats ──────────────────────────────────────────────────────────────
router.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/api/offers', async (req, res) => {
  try {
    const offers = await db.getRecentOffers(30);
    res.json({ success: true, data: offers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/api/payments', async (req, res) => {
  try {
    const payments = await db.getRecentPayments(30);
    res.json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Muna IA', timestamp: new Date().toISOString() });
});

module.exports = router;
