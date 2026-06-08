-- ============================================
-- Antigravity: migration_v7_advertiser_inventory.sql
-- Adds flattened advertiser inventory table
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS advertiser_inventory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  advertiser text NOT NULL,
  domain text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (advertiser, domain)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_advertiser_inventory_advertiser
  ON advertiser_inventory(advertiser);

CREATE INDEX IF NOT EXISTS idx_advertiser_inventory_domain
  ON advertiser_inventory(domain);

-- Enable Row Level Security
ALTER TABLE advertiser_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON advertiser_inventory
  FOR ALL
  USING (true)
  WITH CHECK (true);
