const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

const claude = new Anthropic({ apiKey: config.anthropic.apiKey });

/**
 * Extrait le texte d'un CV en image (JPEG, PNG, WEBP)
 * Utilise claude-haiku (rapide et économique) pour l'OCR
 * @param {Buffer} imageBuffer
 * @param {string} mimeType - "image/jpeg" | "image/png" | "image/webp"
 * @returns {string} Texte extrait
 */
async function extractCvFromImage(imageBuffer, mimeType = 'image/jpeg') {
  const base64 = imageBuffer.toString('base64');

  const response = await claude.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64 },
        },
        {
          type: 'text',
          text: `Tu es un extracteur de CV. Extrait tout le texte visible dans ce CV de manière structurée.
Inclus : nom, contact, formations (école, diplôme, année), expériences (poste, entreprise, durée), compétences, langues.
Réponds uniquement avec le texte extrait, sans commentaire.`,
        },
      ],
    }],
  });

  return response.content[0].text;
}

/**
 * Score un CV par rapport à une offre d'emploi
 * Utilise claude-sonnet pour un scoring précis
 * @param {string} cvText - Texte du CV extrait
 * @param {object} jobOffer - { title, city, salary, description }
 * @returns {object} { score, details, strengths, weaknesses, recommendation }
 */
async function scoreCv(cvText, jobOffer) {
  const systemPrompt = `Tu es un expert RH senior spécialisé dans le recrutement en Afrique centrale (Cameroun).
Tu analyses des CVs de candidats camerounais et les scores en tenant compte du contexte local :
- Les diplômes camerounais (BEPC, BAC, Licence, Master, Doctorat de l'UY1, UY2, Université de Dschang, etc.)
- Les expériences dans des PME locales sont valorisées même sans grandes entreprises
- La polyvalence est un atout dans le contexte PME
- Le bilinguisme français/anglais est un vrai plus
Tu réponds UNIQUEMENT en JSON valide, sans markdown ni commentaire.`;

  const userPrompt = `Évalue ce candidat pour le poste suivant :

POSTE : ${jobOffer.title}
VILLE : ${jobOffer.city || 'Non précisée'}
SALAIRE : ${jobOffer.salary || 'Non précisé'}
DESCRIPTION : ${jobOffer.description || 'Pas de description supplémentaire'}

CV DU CANDIDAT :
${cvText}

Retourne ce JSON exact :
{
  "score": <nombre entre 0 et 100>,
  "details": {
    "formation": <score 0-25>,
    "experience": <score 0-35>,
    "competences": <score 0-25>,
    "adequation_poste": <score 0-15>
  },
  "points_forts": ["<point 1>", "<point 2>", "<point 3>"],
  "points_faibles": ["<point 1>", "<point 2>"],
  "recommandation": "SHORTLIST" | "CONSIDERATION" | "REJETER",
  "resume_en_une_ligne": "<résumé du profil en max 15 mots>"
}`;

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = response.content[0].text.trim();

  try {
    return JSON.parse(raw);
  } catch {
    // Si le JSON est mal formé, tentative de nettoyage
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Score IA invalide : ' + raw.substring(0, 200));
  }
}

/**
 * Génère un feedback personnalisé pour un candidat refusé
 * @param {string} cvText
 * @param {object} jobOffer
 * @param {object} scoreDetails - Résultat du scoring
 * @returns {string} Message de feedback WhatsApp
 */
async function generateFeedback(cvText, jobOffer, scoreDetails) {
  const response = await claude.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Tu es un coach carrière bienveillant au Cameroun. 
Écris un feedback WhatsApp (max 150 mots) pour ce candidat non retenu pour le poste de "${jobOffer.title}".

Score obtenu : ${scoreDetails.score}/100
Points faibles identifiés : ${(scoreDetails.points_faibles || []).join(', ')}

Le message doit :
1. Être encourageant et respectueux
2. Expliquer 2 points à améliorer concrètement
3. Suggérer une action immédiate (formation, expérience à acquérir)
4. Rester court et lisible sur WhatsApp

Commence directement par "📋 Feedback Muna IA :"`,
    }],
  });

  return response.content[0].text;
}

/**
 * Réécrit un CV de manière optimisée pour un poste
 * @param {string} cvText
 * @param {string} jobTitle
 * @returns {string} CV réécrit en texte
 */
async function rewriteCv(cvText, jobTitle) {
  const response = await claude.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Tu es un rédacteur de CV expert pour le marché camerounais.
Réécris ce CV de manière optimisée pour le poste de "${jobTitle}".
Valorise les compétences pertinentes, reformule les expériences, améliore la structure.
Format : texte simple lisible sur WhatsApp (pas de markdown complexe).

CV original :
${cvText}`,
    }],
  });

  return response.content[0].text;
}

module.exports = { extractCvFromImage, scoreCv, generateFeedback, rewriteCv };
