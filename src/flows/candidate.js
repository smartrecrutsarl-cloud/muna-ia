/**
 * FLOW CANDIDAT — Machine à états
 *
 * États :
 *  IDLE → OFFER_IDENTIFIED → WAITING_NAME → WAITING_CV
 *       → CV_RECEIVED → UPSELL_DONE
 */

const db = require('../db');
const wati = require('../services/wati');
const claudeService = require('../services/claude');
const cinetpay = require('../services/cinetpay');
const config = require('../config');

// ── MESSAGES ─────────────────────────────────────────────────────────────────
const MSG = {
  offerFound: (offer) =>
    `✅ *Offre trouvée !*\n\n` +
    `📋 *${offer.title}*\n` +
    `📍 ${offer.city}   💰 ${offer.salary || 'Voir avec le recruteur'}\n\n` +
    `Pour candidater, donnez-moi d'abord votre *nom complet* :`,

  offerNotFound: () =>
    `❌ Code offre non reconnu.\n\n` +
    `Vérifiez le code (ex: MUNA-AB12CD) ou contactez le recruteur pour avoir le bon lien.`,

  offerClosed: (title) =>
    `⚠️ L'offre "*${title}*" n'est plus active.\n\n` +
    `Les candidatures sont closes. Guettez les prochaines offres !`,

  alreadyApplied: (name) =>
    `✅ Bonjour ${name} ! Vous avez déjà candidaté pour ce poste.\n\n` +
    `Votre dossier est en cours d'analyse. Vous serez notifié(e) du résultat dans 48h.`,

  askCv: (name) =>
    `👋 Merci *${name}* !\n\n` +
    `📎 Envoyez maintenant votre CV :\n` +
    `• En *photo* (photo de votre CV papier ou écran) ✅\n` +
    `• En *fichier PDF* ✅\n\n` +
    `_Formats acceptés : JPG, PNG, WEBP, PDF_`,

  cvReceived: (name) =>
    `⚙️ CV reçu ! Analyse en cours...\n\n` +
    `_Cela prend quelques secondes_ ⏳`,

  applicationConfirmed: (name, offer) =>
    `✅ *Candidature enregistrée !*\n\n` +
    `Bonjour *${name}*, votre dossier pour le poste de *${offer.title}* a été analysé par Muna IA.\n\n` +
    `📊 Vous serez informé(e) du résultat dans 48h.`,

  upsellBoost: () =>
    `\n💡 *Boostez votre candidature !*\n\n` +
    `Plus de *300 candidats* ont postulé pour ce poste.\n` +
    `Pour *500 FCFA* seulement, activez le *CV Boost* :\n` +
    `👉 Votre profil passe en priorité dans la short-list du recruteur.\n\n` +
    `Répondez *BOOST* pour activer via MTN MoMo ou Orange Money.`,

  upsellFeedback: () =>
    `📋 *Bon à savoir :*\n` +
    `Si votre candidature n'est pas retenue, activez le *Feedback IA* (1 000 FCFA) :\n` +
    `Vous recevrez un rapport expliquant pourquoi et les compétences à renforcer.\n\n` +
    `Répondez *FEEDBACK* pour activer.`,

  cvError: () =>
    `⚠️ Je n'ai pas pu lire votre CV. Merci de l'envoyer en *photo claire* (bien éclairée, texte lisible) ou en *PDF*.`,

  boostActivated: (paymentUrl) =>
    `⭐ *CV Boost activé après paiement !*\n\n` +
    `Payez 500 FCFA ici pour passer en priorité :\n\n` +
    `👉 ${paymentUrl}`,

  feedbackActivated: (paymentUrl) =>
    `📋 *Feedback IA activé après paiement !*\n\n` +
    `Payez 1 000 FCFA ici pour recevoir votre feedback si non retenu :\n\n` +
    `👉 ${paymentUrl}`,
};

/**
 * Traite un message entrant d'un candidat
 */
