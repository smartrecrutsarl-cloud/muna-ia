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

  // Kalara (lecteur audio) : abonnement Premium par pass Mobile Money
  kalara: {
    // Adresse publique de l'application (redirection après paiement)
    appUrl: (process.env.KALARA_APP_URL || 'https://lecteur-audio-muna.netlify.app').replace(/\/$/, ''),
    // Clé privée ECDSA P-256 (PEM) qui signe les licences ; « \n » accepté pour Railway
    licensePrivateKey: (process.env.KALARA_LICENSE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    plans: {
      week: { amount: 500, days: 7, label: 'Kalara Premium — pass 7 jours' },
      month: { amount: 1500, days: 30, label: 'Kalara Premium — pass 1 mois' },
      year: { amount: 12000, days: 365, label: 'Kalara Premium — pass 1 an' },
    },
  },

  // Délai avant scoring automatique (en millisecondes)
  scoringDelay: 48 * 60 * 60 * 1000, // 48 heures
};
