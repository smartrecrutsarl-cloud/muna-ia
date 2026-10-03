const express = require('express');
const { activateFromPayment } = require('../services/kalara');

const router = express.Router();

/**
 * POST /webhook/cinetpay — notification CinetPay.
 * On ne se fie pas à son contenu : l'activation vérifie le paiement auprès de CinetPay.
 */
router.post('/', async (req, res) => {
  res.status(200).send('OK'); // CinetPay attend une réponse immédiate
  const transactionId = req.body?.cpm_trans_id;
  if (!transactionId) return;
  try {
    const result = await activateFromPayment(String(transactionId));
    console.log(`[CINETPAY] ${transactionId} → ${result.status}`);
  } catch (err) {
    console.error('[CINETPAY] Erreur webhook:', err.message);
  }
});

module.exports = router;