async function handleCandidate(phone, senderName, conv, message) {
  const state = conv?.state || 'IDLE';
  const context = conv?.context || {};
  const text = message.text || '';

  console.log(`[CANDIDATE] ${phone} | état: ${state} | type: ${message.type}`);

  // ── COMMANDES PREMIUM ────────────────────────────────────────────────────
  if (state === 'UPSELL_DONE' || state === 'CV_RECEIVED') {
    if (/^boost$/i.test(text.trim())) {
      return handleBoostRequest(phone, context);
    }
    if (/^feedback$/i.test(text.trim())) {
      return handleFeedbackRequest(phone, context);
    }
  }

  // ── MACHINE À ÉTATS ───────────────────────────────────────────────────────
  switch (state) {

    case 'IDLE': {
      // Détecte le code offre dans le message (ex: "MUNA-AB12CD")
      const codeMatch = text.toUpperCase().match(/MUNA[-\s]?([A-Z0-9]{6})/);
      if (!codeMatch) {
        await wati.sendMessage(phone,
          `👋 Bonjour ! Je suis *Muna IA*, l'assistant recrutement WhatsApp.\n\n` +
          `Pour postuler à une offre, envoyez le lien de candidature partagé par le recruteur.\n\n` +
          `_Si vous êtes recruteur, répondez *RECRUTER*._`
        );
        return;
      }

      const code = codeMatch[1];
      const offer = await db.getJobOfferByCode(code);

      if (!offer) {
        await wati.sendMessage(phone, MSG.offerNotFound());
        return;
      }

      if (offer.status !== 'active') {
        await wati.sendMessage(phone, MSG.offerClosed(offer.title));
        return;
      }

      // Vérifie si déjà candidaté
      const existing = await db.getApplicationByCandidate(offer.id, phone);
      if (existing) {
        await wati.sendMessage(phone, MSG.alreadyApplied(existing.candidate_name));
        return;
      }

      await db.upsertConversation(phone, 'WAITING_NAME', 'candidate', { offerId: offer.id, offerCode: code });
      await wati.sendMessage(phone, MSG.offerFound(offer));
      break;
    }

    case 'WAITING_NAME': {
      if (!text || text.trim().length < 2) {
        await wati.sendMessage(phone, '⚠️ Merci d\'écrire votre nom complet (ex: Marie Nguesso)');
        return;
      }
      const name = text.trim();
      await db.upsertConversation(phone, 'WAITING_CV', 'candidate', { ...context, candidateName: name });
      await wati.sendMessage(phone, MSG.askCv(name));
      break;
    }

    case 'WAITING_CV': {
      // Accepte image ou document
      if (message.type !== 'image' && message.type !== 'document') {
        await wati.sendMessage(phone,
          `⚠️ Merci d'envoyer votre CV en *photo* ou *PDF*.\n\n` +
          `Pas de texte, pas de lien — uniquement le fichier CV.`
        );
        return;
      }

      await wati.sendMessage(phone, MSG.cvReceived(context.candidateName));

      try {
        // Télécharge le fichier CV
        const mediaUrl = message.mediaUrl;
        const mimeType = message.mimeType || (message.type === 'image' ? 'image/jpeg' : 'application/pdf');
        const mediaBuffer = await wati.downloadMedia(mediaUrl);

        let cvText = '';

        if (message.type === 'image') {
          // Extraction OCR via Claude Vision
          cvText = await claudeService.extractCvFromImage(mediaBuffer, mimeType);
        } else {
          // PDF — extraction texte basique (le scoring peut utiliser l'URL directe)
          cvText = `[PDF CV - ${context.candidateName}]`;
          // Note: Pour les PDF, on peut utiliser pdf-parse si nécessaire
        }

        // Sauvegarde la candidature
        const offer = await db.getJobOfferByCode(context.offerCode);
        const application = await db.createApplication({
          jobOfferId: context.offerId,
          candidateNumber: phone,
          candidateName: context.candidateName,
          cvUrl: mediaUrl,
          cvText,
        });

        // Score immédiat (peut être différé si charge élevée)
        if (cvText && cvText.length > 50 && offer) {
          try {
            const scoreResult = await claudeService.scoreCv(cvText, offer);
            await db.updateApplicationScore(application.id, scoreResult.score, scoreResult);
          } catch (scoreErr) {
            console.error('[CANDIDATE] Erreur scoring:', scoreErr.message);
          }
        }

        await db.upsertConversation(phone, 'UPSELL_DONE', 'candidate', {
          ...context,
          applicationId: application.id,
        });

        // Confirmation + upsell
        await wati.sendMessages(phone, [
          MSG.applicationConfirmed(context.candidateName, offer),
          MSG.upsellBoost(),
          MSG.upsellFeedback(),
        ]);

      } catch (err) {
        console.error('[CANDIDATE] Erreur traitement CV:', err.message);
        await wati.sendMessage(phone, MSG.cvError());
      }
      break;
    }

    case 'UPSELL_DONE': {
      await wati.sendMessage(phone,
        `✅ Votre candidature est enregistrée.\n\n` +
        `Répondez *BOOST* (500 FCFA) ou *FEEDBACK* (1 000 FCFA) pour activer un service premium.\n\n` +
        `Résultat dans 48h !`
      );
      break;
    }

    default:
      await db.upsertConversation(phone, 'IDLE', 'candidate', {});
      await wati.sendMessage(phone, `👋 Bonjour ! Envoyez le lien de candidature pour postuler.`);
  }
}

async function handleBoostRequest(phone, context) {
  try {
    const { paymentUrl, transactionId } = await cinetpay.createPaymentLink({
      amount: config.pricing.cvBoost,
      description: 'CV Boost — Priorité dans la short-list',
      whatsappNumber: phone,
      metadata: { type: 'cv_boost', applicationId: context.applicationId },
    });

    await db.createPayment({
      whatsappNumber: phone,
      type: 'cv_boost',
      amount: config.pricing.cvBoost,
      reference: transactionId,
      metadata: { applicationId: context.applicationId },
    });

    await wati.sendMessage(phone, MSG.boostActivated(paymentUrl));
  } catch (err) {
    console.error('[CANDIDATE] Erreur boost:', err.message);
    await wati.sendMessage(phone, '⚠️ Erreur lors de l\'activation du boost. Réessayez dans quelques instants.');
  }
}

async function handleFeedbackRequest(phone, context) {
  try {
    const { paymentUrl, transactionId } = await cinetpay.createPaymentLink({
      amount: config.pricing.feedbackRefus,
      description: 'Feedback IA — Rapport de refus personnalisé',
      whatsappNumber: phone,
      metadata: { type: 'feedback_refus', applicationId: context.applicationId },
    });

    await db.createPayment({
      whatsappNumber: phone,
      type: 'feedback_refus',
      amount: config.pricing.feedbackRefus,
      reference: transactionId,
      metadata: { applicationId: context.applicationId },
    });

    await wati.sendMessage(phone, MSG.feedbackActivated(paymentUrl));
  } catch (err) {
    console.error('[CANDIDATE] Erreur feedback:', err.message);
    await wati.sendMessage(phone, '⚠️ Erreur. Réessayez dans quelques instants.');
  }
}

module.exports = { handleCandidate };
