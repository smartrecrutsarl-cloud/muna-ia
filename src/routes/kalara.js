const express = require('express');
const config = require('../config');
const kalara = require('../services/kalara');

const router = express.Router();

// Limite simple par adresse IP (protège la restauration contre l'essai de codes au hasard).
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.path}|${req.ip}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, n: 1 });
      return next();
    }
    if (++entry.n > max) return res.status(429).json({ error: 'Trop de tentatives, réessayez dans une minute.' });
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.start > 10 * 60 * 1000) hits.delete(k);
}, 10 * 60 * 1000).unref();

/** Formules proposées (affichage côté application). */
router.get('/plans', (req, res) => {
  res.json(Object.entries(kalara.PLANS).map(([id, p]) => ({ id, amount: p.amount, days: p.days })));
});

/** POST /api/kalara/checkout { plan, phone } → { paymentUrl, transactionId } */
router.post('/checkout', rateLimit(10, 60 * 1000), async (req, res) => {
  try {
    res.json(await kalara.createCheckout({ plan: req.body?.plan, phone: req.body?.phone }));
  } catch (err) {
    console.error('[KALARA] checkout:', err.message);
    res.status(err.status || 502).json({ error: err.status ? err.message : 'Le service de paiement est indisponible, réessayez.' });
  }
});

/** Retour depuis la page CinetPay (GET ou POST) → l'application, qui vérifiera le paiement. */
router.all('/return', (req, res) => {
  const tx = String(req.query.tx || req.body?.transaction_id || '').replace(/[^A-Za-z0-9-]/g, '');
  res.redirect(303, `${config.kalara.appUrl}/?payment=${encodeURIComponent(tx)}`);
});

/** GET /api/kalara/license/:tx → { status: ACTIVE|PENDING|REFUSED|UNKNOWN, license?, code?, expiresAt? } */
router.get('/license/:tx', rateLimit(60, 60 * 1000), async (req, res) => {
  try {
    res.json(await kalara.activateFromPayment(req.params.tx));
  } catch (err) {
    console.error('[KALARA] license:', err.message);
    res.status(500).json({ error: 'Vérification impossible pour le moment.' });
  }
});

/** POST /api/kalara/restore { code } → licence si le code est valide et non expiré. */
router.post('/restore', rateLimit(8, 60 * 1000), async (req, res) => {
  try {
    res.json(await kalara.restore(req.body?.code));
  } catch (err) {
    console.error('[KALARA] restore:', err.message);
    res.status(500).json({ error: 'Restauration impossible pour le moment.' });
  }
});

module.exports = router;
