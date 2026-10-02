-- ================================================================
-- MUNA IA — Schéma Supabase
-- Coller et exécuter dans l'éditeur SQL de votre projet Supabase
-- https://app.supabase.com → SQL Editor → New Query
-- ================================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── CONVERSATIONS (Machine à états WhatsApp) ──────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  whatsapp_number TEXT UNIQUE NOT NULL,
  state           TEXT DEFAULT 'IDLE',
  role            TEXT, -- 'recruiter' | 'candidate'
  context         JSONB DEFAULT '{}',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── OFFRES D'EMPLOI ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_offers (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recruiter_number TEXT NOT NULL,
  title            TEXT NOT NULL,
  city             TEXT,
  salary           TEXT,
  description      TEXT DEFAULT '',
  reference_code   TEXT UNIQUE NOT NULL,
  status           TEXT DEFAULT 'active', -- 'active' | 'scoring' | 'completed'
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  scoring_at       TIMESTAMPTZ
);

-- ── CANDIDATURES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_offer_id     UUID REFERENCES job_offers(id) ON DELETE CASCADE,
  candidate_number TEXT NOT NULL,
  candidate_name   TEXT DEFAULT 'Candidat',
  cv_url           TEXT,
  cv_text          TEXT,
  score            INTEGER,          -- 0 à 100
  score_details    JSONB,            -- Détail du scoring IA
  status           TEXT DEFAULT 'pending', -- 'pending' | 'scored' | 'shortlisted' | 'rejected'
  services         JSONB DEFAULT '{}',     -- {boost, feedbackPaid, feedbackSent, rewriteDone}
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_offer_id, candidate_number)  -- 1 candidature max par offre
);

-- ── PAIEMENTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  whatsapp_number  TEXT NOT NULL,
  type             TEXT NOT NULL,    -- 'rapport_pdf' | 'cv_boost' | 'feedback_refus' | etc.
  amount           INTEGER NOT NULL, -- Montant en FCFA
  status           TEXT DEFAULT 'pending', -- 'pending' | 'paid' | 'failed'
  reference        TEXT UNIQUE,      -- ID de transaction Muna
  cinetpay_ref     TEXT,             -- ID CinetPay
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  paid_at          TIMESTAMPTZ
);

-- ── INDEX ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conv_phone       ON conversations(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_offers_recruiter ON job_offers(recruiter_number);
CREATE INDEX IF NOT EXISTS idx_offers_status    ON job_offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_code      ON job_offers(reference_code);
CREATE INDEX IF NOT EXISTS idx_apps_offer       ON applications(job_offer_id);
CREATE INDEX IF NOT EXISTS idx_apps_candidate   ON applications(candidate_number);
CREATE INDEX IF NOT EXISTS idx_payments_ref     ON payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_phone   ON payments(whatsapp_number);

-- ── VUES UTILES ───────────────────────────────────────────────────────────

-- Vue résumé offres avec compte de candidatures
CREATE OR REPLACE VIEW offers_summary AS
SELECT
  o.*,
  COUNT(a.id) as total_applications,
  COUNT(a.id) FILTER (WHERE a.score IS NOT NULL) as scored_applications,
  AVG(a.score) FILTER (WHERE a.score IS NOT NULL) as avg_score,
  COUNT(a.id) FILTER (WHERE a.services->>'boost' = 'true') as boosted_count
FROM job_offers o
LEFT JOIN applications a ON a.job_offer_id = o.id
GROUP BY o.id;

-- ── SÉCURITÉ (Row Level Security) ─────────────────────────────────────────
-- Note : Le service key bypass le RLS — OK pour le backend
ALTER TABLE conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_offers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;

-- Politique : seul le service key (backend) peut tout lire/écrire
CREATE POLICY "service_only" ON conversations  USING (false);
CREATE POLICY "service_only" ON job_offers     USING (false);
CREATE POLICY "service_only" ON applications   USING (false);
CREATE POLICY "service_only" ON payments       USING (false);

-- ✅ Schéma créé avec succès !
-- Le backend Node.js utilise SUPABASE_SERVICE_KEY qui bypasse le RLS.

-- ── KALARA (lecteur audio) : licences Premium ─────────────────────────────
-- (à exécuter aussi seul : voir supabase-kalara.sql)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS kalara_licenses (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone       TEXT UNIQUE NOT NULL,   -- numéro Mobile Money (237…)
  code        TEXT UNIQUE NOT NULL,   -- code de restauration KAL-XXXX-XXXX
  plan        TEXT NOT NULL,          -- 'week' | 'month' | 'year' (dernier pass acheté)
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE kalara_licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only" ON kalara_licenses;
CREATE POLICY "service_only" ON kalara_licenses USING (false);
