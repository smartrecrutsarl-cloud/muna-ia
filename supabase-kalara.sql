-- Kalara Premium — à exécuter dans Supabase → SQL Editor (une seule fois)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
