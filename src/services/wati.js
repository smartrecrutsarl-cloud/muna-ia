const axios = require('axios');
const config = require('../config');

const client = axios.create({
  baseURL: config.wati.apiUrl,
  headers: {
    Authorization: `Bearer ${config.wati.apiToken}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/**
 * Envoie un message texte simple via WhatsApp
 * @param {string} phone - Numéro sans le "+"  ex: "237691234567"
 * @param {string} message - Texte à envoyer
 */
async function sendMessage(phone, message) {
  try {
    const res = await client.post(
      `/api/v1/sendSessionMessage/${phone}`,
      { messageText: message }
    );
    return res.data;
  } catch (err) {
    console.error(`[WATI] Erreur envoi vers ${phone}:`, err.response?.data || err.message);
    throw err;
  }
}

/**
 * Envoie plusieurs messages en séquence (avec délai pour paraître naturel)
 * @param {string} phone
 * @param {string[]} messages
 */
async function sendMessages(phone, messages) {
  for (let i = 0; i < messages.length; i++) {
    await sendMessage(phone, messages[i]);
    if (i < messages.length - 1) {
      await delay(800); // 800ms entre chaque message
    }
  }
}

/**
 * Envoie un fichier PDF (rapport Top 5)
 * @param {string} phone
 * @param {Buffer} pdfBuffer
 * @param {string} filename
 */
async function sendDocument(phone, pdfBuffer, filename) {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', pdfBuffer, {
      filename: filename || 'rapport_muna.pdf',
      contentType: 'application/pdf',
    });
    form.append('phone', phone);
    form.append('caption', '📄 Votre rapport Muna IA — Top 5 candidats');

    const res = await axios.post(
      `${config.wati.apiUrl}/api/v1/sendFile/${phone}`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${config.wati.apiToken}`,
        },
        timeout: 30000,
      }
    );
    return res.data;
  } catch (err) {
    console.error(`[WATI] Erreur envoi PDF vers ${phone}:`, err.response?.data || err.message);
    throw err;
  }
}

/**
 * Télécharge un media depuis l'URL WATI (CV photo ou PDF)
 * @param {string} mediaUrl
 * @returns {Buffer}
 */
async function downloadMedia(mediaUrl) {
  try {
    const res = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${config.wati.apiToken}` },
      timeout: 30000,
    });
    return Buffer.from(res.data);
  } catch (err) {
    console.error('[WATI] Erreur téléchargement media:', err.message);
    throw err;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { sendMessage, sendMessages, sendDocument, downloadMedia };
