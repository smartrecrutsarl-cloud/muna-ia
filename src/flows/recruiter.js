/**
 * FLOW RECRUTEUR — Machine à états
 *
 * États :
 *  IDLE → WAITING_JOB_TITLE → WAITING_CITY → WAITING_SALARY
 *       → OFFER_ACTIVE → WAITING_PAYMENT → OFFER_COMPLETED
 */

const db = require('../db');
const wati = require('../services/wati');
const cinetpay = require('../services/cinetpay');
const config = require('../config');

// Messages du bot (en français camerounais naturel)
const MSG = {
  welcome: (name) =>
    `👋 Bonjour${name ? ` ${name}` : ''} ! Je suis *Muna IA*, votre assistant recrutement sur WhatsApp.\n\n` +
    `Je vous envoie les *5 meilleurs profils* en 48h.\n\n` +
    `Pour commencer : quel poste souhaitez-vous pourvoir ?`,

  askCity: (title) =>
    `✅ Poste enregistré : *${title}*\n\n📍 Dans quelle ville est basé ce poste ?`,

  askSalary: (city) =>
    `✅ Ville : *${city}*\n\n💰 Quelle est la rémunération proposée ?\n_(Ex: 80 000 FCFA, 120k-150k FCFA, Négociable)_`,

  offerCreated: (offer) => {
    const candidateLink = `https://wa.me/${config.app.munaWhatsapp}?text=MUNA-${offer.reference_code}`;
    return (
      `🎯 *Offre créée avec succès !*\n\n` +
      `📋 *${offer.title}* — ${offer.city}\n` +
      `💰 ${offer.salary}\n` +
      `🔑 Code : \`MUNA-${offer.reference_code}\`\n\n` +
      `📤 *Partagez ce lien dans vos groupes WhatsApp pour recevoir des candidatures :*\n` +
      `${candidateLink}\n\n` +
      `⏱ Dans *48 heures*, vous recevrez votre sélection des 5 meilleurs profils.\n` +
      `_Dépôt gratuit. Rapport PDF = 3 000 FCFA (payé uniquement si satisfait)_`
    );
  },

  paymentRequest: (offer, count, paymentUrl) =>
    `🏆 *Votre sélection est prête !*\n\n` +
    `📋 Offre : *${offer.title}* — ${offer.city}\n` +
    `👥 Candidatures reçues : *${count}*\n` +
    `🤖 Muna IA a analysé et classé tous les profils.\n\n` +
    `Pour recevoir votre *Top 5 en PDF*, réglez 3 000 FCFA :\n\n` +
    `👉 ${paymentUrl}\n\n` +
    `_(MTN MoMo ou Orange Money — paiement sécurisé)_`,

  reportSent: () =>
    `✅ *Paiement confirmé — Rapport envoyé !*\n\n` +
    `Merci d'avoir utilisé Muna IA 🤖\n\n` +
    `➕ Pour un nouvel abonnement (3 recrutements/mois à 15 000 FCFA), répondez *ABONNEMENT*.\n` +
    `🔄 Pour un nouveau recrutement, répondez *RECRUTER*.`,

  alreadyActive: (code) =>
    `⚠️ Vous avez déjà une offre active (code *MUNA-${code}*).\n\n` +
    `Elle collecte des candidatures. Résultat dans 48h.\n\n` +
    `Pour lancer un *nouveau recrutement*, répondez *NOUVEAU*.`,
};

/**
 * Traite un message entrant d'un recruteur
 * @param {string} phone - Numéro WhatsApp du recruteur
 * @param {string} senderName - Prénom envoyé par WATI
 * @param {object} conv - État de conversation actuel depuis DB
 * @param {string} text - Texte du message reçu
 */
