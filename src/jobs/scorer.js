const cron = require('node-cron');
const db = require('../db');
const wati = require('../services/wati');
const claudeService = require('../services/claude');
const cinetpay = require('../services/cinetpay');
const config = require('../config');

/**
 * JOB PRINCIPAL : Score les candidatures et envoie le lien de paiement
 * Tourne toutes les 30 minutes
 * Cible : offres actives créées il y a 48h+ avec au moins 1 candidature
 */
async function runScoringJob() {
  console.log('[JOB] Vérification des offres prêtes à scorer...');

  try {
    const offers = await db.getOffersReadyToScore();
    console.log(`[JOB] ${offers.length} offre(s) prête(s)`);

    for (const offer of offers) {
      try {
        await processOfferScoring(offer);
      } catch (err) {
        console.error(`[JOB] Erreur sur offre ${offer.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[JOB] Erreur globale:', err.message);
  }
}

async function processOfferScoring(offer) {
  console.log(`[JOB] Traitement offre ${offer.reference_code} — "${offer.title}"`);

  // Passe l'offre en statut "scoring" pour éviter double traitement
  await db.updateJobOfferStatus(offer.id, 'scoring');

  // Récupère toutes les candidatures
  const applications = await db.getApplicationsByOffer(offer.id);
  console.log(`[JOB] ${applications.length} candidature(s) pour ${offer.reference_code}`);

  if (applications.length === 0) {
    await db.updateJobOfferStatus(offer.id, 'completed');
    await wati.sendMessage(offer.recruiter_number,
      `⚠️ Aucune candidature reçue pour votre offre *${offer.title}*.\n\n` +
      `Votre offre est maintenant fermée. Pour relancer, répondez *RECRUTER*.`
    );
    return;
  }

  // Score les candidatures qui n'ont pas encore de score
  for (const app of applications) {
    if (app.score !== null && app.score !== undefined) continue;
    if (!app.cv_text || app.cv_text.length < 30) continue;

    try {
      const scoreResult = await claudeService.scoreCv(app.cv_text, offer);
      await db.updateApplicationScore(app.id, scoreResult.score, scoreResult);
      console.log(`[JOB] Scoré: ${app.candidate_name} → ${scoreResult.score}/100`);
    } catch (err) {
      console.error(`[JOB] Erreur scoring candidature ${app.id}:`, err.message);
      // Score par défaut si l'IA échoue
      await db.updateApplicationScore(app.id, 0, { error: err.message });
    }
  }

  // Récupère la liste scorée et triée
  const scoredApps = await db.getApplicationsByOffer(offer.id);
  const top5 = scoredApps
    .filter(a => a.score !== null)
    .sort((a, b) => {
      // Les boostés remontent en priorité (à score égal)
      const aScore = a.score + (a.services?.boost ? 5 : 0);
      const bScore = b.score + (b.services?.boost ? 5 : 0);
      return bScore - aScore;
    })
    .slice(0, 5);

  console.log(`[JOB] Top 5 sélectionné pour ${offer.reference_code}`);

  // Envoie une synthèse texte rapide + lien de paiement au recruteur
  const summaryLines = top5.map((app, i) => {
    const score = app.score || 0;
    const emoji = score >= 70 ? '🟢' : score >= 50 ? '🟡' : '🔴';
    return `${i + 1}. ${app.candidate_name} — ${emoji} ${score}/100`;
  }).join('\n');

  // Crée le lien de paiement pour le rapport PDF
  let paymentUrl = '';
  try {
    const { paymentUrl: url, transactionId } = await cinetpay.createPaymentLink({
      amount: config.pricing.rapportPdf,
      description: `Rapport Top 5 — ${offer.title}`,
      whatsappNumber: offer.recruiter_number,
      metadata: {
        type: 'rapport_pdf',
        offerId: offer.id,
        whatsappNumber: offer.recruiter_number,
      },
    });

    paymentUrl = url;

    await db.createPayment({
      whatsappNumber: offer.recruiter_number,
      type: 'rapport_pdf',
      amount: config.pricing.rapportPdf,
      reference: transactionId,
      metadata: { offerId: offer.id },
    });
  } catch (payErr) {
    console.error('[JOB] Erreur création lien paiement:', payErr.message);
  }

  // Message récapitulatif au recruteur
  const message =
    `🏆 *Sélection Muna IA prête !*\n\n` +
    `📋 *${offer.title}* — ${offer.city}\n` +
    `👥 *${scoredApps.length}* candidature(s) analysée(s)\n\n` +
    `*Aperçu Top 5 :*\n${summaryLines}\n\n` +
    (paymentUrl
      ? `📄 Pour recevoir le rapport PDF complet (profils détaillés + analyse IA) :\n\n` +
        `💳 Payez *3 000 FCFA* ici :\n${paymentUrl}\n\n` +
        `_(MTN MoMo ou Orange Money — paiement sécurisé)_`
      : `Contactez le support pour recevoir votre rapport.`);

  await wati.sendMessage(offer.recruiter_number, message);

  // Mise à jour état conversation recruteur
  const conv = await db.getConversation(offer.recruiter_number);
  await db.upsertConversation(offer.recruiter_number, 'WAITING_PAYMENT', 'recruiter', {
    ...(conv?.context || {}),
    offerId: offer.id,
    paymentUrl,
  });

  // Envoie les feedbacks aux candidats non retenus qui ont payé
  await sendFeedbacksToRejected(scoredApps, top5, offer);

  console.log(`[JOB] ✅ Offre ${offer.reference_code} traitée`);
}

async function sendFeedbacksToRejected(allApps, top5, offer) {
  const top5Ids = new Set(top5.map(a => a.id));
  const rejected = allApps.filter(a => !top5Ids.has(a.id) && a.services?.feedbackPaid);

  for (const app of rejected) {
    try {
      const feedback = await claudeService.generateFeedback(
        app.cv_text || '',
        offer,
        app.score_details || { score: app.score, points_faibles: [] }
      );
      await wati.sendMessage(app.candidate_number, feedback);
      await db.updateApplicationService(app.id, 'feedbackSent', true);
    } catch (err) {
      console.error(`[JOB] Erreur feedback candidat ${app.candidate_number}:`, err.message);
    }
  }
}

/**
 * Démarre le scheduler
 * Tourne toutes les 30 minutes
 */
function startScheduler() {
  console.log('[SCHEDULER] Démarrage — vérification toutes les 30 min');

  // Toutes les 30 minutes
  cron.schedule('*/30 * * * *', runScoringJob);

  // Lancement immédiat au démarrage (utile pour les tests)
  if (config.nodeEnv !== 'production') {
    setTimeout(runScoringJob, 5000);
  }
}

module.exports = { startScheduler, runScoringJob };
