const express = require('express');
const router = express.Router();
const { routeMessage } = require('../flows/router');

/**
 * POST /webhook/wati
 * WATI envoie ici tous les messages WhatsApp entrants
 *
 * Structure du payload WATI :
 * {
 *   waId: "237691234567",
 *   senderName: "Jean Paul",
 *   text: "Bonjour",
 *   type: "text" | "image" | "document" | "audio",
 *   timestamp: "1234567890",
 *   data: { ... }
 * }
 */
router.post('/', async (req, res) => {
  // Répond immédiatement à WATI pour éviter les timeouts (< 3s)
  res.status(200).json({ status: 'ok' });

  try {
    const body = req.body;

    // Ignore les messages non entrants ou sans expéditeur
    if (!body.waId || body.eventType === 'SENT') return;

    const phone = body.waId;
    const senderName = body.senderName || '';
    const type = body.type || 'text';

    // Normalise le message dans un objet unifié
    const message = {
      type,
      text: '',
      mediaUrl: null,
      mimeType: null,
    };

    if (type === 'text') {
      message.text = body.text || body.data?.text?.body || '';
    } else if (type === 'image') {
      message.mediaUrl = body.data?.image?.url || body.mediaUrl;
      message.mimeType = body.data?.image?.mime_type || 'image/jpeg';
      message.text = body.caption || '';
    } else if (type === 'document') {
      message.mediaUrl = body.data?.document?.url || body.mediaUrl;
      message.mimeType = body.data?.document?.mime_type || 'application/pdf';
      message.text = body.caption || '';
    } else if (type === 'audio' || type === 'video') {
      // On ne traite pas les audios/vidéos pour l'instant
      const wati = require('../services/wati');
      await wati.sendMessage(phone,
        `⚠️ Je ne traite pas encore les messages audio/vidéo.\n` +
        `Merci d'envoyer votre CV en *photo* ou *PDF*.`
      );
      return;
    } else {
      // Type inconnu — traite comme texte
      message.text = body.text || '';
    }

    // Ignore les messages vides
    if (!message.text && !message.mediaUrl) return;

    console.log(`[WEBHOOK] Message de ${phone} (${senderName}) — type: ${type} — "${message.text.substring(0, 50)}"`);

    // Route vers le bon flow (async, ne bloque pas la réponse)
    await routeMessage(phone, senderName, message);

  } catch (err) {
    console.error('[WEBHOOK WATI] Erreur non gérée:', err.message);
  }
});

module.exports = router;
