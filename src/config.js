require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },

  wati: {
    apiUrl: process.env.WATI_API_URL,
    apiToken: process.env.WATI_API_TOKEN,
    phoneNumber: process.env.WATI_PHONE_NUMBER,
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  cinetpay: {
    apiKey: process.env.CINETPAY_API_KEY,
    siteId: process.env.CINETPAY_SITE_ID,
    notifyUrl: process.env.CINETPAY_NOTIFY_URL,
    returnUrl: process.env.CINETPAY_RETURN_URL,
  },

  app: {
    url: process.env.APP_URL || 'http://localhost:3000',
    munaWhatsapp: process.env.MUNA_WHATSAPP,
  },

  // Tarifs (en FCFA)
  pricing: {
    rapportPdf: 3000,
    cvBoost: 500,
    feedbackRefus: 1000,
    reecritureCv: 1500,
    abonnementStarter: 15000,
  },

  // Délai avant scoring automatique (en millisecondes)
  scoringDelay: 48 * 60 * 60 * 1000, // 48 heures
};
