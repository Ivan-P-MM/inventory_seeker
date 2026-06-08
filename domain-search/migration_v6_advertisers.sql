-- ============================================
-- Antigravity: migration_v6_advertisers.sql
-- Adds advertiser profiles + domain assignments
-- Run this in Supabase SQL Editor
-- ============================================

-- Advertiser profiles
CREATE TABLE IF NOT EXISTS advertisers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advertisers_name
  ON advertisers(name);

ALTER TABLE advertisers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON advertisers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Domains assigned to each advertiser
CREATE TABLE IF NOT EXISTS advertiser_domains (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  advertiser_id uuid NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  domain text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (advertiser_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_advertiser_domains_advertiser
  ON advertiser_domains(advertiser_id);

CREATE INDEX IF NOT EXISTS idx_advertiser_domains_domain
  ON advertiser_domains(domain);

ALTER TABLE advertiser_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON advertiser_domains
  FOR ALL
  USING (true)
  WITH CHECK (true);
