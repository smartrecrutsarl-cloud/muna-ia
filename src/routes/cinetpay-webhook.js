const express = require('express');
const router = express.Router();
const db = require('../db');
const wati = require('../services/wati');
const { sendReportAfterPayment } = require('../flows/recruiter');

/**
 * POST /webhook/cinetpay
 * CinetPay appelle cette URL quand un paiement est confirmé
 *
 * Payload CinetPay :
 * {
 *   cpm_trans_id: "MUNA-1234567-ABCD",
 *   cpm_site_id: "XXXXXXXX",
 *   cpm_result: "00",          // "00" = succès
 *   cpm_trans_status: "ACCEPTED",
 *   cpm_amount: "3000",
 *   cpm_custom: "..." (notre metadata JSON)
 * }
 */
router.post('/', async (req, res) => {
  // CinetPay attend un 200 immédiat
  res.status(200).send('OK');

  try {
    const body = req.body;
    const transactionId = body.cpm_trans_id;
    const status = body.cpm_trans_status;
    const result = body.cpm_result;

    console.log(`[CINETPAY] Transaction ${transactionId} — Status: ${status}`);

    // Seuls les paiements acceptés sont traités
    if (status !== 'ACCEPTED' || result !== '00') {
      console.log(`[CINETPAY] Paiement refusé ou en attente : ${status}`);
      return;
    }

    // Récupère les métadonnées du paiement
    let metadata = {};
    try {
      metadata = JSON.parse(body.cpm_custom || '{}');
    } catch {
      console.error('[CINETPAY] Impossible de parser cpm_custom:', body.cpm_custom);
    }

    const { whatsappNumber, type } = metadata;

    // Confirme le paiement en base
    const payment = await db.confirmPayment(transactionId);
    if (!payment) {
      console.error('[CINETPAY] Paiement introuvable en base:', transactionId);
      return;
    }

    // ── Traitement selon le type de paiement ────────────────────────────────
    switch (type) {

      case 'rapport_pdf': {
        // Recruteur a payé → envoyer le rapport PDF
        const { offerId } = metadata;
        if (!offerId || !whatsappNumber) break;

        console.log(`[CINETPAY] Envoi rapport PDF — offre: ${offerId} → recruteur: ${whatsappNumber}`);
        await sendReportAfterPayment(whatsappNumber, offerId);
        break;
      }

      case 'cv_boost': {
        // Candidat a payé le boost → marquer son application
        const { applicationId } = metadata;
        if (!applicationId || !whatsappNumber) break;

        await db.updateApplicationService(applicationId, 'boost', true);
        await wati.sendMessage(whatsappNumber,
          `⭐ *CV Boost activé !*\n\n` +
          `Votre profil est maintenant mis en priorité dans la short-list du recruteur.\n\n` +
          `Bonne chance pour votre candidature ! 🙌`
        );
        break;
      }

      case 'feedback_refus': {
        // Candidat a payé le feedback → sera envoyé si non retenu
        const { applicationId } = metadata;
        if (!applicationId || !whatsappNumber) break;

        await db.updateApplicationService(applicationId, 'feedbackPaid', true);
        await wati.sendMessage(whatsappNumber,
          `📋 *Feedback IA activé !*\n\n` +
          `Si votre candidature n'est pas retenue, vous recevrez automatiquement un rapport IA ` +
          `expliquant les points à améliorer et les formations recommandées.\n\n` +
          `Bonne chance ! 💪`
        );
        break;
      }

      case 'reecriture_cv': {
        const { applicationId, cvText, jobTitle } = metadata;
        if (!whatsappNumber) break;

        const { rewriteCv } = require('../services/claude');
        const rewritten = await rewriteCv(cvText || '', jobTitle || 'ce poste');
        await db.updateApplicationService(applicationId, 'rewriteDone', true);
        await wati.sendMessages(whatsappNumber, [
          `✅ *Votre CV réécrit par Muna IA :*\n\n${rewritten}`,
          `_Copiez ce texte pour mettre à jour votre CV. Bonne chance !_ 🎯`,
        ]);
        break;
      }

      case 'abonnement_starter': {
        await wati.sendMessage(whatsappNumber,
          `📦 *Abonnement Starter activé !*\n\n` +
          `✅ 3 recrutements inclus ce mois\n` +
          `✅ Rapports PDF illimités\n` +
          `✅ Support prioritaire\n\n` +
          `Pour lancer votre premier recrutement : répondez *RECRUTER* 🚀`
        );
        break;
      }

      default:
        console.warn('[CINETPAY] Type de paiement inconnu:', type);
    }

  } catch (err) {
    console.error('[CINETPAY] Erreur webhook:', err.message, err.stack);
  }
});

module.exports = router;
