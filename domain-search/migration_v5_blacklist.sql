-- ============================================
-- Antigravity: migration_v5_blacklist.sql
-- Adds persistent blacklist table
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS blacklist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  domain text NOT NULL UNIQUE,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_blacklist_domain
  ON blacklist(domain);

-- Enable Row Level Security
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON blacklist
  FOR ALL
  USING (true)
  WITH CHECK (true);
