const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const CINETPAY_API = 'https://api-checkout.cinetpay.com/v2/payment';

/**
 * Crée un lien de paiement Mobile Money (MTN / Orange)
 * @param {object} params
 * @param {number} params.amount - Montant en FCFA
 * @param {string} params.description - Description du paiement
 * @param {string} params.whatsappNumber - Numéro du payeur (pour référence)
 * @param {object} params.metadata - Données à retrouver dans le webhook
 * @returns {{ paymentUrl: string, transactionId: string }}
 */
async function createPaymentLink({ amount, description, whatsappNumber, metadata = {}, transactionId: forcedId, returnUrl, customerName }) {
  const transactionId = forcedId || `MUNA-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

  const payload = {
    apikey: config.cinetpay.apiKey,
    site_id: config.cinetpay.siteId,
    transaction_id: transactionId,
    amount,
    currency: 'XAF', // FCFA
    description,
    notify_url: config.cinetpay.notifyUrl,
    return_url: returnUrl || config.cinetpay.returnUrl,
    channels: 'MOBILE_MONEY', // MTN + Orange Money
    lang: 'fr',
    metadata: JSON.stringify({ whatsappNumber, ...metadata }),
    customer_name: customerName || 'Client Muna IA',
    customer_surname: '',
    customer_phone_number: whatsappNumber,
    customer_email: 'client@muna-ia.cm',
    customer_address: 'Cameroun',
    customer_city: 'Douala',
    customer_country: 'CM',
    customer_state: 'CM',
    customer_zip_code: '00237',
  };

  try {
    const response = await axios.post(CINETPAY_API, payload);
    const data = response.data;

    if (data.code !== '201') {
      throw new Error(`CinetPay erreur: ${data.message || JSON.stringify(data)}`);
    }

    return {
      paymentUrl: data.data.payment_url,
      transactionId,
    };
  } catch (err) {
    console.error('[CinetPay] Erreur création paiement:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Vérifie le statut d'une transaction auprès de CinetPay
 * @param {string} transactionId
 * @returns {'ACCEPTED' | 'REFUSED' | 'PENDING'}
 */
async function checkPaymentStatus(transactionId) {
  try {
    const response = await axios.post(
      'https://api-checkout.cinetpay.com/v2/payment/check',
      {
        apikey: config.cinetpay.apiKey,
        site_id: config.cinetpay.siteId,
        transaction_id: transactionId,
      }
    );
    return response.data?.data?.status || 'PENDING';
  } catch (err) {
    console.error('[CinetPay] Erreur vérification:', err.message);
    return 'PENDING';
  }
}

/**
 * Détails d'une transaction (statut, montant, devise) vérifiés auprès de CinetPay.
 * @param {string} transactionId
 * @returns {Promise<{ status: string, amount: number, currency: string } | null>}
 */
async function getPaymentDetails(transactionId) {
  try {
    const response = await axios.post('https://api-checkout.cinetpay.com/v2/payment/check', {
      apikey: config.cinetpay.apiKey,
      site_id: config.cinetpay.siteId,
      transaction_id: transactionId,
    });
    const d = response.data?.data;
    if (!d) return null;
    return { status: d.status || 'PENDING', amount: Number(d.amount) || 0, currency: d.currency || '' };
  } catch (err) {
    console.error('[CinetPay] Erreur vérification:', err.response?.data || err.message);
    return null;
  }
}

/**
 * Formate un message WhatsApp avec le lien de paiement
 * @param {string} paymentUrl
 * @param {number} amount
 * @param {string} description
 */
function formatPaymentMessage(paymentUrl, amount, description) {
  return `💳 *Paiement sécurisé — ${amount.toLocaleString('fr-FR')} FCFA*\n\n` +
    `📌 ${description}\n\n` +
    `👉 Cliquez ici pour payer via MTN MoMo ou Orange Money :\n` +
    `${paymentUrl}\n\n` +
    `✅ Votre rapport sera envoyé automatiquement dès confirmation du paiement.`;
}

module.exports = { createPaymentLink, checkPaymentStatus, getPaymentDetails, formatPaymentMessage };
