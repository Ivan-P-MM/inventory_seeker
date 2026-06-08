-- ============================================
-- Antigravity: migration_v14_inventory_reevaluation.sql
-- Adds evaluation columns to advertiser_inventory
-- Run this in Supabase SQL Editor
-- ============================================

ALTER TABLE advertiser_inventory
  ADD COLUMN IF NOT EXISTS domain_rating   numeric,
  ADD COLUMN IF NOT EXISTS ahrefs_rank     integer,
  ADD COLUMN IF NOT EXISTS ads_txt_compliant boolean,
  ADD COLUMN IF NOT EXISTS ads_txt_payload text,
  ADD COLUMN IF NOT EXISTS eval_status     text DEFAULT NULL, -- 'pending' | 'approved' | 'rejected'
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS last_evaluated_at timestamptz;
