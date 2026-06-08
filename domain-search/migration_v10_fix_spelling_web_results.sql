-- Fix spelling: Rename web_current_resutl to web_current_results
ALTER TABLE web_current_resutl RENAME TO web_current_results;

-- Rename associated indexes for consistency
ALTER INDEX IF EXISTS idx_web_current_resutl_session RENAME TO idx_web_current_results_session;
ALTER INDEX IF EXISTS idx_web_current_resutl_status RENAME TO idx_web_current_results_status;
ALTER INDEX IF EXISTS idx_web_current_resutl_session_status RENAME TO idx_web_current_results_session_status;
ALTER INDEX IF EXISTS idx_web_current_resutl_dr RENAME TO idx_web_current_results_dr;
