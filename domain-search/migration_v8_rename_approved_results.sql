-- Rename approved_results to domain_rating_repository
ALTER TABLE approved_results RENAME TO domain_rating_repository;

-- Rename associated index for consistency
ALTER INDEX IF EXISTS idx_approved_results_domain RENAME TO idx_domain_rating_repository_domain;
