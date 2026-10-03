-- Kalara — schéma de la base Supabase du projet Kalara (SQL Editor → Run, une seule fois)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Paiements CinetPay
CREATE TABLE IF NOT EXISTS payments (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  whatsapp_number  TEXT NOT NULL,
  type             TEXT NOT NULL,
  amount           INTEGER NOT NULL,
  status           TEXT DEFAULT 'pending',
  reference        TEXT UNIQUE,
  cinetpay_ref     TEXT,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  paid_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payments_ref   ON payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_phone ON payments(whatsapp_number);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only" ON payments;
CREATE POLICY "service_only" ON payments USING (false);

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
