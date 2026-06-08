-- Rename search_results to web_current_results
ALTER TABLE search_results RENAME TO web_current_results;

-- Rename associated indexes for consistency
ALTER INDEX IF EXISTS idx_search_results_session RENAME TO idx_web_current_results_session;
ALTER INDEX IF EXISTS idx_search_results_status RENAME TO idx_web_current_results_status;
ALTER INDEX IF EXISTS idx_search_results_session_status RENAME TO idx_web_current_results_session_status;
ALTER INDEX IF EXISTS idx_search_results_dr RENAME TO idx_web_current_results_dr;
