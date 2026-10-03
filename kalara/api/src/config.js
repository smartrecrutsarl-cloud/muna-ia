require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,

  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },

  cinetpay: {
    apiKey: process.env.CINETPAY_API_KEY,
    siteId: process.env.CINETPAY_SITE_ID,
    // Notification de paiement : https://<cette-api>/webhook/cinetpay
    notifyUrl: process.env.CINETPAY_NOTIFY_URL,
    returnUrl: process.env.CINETPAY_RETURN_URL,
  },

  // Facultatif : envoi du code de restauration par WhatsApp (WATI)
  wati: {
    apiUrl: process.env.WATI_API_URL,
    apiToken: process.env.WATI_API_TOKEN,
  },

  app: {
    // Adresse publique de cette API (retour après paiement)
    url: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  },

  kalara: {
    // Adresse publique de l'application Kalara
    appUrl: (process.env.KALARA_APP_URL || 'https://lecteur-audio-muna.netlify.app').replace(/\/$/, ''),
    // Clé privée ECDSA P-256 (PEM) qui signe les licences ; « \n » accepté (variable sur une ligne)
    licensePrivateKey: (process.env.KALARA_LICENSE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    plans: {
      week: { amount: 500, days: 7, label: 'Kalara Premium — pass 7 jours' },
      month: { amount: 1500, days: 30, label: 'Kalara Premium — pass 1 mois' },
      year: { amount: 12000, days: 365, label: 'Kalara Premium — pass 1 an' },
    },
  },
};
