-- ============================================
-- Antigravity: migration_v7b_advertiser_inventory_indexes.sql
-- Safe to run if the table already exists.
-- Adds missing indexes only (skips table creation & RLS).
-- Run this in Supabase SQL Editor
-- ============================================

-- Indexes for fast lookup (IF NOT EXISTS = safe to re-run)
CREATE INDEX IF NOT EXISTS idx_advertiser_inventory_advertiser
  ON advertiser_inventory(advertiser);

CREATE INDEX IF NOT EXISTS idx_advertiser_inventory_domain
  ON advertiser_inventory(domain);
