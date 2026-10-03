// Envoi WhatsApp facultatif (WATI). Sans configuration, les messages sont simplement ignorés.
const axios = require('axios');
const config = require('../config');

async function sendMessage(phone, message) {
  if (!config.wati.apiUrl || !config.wati.apiToken) return null;
  const res = await axios.post(
    `${config.wati.apiUrl}/api/v1/sendSessionMessage/${phone}`,
    { messageText: message },
    { headers: { Authorization: `Bearer ${config.wati.apiToken}` } },
  );
  return res.data;
}

module.exports = { sendMessage };
