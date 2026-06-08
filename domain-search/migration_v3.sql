-- ============================================
-- Antigravity: migration_v3.sql
-- Adds Domain Rating (DR) and Ahrefs Rank columns
-- Run this in Supabase SQL Editor
-- ============================================

ALTER TABLE web_current_results
    ADD COLUMN IF NOT EXISTS domain_rating  numeric,
    ADD COLUMN IF NOT EXISTS ahrefs_rank    bigint;

-- Optional index for quick DR-based sorting
CREATE INDEX IF NOT EXISTS idx_web_current_results_dr
    ON web_current_results(domain_rating DESC NULLS LAST);
