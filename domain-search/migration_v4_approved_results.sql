-- ============================================
-- Antigravity: domain_rating_repository table
-- Run this in Supabase SQL Editor
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

-- Enable Row Level Security (allow all for service role and public for simplicity as with web_current_results)
ALTER TABLE domain_rating_repository ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON domain_rating_repository
  FOR ALL
  USING (true)
  WITH CHECK (true);
