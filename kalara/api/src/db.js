// Accès à la base Supabase du projet Kalara (tables payments et kalara_licenses : voir schema.sql).
const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

let client = null;
function sb() {
  if (!client) {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error('SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis');
    }
    client = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return client;
}

async function createPayment({ whatsappNumber, type, amount, reference, metadata = {} }) {
  const { data, error } = await sb()
    .from('payments')
    .insert({ whatsapp_number: whatsappNumber, type, amount, reference, status: 'pending', metadata })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getPaymentByReference(reference) {
  const { data, error } = await sb().from('payments').select('*').eq('reference', reference).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * « Réserve » le traitement d'un paiement : renvoie la ligne si c'est le premier appel,
 * null si le paiement a déjà été traité (protège contre les doubles activations).
 */
async function claimPaymentProcessing(reference) {
  const now = new Date().toISOString();
  const { data, error } = await sb()
    .from('payments')
    .update({ processed_at: now, status: 'paid', paid_at: now })
    .eq('reference', reference)
    .is('processed_at', null)
    .select();
  if (error) throw error;
  return data?.[0] ?? null;
}

async function releasePaymentProcessing(reference) {
  await sb().from('payments').update({ processed_at: null }).eq('reference', reference);
}

async function setPaymentMetadata(reference, metadata) {
  const { error } = await sb().from('payments').update({ metadata }).eq('reference', reference);
  if (error) throw error;
}

async function getKalaraLicenseByPhone(phone) {
  const { data, error } = await sb().from('kalara_licenses').select('*').eq('phone', phone).maybeSingle();
  if (error) throw error;
  return data;
}

async function getKalaraLicenseByCode(code) {
  const { data, error } = await sb().from('kalara_licenses').select('*').eq('code', code).maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertKalaraLicense({ phone, code, plan, expiresAt }) {
  const { data, error } = await sb()
    .from('kalara_licenses')
    .upsert({ phone, code, plan, expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'phone' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  createPayment,
  getPaymentByReference,
  claimPaymentProcessing,
  releasePaymentProcessing,
  setPaymentMetadata,
  getKalaraLicenseByPhone,
  getKalaraLicenseByCode,
  upsertKalaraLicense,
};
