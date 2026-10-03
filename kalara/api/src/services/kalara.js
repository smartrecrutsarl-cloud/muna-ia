// Kalara Premium : pass prépayés Mobile Money (CinetPay) et licences signées vérifiables hors ligne.
const crypto = require('crypto');
const config = require('../config');
const db = require('../db');
const cinetpay = require('./cinetpay');
const wati = require('./wati');

const PLANS = config.kalara.plans;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O, 1/I
const DAY = 24 * 60 * 60 * 1000;

/** Numéro Mobile Money → format international sans « + » (ex. 237690000000), ou null si invalide. */
function normalizePhone(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^6\d{8}$/.test(digits)) digits = `237${digits}`; // numéro camerounais saisi sans indicatif
  return /^\d{9,15}$/.test(digits) ? digits : null;
}

function newCode() {
  const pick = () => Array.from({ length: 4 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
  return `KAL-${pick()}-${pick()}`;
}

function normalizeCode(input) {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^KAL/, '');
  return raw.length === 8 ? `KAL-${raw.slice(0, 4)}-${raw.slice(4)}` : null;
}

let privateKey = null;
function getPrivateKey() {
  if (!privateKey) {
    if (!config.kalara.licensePrivateKey) throw new Error('KALARA_LICENSE_PRIVATE_KEY manquante');
    privateKey = crypto.createPrivateKey(config.kalara.licensePrivateKey);
  }
  return privateKey;
}

/**
 * Licence = base64url(JSON) + "." + base64url(signature ECDSA P-256 / SHA-256, format r||s).
 * L'application la vérifie avec la clé publique embarquée, sans connexion.
 */
function signLicense(row) {
  const payload = {
    v: 1,
    code: row.code,
    plan: row.plan,
    exp: new Date(row.expires_at).getTime(),
    iat: Date.now(),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.sign('sha256', Buffer.from(data), { key: getPrivateKey(), dsaEncoding: 'ieee-p1363' });
  return `${data}.${sig.toString('base64url')}`;
}

function licenseResponse(row) {
  return { status: 'ACTIVE', license: signLicense(row), code: row.code, plan: row.plan, expiresAt: row.expires_at };
}

/** Crée le lien de paiement CinetPay pour un pass. */
async function createCheckout({ plan, phone }) {
  const p = PLANS[plan];
  if (!p) throw Object.assign(new Error('Formule inconnue'), { status: 400 });
  const number = normalizePhone(phone);
  if (!number) throw Object.assign(new Error('Numéro de téléphone invalide'), { status: 400 });

  const transactionId = `KAL-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const { paymentUrl } = await cinetpay.createPaymentLink({
    transactionId,
    amount: p.amount,
    description: p.label,
    whatsappNumber: number,
    customerName: 'Client Kalara',
    returnUrl: `${config.app.url.replace(/\/$/, '')}/api/kalara/return?tx=${transactionId}`,
    metadata: { type: 'kalara_premium', plan },
  });
  await db.createPayment({ whatsappNumber: number, type: 'kalara_premium', amount: p.amount, reference: transactionId, metadata: { plan } });
  return { paymentUrl, transactionId };
}

/**
 * Active (ou prolonge) la licence liée à un paiement, après vérification auprès de CinetPay.
 * Idempotent : appelé par le webhook ET par l'application, une seule prolongation est appliquée.
 * @returns {Promise<{status: 'ACTIVE'|'PENDING'|'REFUSED'|'UNKNOWN', ...}>}
 */
async function activateFromPayment(transactionId) {
  const payment = await db.getPaymentByReference(transactionId);
  if (!payment || payment.type !== 'kalara_premium') return { status: 'UNKNOWN' };

  // Déjà traité : on renvoie la licence actuelle.
  if (payment.processed_at && payment.metadata?.license_code) {
    const row = await db.getKalaraLicenseByCode(payment.metadata.license_code);
    return row ? licenseResponse(row) : { status: 'PENDING' };
  }

  // On ne se fie jamais à la notification reçue : on interroge CinetPay directement.
  const details = await cinetpay.getPaymentDetails(transactionId);
  if (!details) return { status: 'PENDING' };
  if (details.status === 'REFUSED' || details.status === 'CANCELED') return { status: 'REFUSED' };
  if (details.status !== 'ACCEPTED') return { status: 'PENDING' };

  const plan = PLANS[payment.metadata?.plan];
  if (!plan || details.amount < plan.amount || (details.currency && details.currency !== 'XAF')) {
    console.error(`[KALARA] Montant incohérent pour ${transactionId} : ${details.amount} ${details.currency}`);
    return { status: 'REFUSED' };
  }

  const claimed = await db.claimPaymentProcessing(transactionId);
  if (!claimed) {
    // Traitement concurrent (webhook + application) : on relit le résultat.
    const again = await db.getPaymentByReference(transactionId);
    const row = again?.metadata?.license_code && (await db.getKalaraLicenseByCode(again.metadata.license_code));
    return row ? licenseResponse(row) : { status: 'PENDING' };
  }

  try {
    const existing = await db.getKalaraLicenseByPhone(payment.whatsapp_number);
    const base = Math.max(Date.now(), existing ? new Date(existing.expires_at).getTime() : 0);
    const row = await db.upsertKalaraLicense({
      phone: payment.whatsapp_number,
      code: existing?.code || newCode(),
      plan: payment.metadata.plan,
      expiresAt: new Date(base + plan.days * DAY),
    });
    await db.setPaymentMetadata(transactionId, { ...payment.metadata, license_code: row.code });
    notifyWhatsApp(row).catch(() => {});
    console.log(`[KALARA] Licence ${row.code} active jusqu'au ${row.expires_at}`);
    return licenseResponse(row);
  } catch (err) {
    await db.releasePaymentProcessing(transactionId);
    throw err;
  }
}

/** Restauration sur un autre appareil à partir du code. */
async function restore(codeInput) {
  const code = normalizeCode(codeInput);
  if (!code) return { status: 'INVALID' };
  const row = await db.getKalaraLicenseByCode(code);
  if (!row) return { status: 'INVALID' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { status: 'EXPIRED', expiresAt: row.expires_at, code: row.code };
  return licenseResponse(row);
}

/**
 * Envoie le code par WhatsApp. Best effort : WhatsApp n'accepte les messages de session
 * que si l'utilisateur a écrit au numéro dans les 24 h ; le code est de toute façon affiché dans l'application.
 */
async function notifyWhatsApp(row) {
  const until = new Date(row.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  await wati.sendMessage(
    row.phone,
    `🎧 *Kalara Premium activé !*\n\nVos 12 narrateurs et votre bibliothèque illimitée sont disponibles jusqu'au *${until}*.\n\n` +
      `🔑 Votre code de restauration : *${row.code}*\n_Gardez-le : il permet de retrouver votre abonnement sur un autre téléphone._`,
  );
}

module.exports = { PLANS, normalizePhone, normalizeCode, newCode, signLicense, createCheckout, activateFromPayment, restore };
