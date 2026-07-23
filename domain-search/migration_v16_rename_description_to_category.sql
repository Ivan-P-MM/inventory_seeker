-- Migration to rename result_description to category in domain_rating_repository

ALTER TABLE IF EXISTS domain_rating_repository 
RENAME COLUMN result_description TO category;
