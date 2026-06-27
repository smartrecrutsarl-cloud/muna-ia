const PDFDocument = require('pdfkit');

/**
 * Génère le rapport PDF "Top 5 Candidats" pour le recruteur
 * @param {object} jobOffer - L'offre d'emploi
 * @param {object[]} topCandidates - Les 5 meilleurs candidats avec leurs scores
 * @returns {Promise<Buffer>} - Le PDF sous forme de Buffer
 */
function generateTop5Report(jobOffer, topCandidates) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── COULEURS ──────────────────────────────────────────────────────────────
    const GREEN = '#10B981';
    const DARK = '#0F172A';
    const GRAY = '#64748B';
    const LIGHT_GRAY = '#F1F5F9';
    const AMBER = '#F59E0B';
    const RED = '#EF4444';

    // ── EN-TÊTE ───────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 120).fill(DARK);

    doc.fillColor('#FFFFFF')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('🤖 MUNA IA', 50, 30);

    doc.fontSize(11)
      .font('Helvetica')
      .fillColor('#94A3B8')
      .text('Assistant Recrutement Intelligent • WhatsApp', 50, 60);

    doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(GREEN)
      .text('RAPPORT TOP 5 — SÉLECTION IA', 50, 85);

    // ── INFOS OFFRE ───────────────────────────────────────────────────────────
    doc.rect(0, 120, doc.page.width, 80).fill(LIGHT_GRAY);

    doc.fillColor(DARK)
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(jobOffer.title || 'Poste non précisé', 50, 135);

    doc.fontSize(11)
      .font('Helvetica')
      .fillColor(GRAY)
      .text(`📍 ${jobOffer.city || 'Non précisé'}   •   💰 ${jobOffer.salary || 'Non précisé'}   •   📅 ${formatDate(jobOffer.created_at)}`, 50, 165);

    doc.rect(50, 190, doc.page.width - 100, 1).fill('#E2E8F0');

    // ── RÉSUMÉ ────────────────────────────────────────────────────────────────
    doc.moveDown(0.5);
    const totalCandidates = topCandidates[0]?.totalCandidates || topCandidates.length;
    doc.fillColor(GRAY)
      .fontSize(10)
      .font('Helvetica')
      .text(
        `Analyse IA réalisée sur ${totalCandidates} candidature(s) reçue(s). ` +
        `Voici les ${topCandidates.length} meilleur(s) profil(s) sélectionné(s).`,
        50, 205
      );

    // ── CANDIDATS ─────────────────────────────────────────────────────────────
    let y = 240;

    topCandidates.forEach((candidate, index) => {
      if (y > 680) { doc.addPage(); y = 50; }

      const details = candidate.score_details || {};
      const isShortlist = (details.recommandation || '').toUpperCase() === 'SHORTLIST';
      const scoreColor = candidate.score >= 70 ? GREEN : candidate.score >= 50 ? AMBER : RED;

      // Carte candidat
      doc.rect(50, y, doc.page.width - 100, 130)
        .fillAndStroke('#FFFFFF', '#E2E8F0');

      // Badge rang
      const rankColor = index === 0 ? '#F59E0B' : index === 1 ? '#94A3B8' : '#CD7F32';
      doc.rect(50, y, 50, 130).fill(rankColor);
      doc.fillColor('#FFFFFF')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(`#${index + 1}`, 55, y + 45, { width: 40, align: 'center' });

      // Nom et résumé
      doc.fillColor(DARK)
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(candidate.candidate_name || 'Candidat', 115, y + 12);

      doc.fillColor(GRAY)
        .fontSize(9)
        .font('Helvetica')
        .text(details.resume_en_une_ligne || '', 115, y + 32, { width: 300 });

      // Score
      doc.fillColor(scoreColor)
        .fontSize(28)
        .font('Helvetica-Bold')
        .text(`${candidate.score}`, doc.page.width - 130, y + 15, { width: 80, align: 'right' });
      doc.fillColor(GRAY)
        .fontSize(10)
        .font('Helvetica')
        .text('/100', doc.page.width - 100, y + 45, { width: 50 });

      // Badge shortlist
      if (isShortlist) {
        doc.rect(doc.page.width - 165, y + 70, 80, 18).fill(GREEN);
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
          .text('✓ SHORTLIST', doc.page.width - 163, y + 74);
      }

      // Points forts
      const strengths = (details.points_forts || []).slice(0, 2);
      if (strengths.length > 0) {
        doc.fillColor(GREEN).fontSize(8).font('Helvetica-Bold')
          .text('POINTS FORTS :', 115, y + 55);
        doc.fillColor(DARK).fontSize(8).font('Helvetica')
          .text(strengths.map(s => `• ${s}`).join('  '), 115, y + 67, { width: 280 });
      }

      // Contact WhatsApp
      doc.fillColor(GRAY).fontSize(8).font('Helvetica')
        .text(`📱 ${candidate.candidate_number}`, 115, y + 105);

      // Boost badge
      if (candidate.services?.boost) {
        doc.rect(115, y + 100, 45, 14).fill(AMBER);
        doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica-Bold')
          .text('⭐ BOOST', 117, y + 104);
      }

      y += 145;
    });

    // ── PIED DE PAGE ──────────────────────────────────────────────────────────
    const footerY = doc.page.height - 60;
    doc.rect(0, footerY, doc.page.width, 60).fill(DARK);

    doc.fillColor('#94A3B8')
      .fontSize(8)
      .font('Helvetica')
      .text(
        `Rapport généré par Muna IA • ${new Date().toLocaleString('fr-FR')} • muna-ia.cm`,
        50, footerY + 12, { align: 'center', width: doc.page.width - 100 }
      );

    doc.fillColor('#64748B')
      .fontSize(7)
      .text(
        'Ce rapport est confidentiel. Les scores sont générés par IA et ne remplacent pas le jugement humain.',
        50, footerY + 30, { align: 'center', width: doc.page.width - 100 }
      );

    doc.end();
  });
}

function formatDate(dateStr) {
  if (!dateStr) return new Date().toLocaleDateString('fr-FR');
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}

module.exports = { generateTop5Report };
