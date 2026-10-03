// CinetPay (Mobile Money : MTN MoMo, Orange Money) — création et vérification des paiements.
const axios = require('axios');
const config = require('../config');

const API = 'https://api-checkout.cinetpay.com/v2/payment';

/**
 * Crée un lien de paiement.
 * @returns {Promise<{ paymentUrl: string, transactionId: string }>}
 */
async function createPaymentLink({ transactionId, amount, description, whatsappNumber, metadata = {}, returnUrl, customerName = 'Client Kalara' }) {
  const payload = {
    apikey: config.cinetpay.apiKey,
    site_id: config.cinetpay.siteId,
    transaction_id: transactionId,
    amount,
    currency: 'XAF',
    description,
    notify_url: config.cinetpay.notifyUrl,
    return_url: returnUrl || config.cinetpay.returnUrl,
    channels: 'MOBILE_MONEY',
    lang: 'fr',
    metadata: JSON.stringify({ whatsappNumber, ...metadata }),
    customer_name: customerName,
    customer_surname: '',
    customer_phone_number: whatsappNumber,
    customer_email: 'client@kalara.app',
    customer_address: 'Cameroun',
    customer_city: 'Douala',
    customer_country: 'CM',
    customer_state: 'CM',
    customer_zip_code: '00237',
  };
  try {
    const { data } = await axios.post(API, payload);
    if (data.code !== '201') throw new Error(`CinetPay erreur: ${data.message || JSON.stringify(data)}`);
    return { paymentUrl: data.data.payment_url, transactionId };
  } catch (err) {
    console.error('[CinetPay] Erreur création paiement:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Détails d'une transaction (statut, montant, devise) vérifiés auprès de CinetPay.
 * @returns {Promise<{ status: string, amount: number, currency: string } | null>}
 */
async function getPaymentDetails(transactionId) {
  try {
    const { data } = await axios.post(`${API}/check`, {
      apikey: config.cinetpay.apiKey,
      site_id: config.cinetpay.siteId,
      transaction_id: transactionId,
    });
    const d = data?.data;
    if (!d) return null;
    return { status: d.status || 'PENDING', amount: Number(d.amount) || 0, currency: d.currency || '' };
  } catch (err) {
    console.error('[CinetPay] Erreur vérification:', err.response?.data || err.message);
    return null;
  }
}

module.exports = { createPaymentLink, getPaymentDetails };
