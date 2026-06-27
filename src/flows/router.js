const db = require('../db');
const { handleRecruiter } = require('./recruiter');
const { handleCandidate } = require('./candidate');

/**
 * Route un message WhatsApp entrant vers le bon flow
 * Logique :
 *  1. Si conversation existante → utilise le rôle sauvegardé
 *  2. Si le texte contient un code MUNA-XXXXXX → flow candidat
 *  3. Si le texte contient un mot-clé recruteur → flow recruteur
 *  4. Sinon → message d'accueil avec choix
 */
async function routeMessage(phone, senderName, message) {
  const text = (message.text || '').trim();

  try {
    // Récupère la conversation existante
    let conv = await db.getConversation(phone);

    // ── Si la conversation existe et a un rôle, on continue dans ce flow ───
    if (conv && conv.role && conv.state !== 'IDLE' && conv.state !== 'OFFER_COMPLETED' && conv.state !== 'UPSELL_DONE') {
      if (conv.role === 'recruiter') {
        return await handleRecruiter(phone, senderName, conv, text);
      }
      if (conv.role === 'candidate') {
        return await handleCandidate(phone, senderName, conv, message);
      }
    }

    // ── Détection automatique du rôle depuis le texte ─────────────────────
    const textUp = text.toUpperCase();

    // Code candidat (MUNA-XXXXXX)
    if (/MUNA[-\s]?[A-Z0-9]{6}/i.test(text)) {
      conv = await db.upsertConversation(phone, 'IDLE', 'candidate', {});
      return await handleCandidate(phone, senderName, conv, message);
    }

    // Mots-clés recruteur
    if (/^(recruter|recruteur|recruter|publier|emploi|offre|job|poste|hjob)$/i.test(text)) {
      conv = await db.upsertConversation(phone, 'IDLE', 'recruiter', {});
      return await handleRecruiter(phone, senderName, conv, text);
    }

    // Mots-clés candidat
    if (/^(postuler|candidat|candidature|cv|cherche emploi)$/i.test(text)) {
      conv = await db.upsertConversation(phone, 'IDLE', 'candidate', {});
      return await handleCandidate(phone, senderName, conv, message);
    }

    // ── Message d'accueil si inconnu ──────────────────────────────────────
    const wati = require('../services/wati');
    await wati.sendMessage(phone,
      `👋 Bonjour${senderName ? ` *${senderName}*` : ''} ! Je suis *Muna IA* 🤖\n\n` +
      `L'assistant recrutement intelligent sur WhatsApp.\n\n` +
      `Vous êtes :\n` +
      `1️⃣ *Recruteur* — Publiez une offre, recevez les 5 meilleurs profils en 48h\n` +
      `2️⃣ *Candidat* — Postulez via le lien de recrutement\n\n` +
      `Tapez *RECRUTER* ou *POSTULER* pour commencer 👇`
    );

  } catch (err) {
    console.error(`[ROUTER] Erreur pour ${phone}:`, err.message, err.stack);
    // Ne jamais laisser le candidat sans réponse
    try {
      const wati = require('../services/wati');
      await wati.sendMessage(phone,
        `⚠️ Une erreur est survenue. Réessayez dans quelques instants ou contactez le support.`
      );
    } catch (_) {}
  }
}

module.exports = { routeMessage };
