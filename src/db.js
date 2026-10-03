const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

// Initialisation paresseuse — évite un crash au démarrage si les vars manquent
let _supabase = null;
function getClient() {
  if (!_supabase) {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error('SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis dans .env');
    }
    _supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return _supabase;
}

// Proxy pour garder la compatibilité avec le code existant
const supabase = new Proxy({}, {
  get(_, prop) { return getClient()[prop]; }
});

// ─── CONVERSATIONS (machine à états) ─────────────────────────────────────────

async function getConversation(whatsappNumber) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('whatsapp_number', whatsappNumber)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function upsertConversation(whatsappNumber, state, role, context = {}) {
  const { data, error } = await supabase
    .from('conversations')
    .upsert({
      whatsapp_number: whatsappNumber,
      state,
      role,
      context,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'whatsapp_number' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function resetConversation(whatsappNumber) {
  return upsertConversation(whatsappNumber, 'IDLE', null, {});
}

// ─── OFFRES D'EMPLOI ──────────────────────────────────────────────────────────

async function createJobOffer({ recruiterNumber, title, city, salary, description }) {
  // Génère un code unique de 6 caractères
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  const { data, error } = await supabase
    .from('job_offers')
    .insert({
      recruiter_number: recruiterNumber,
      title,
      city,
      salary,
      description: description || '',
      reference_code: code,
      status: 'active',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getJobOfferByCode(code) {
  const { data, error } = await supabase
    .from('job_offers')
    .select('*')
    .eq('reference_code', code.toUpperCase())
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function getJobOfferById(id) {
  const { data, error } = await supabase
    .from('job_offers')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// Récupère les offres prêtes à scorer (actives, créées il y a 48h+, ≥1 candidature)
async function getOffersReadyToScore() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('job_offers')
    .select('*, applications(count)')
    .eq('status', 'active')
    .lt('created_at', cutoff);
  if (error) throw error;
  return (data || []).filter(o => o.applications[0]?.count > 0);
}

async function updateJobOfferStatus(id, status) {
  const { error } = await supabase
    .from('job_offers')
    .update({ status, scoring_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ─── CANDIDATURES ─────────────────────────────────────────────────────────────

async function createApplication({ jobOfferId, candidateNumber, candidateName, cvUrl, cvText }) {
  // Vérifie si le candidat a déjà postulé à cette offre
  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('job_offer_id', jobOfferId)
    .eq('candidate_number', candidateNumber)
    .single();
  if (existing) return { ...existing, alreadyApplied: true };

  const { data, error } = await supabase
    .from('applications')
    .insert({
      job_offer_id: jobOfferId,
      candidate_number: candidateNumber,
      candidate_name: candidateName || 'Candidat',
      cv_url: cvUrl || null,
      cv_text: cvText || null,
      status: 'pending',
      services: {},
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getApplicationsByOffer(jobOfferId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('job_offer_id', jobOfferId)
    .order('score', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function updateApplicationScore(id, score, scoreDetails) {
  const { error } = await supabase
    .from('applications')
    .update({ score, score_details: scoreDetails, status: 'scored' })
    .eq('id', id);
  if (error) throw error;
}

async function updateApplicationService(id, serviceKey, value = true) {
  // Lit d'abord les services actuels
  const { data } = await supabase
    .from('applications')
    .select('services')
    .eq('id', id)
    .single();
  const services = { ...(data?.services || {}), [serviceKey]: value };
  const { error } = await supabase
    .from('applications')
    .update({ services })
    .eq('id', id);
  if (error) throw error;
}

async function getApplicationByCandidate(jobOfferId, candidateNumber) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('job_offer_id', jobOfferId)
    .eq('candidate_number', candidateNumber)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ─── PAIEMENTS ────────────────────────────────────────────────────────────────

async function createPayment({ whatsappNumber, type, amount, reference, metadata = {} }) {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      whatsapp_number: whatsappNumber,
      type,
      amount,
      reference,
      status: 'pending',
      metadata,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function confirmPayment(reference) {
  const { data, error } = await supabase
    .from('payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('reference', reference)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getPendingPayment(whatsappNumber, type) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('whatsapp_number', whatsappNumber)
    .eq('type', type)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ─── STATS DASHBOARD ──────────────────────────────────────────────────────────

async function getDashboardStats() {
  const [offers, applications, payments] = await Promise.all([
    supabase.from('job_offers').select('*', { count: 'exact' }),
    supabase.from('applications').select('*', { count: 'exact' }),
    supabase.from('payments').select('amount').eq('status', 'paid'),
  ]);

  const totalRevenue = (payments.data || []).reduce((sum, p) => sum + p.amount, 0);
  const activeOffers = (offers.data || []).filter(o => o.status === 'active').length;

  return {
    totalOffers: offers.count || 0,
    activeOffers,
    totalApplications: applications.count || 0,
    totalRevenue,
  };
}

async function getRecentOffers(limit = 20) {
  const { data, error } = await supabase
    .from('job_offers')
    .select('*, applications(count)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function getRecentPayments(limit = 20) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

module.exports = {
  supabase,
  getConversation,
  upsertConversation,
  resetConversation,
  createJobOffer,
  getJobOfferByCode,
  getJobOfferById,
  getOffersReadyToScore,
  updateJobOfferStatus,
  createApplication,
  getApplicationsByOffer,
  updateApplicationScore,
  updateApplicationService,
  getApplicationByCandidate,
  createPayment,
  confirmPayment,
  getPendingPayment,
  getDashboardStats,
  getRecentOffers,
  getRecentPayments,
};
