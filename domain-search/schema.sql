-- ============================================
-- Antigravity: web_current_results table
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS web_current_results (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  search_id     uuid NOT NULL,
  session_id    uuid NOT NULL,
  keyword       text NOT NULL,
  full_url      text NOT NULL,
  root_domain   text NOT NULL,
  subdomain     text,
  path          text,
  display_path  text,
  title         text,
  dv360_status  text DEFAULT 'Pending verification'
                  CHECK (dv360_status IN (
                    'Pending verification',
                    'Approved',
                    'Blacklisted'
                  )),
  rejection_reason text,
  ads_txt_payload text,
  created_at    timestamptz DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_web_current_results_session
  ON web_current_results(session_id);

CREATE INDEX IF NOT EXISTS idx_web_current_results_status
  ON web_current_results(dv360_status);

CREATE INDEX IF NOT EXISTS idx_web_current_results_session_status
  ON web_current_results(session_id, dv360_status);

-- Enable Row Level Security (allow all for service role)
ALTER TABLE web_current_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON web_current_results
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Antigravity: domain_rating_repository table
-- ============================================

CREATE TABLE IF NOT EXISTS domain_rating_repository (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  root_domain text NOT NULL,
  subdomain text,
  path text,
  created_at timestamptz DEFAULT now(),
  ads_txt_payload text,
  domain_rating integer,
  ahrefs_rank bigint,
  result_description text[]
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_domain_rating_repository_domain
  ON domain_rating_repository(root_domain);

-- Enable Row Level Security
ALTER TABLE domain_rating_repository ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON domain_rating_repository
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Antigravity: blacklist table
-- ============================================

CREATE TABLE IF NOT EXISTS blacklist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item text NOT NULL UNIQUE,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_blacklist_inventory_item
  ON blacklist(inventory_item);

-- Enable Row Level Security
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON blacklist
  FOR ALL
  USING (true)
  WITH CHECK (true);

