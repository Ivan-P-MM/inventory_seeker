-- ============================================
-- Antigravity: migration_v15_rename_domain_to_inventory_item.sql
-- Renames the 'domain' column to 'inventory_item'
-- Run this in Supabase SQL Editor
-- ============================================

-- Rename the column in advertiser_inventory
ALTER TABLE IF EXISTS advertiser_inventory RENAME COLUMN domain TO inventory_item;

-- Rename the column in blacklist
ALTER TABLE IF EXISTS blacklist RENAME COLUMN domain TO inventory_item;

-- Rename associated indexes for consistency
ALTER INDEX IF EXISTS idx_advertiser_inventory_domain RENAME TO idx_advertiser_inventory_item;
ALTER INDEX IF EXISTS idx_blacklist_domain RENAME TO idx_blacklist_inventory_item;