async function handleRecruiter(phone, senderName, conv, text) {
  const state = conv?.state || 'IDLE';
  const context = conv?.context || {};

  console.log(`[RECRUITER] ${phone} | état: ${state} | msg: "${text.substring(0, 60)}"`);

  // ── COMMANDES GLOBALES ────────────────────────────────────────────────────
  if (/^(recruter|nouveau|reset)$/i.test(text.trim())) {
    await db.upsertConversation(phone, 'WAITING_JOB_TITLE', 'recruiter', {});
    await wati.sendMessage(phone,
      `🔄 Nouveau recrutement.\n\n` +
      `Quel poste souhaitez-vous pourvoir ?`
    );
    return;
  }

  if (/^abonnement$/i.test(text.trim())) {
    await wati.sendMessage(phone,
      `📦 *Abonnement Starter — 15 000 FCFA/mois*\n\n` +
      `✅ 3 recrutements inclus\n` +
      `✅ Rapport PDF illimité\n` +
      `✅ Support prioritaire\n\n` +
      `Répondez *OUI ABONNEMENT* pour procéder au paiement.`
    );
    return;
  }

  // ── MACHINE À ÉTATS ───────────────────────────────────────────────────────
  switch (state) {

    case 'IDLE': {
      // Vérifie si offre déjà active
      const activeOffer = await db.supabase
        .from('job_offers')
        .select('reference_code')
        .eq('recruiter_number', phone)
        .eq('status', 'active')
        .single();

      if (activeOffer.data) {
        await wati.sendMessage(phone, MSG.alreadyActive(activeOffer.data.reference_code));
        return;
      }

      await db.upsertConversation(phone, 'WAITING_JOB_TITLE', 'recruiter', {});
      await wati.sendMessage(phone, MSG.welcome(senderName));
      break;
    }

    case 'WAITING_JOB_TITLE': {
      if (!text || text.trim().length < 2) {
        await wati.sendMessage(phone, '⚠️ Merci de préciser le nom du poste (ex: Caissier, Comptable, Développeur…)');
        return;
      }
      const title = capitalizeFirst(text.trim());
      const newContext = { ...context, title };
      await db.upsertConversation(phone, 'WAITING_CITY', 'recruiter', newContext);
      await wati.sendMessage(phone, MSG.askCity(title));
      break;
    }

    case 'WAITING_CITY': {
      if (!text || text.trim().length < 2) {
        await wati.sendMessage(phone, '⚠️ Merci de préciser la ville (ex: Douala, Yaoundé, Bafoussam…)');
        return;
      }
      const city = capitalizeFirst(text.trim());
      const newContext = { ...context, city };
      await db.upsertConversation(phone, 'WAITING_SALARY', 'recruiter', newContext);
      await wati.sendMessage(phone, MSG.askSalary(city));
      break;
    }

    case 'WAITING_SALARY': {
      if (!text || text.trim().length < 2) {
        await wati.sendMessage(phone, '⚠️ Merci de préciser la rémunération (ex: 100 000 FCFA, Négociable…)');
        return;
      }
      const salary = text.trim();
      const newContext = { ...context, salary };

      // Crée l'offre en base
      const offer = await db.createJobOffer({
        recruiterNumber: phone,
        title: context.title,
        city: context.city,
        salary,
      });

      await db.upsertConversation(phone, 'OFFER_ACTIVE', 'recruiter', {
        ...newContext,
        offerId: offer.id,
        offerCode: offer.reference_code,
      });

      await wati.sendMessage(phone, MSG.offerCreated(offer));
      break;
    }

    case 'OFFER_ACTIVE': {
      // Le recruteur envoie un message pendant que l'offre est active
      await wati.sendMessage(phone,
        `📊 Votre offre *${context.title}* est active et collecte des candidatures.\n\n` +
        `🔑 Code : \`MUNA-${context.offerCode}\`\n\n` +
        `Vous recevrez votre Top 5 dans 48h.\n\n` +
        `_Pour lancer un nouveau recrutement : répondez *NOUVEAU*_`
      );
      break;
    }

    case 'WAITING_PAYMENT': {
      // Le recruteur répond alors qu'on attend le paiement — on renvoie le lien
      if (context.paymentUrl) {
        await wati.sendMessage(phone,
          `⏳ Votre rapport est prêt. Paiement en attente :\n\n👉 ${context.paymentUrl}`
        );
      }
      break;
    }

    case 'OFFER_COMPLETED': {
      await wati.sendMessage(phone,
        `✅ Votre dernier recrutement est terminé.\n\n` +
        `🔄 Pour un nouveau recrutement : répondez *RECRUTER*\n` +
        `📦 Abonnement mensuel : répondez *ABONNEMENT*`
      );
      break;
    }

    default:
      await db.upsertConversation(phone, 'IDLE', 'recruiter', {});
      await wati.sendMessage(phone, MSG.welcome(senderName));
  }
}

/**
 * Déclenche l'envoi du rapport après paiement confirmé
 * @param {string} recruiterPhone
 * @param {string} offerId
 */
async function sendReportAfterPayment(recruiterPhone, offerId) {
  const { generateTop5Report } = require('../services/pdf');
  const { scoreCv } = require('../services/claude');

  const offer = await db.getJobOfferById(offerId);
  const applications = await db.getApplicationsByOffer(offerId);
  const top5 = applications.slice(0, 5);

  // Génère le PDF
  const totalCount = applications.length;
  const top5WithMeta = top5.map(a => ({ ...a, totalCandidates: totalCount }));
  const pdfBuffer = await generateTop5Report(offer, top5WithMeta);

  // Envoie le PDF
  await wati.sendDocument(recruiterPhone, pdfBuffer, `muna_top5_${offer.reference_code}.pdf`);
  await wati.sendMessage(recruiterPhone, MSG.reportSent());

  // Met à jour l'état
  await db.upsertConversation(recruiterPhone, 'OFFER_COMPLETED', 'recruiter', {
    offerId,
    offerCode: offer.reference_code,
  });
  await db.updateJobOfferStatus(offerId, 'completed');
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { handleRecruiter, sendReportAfterPayment };
