-- Enable pg_stat_statements when the DB role is allowed; otherwise skip.
-- Managed PostgreSQL often requires a superuser / infra step for CREATE EXTENSION.
-- Application code (pg-stat-report.mjs) detects availability and degrades clearly.

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
  COMMENT ON EXTENSION pg_stat_statements IS 'Query performance analysis — use backend/scripts/pg-stat-report.mjs';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_stat_statements skipped: insufficient privilege — enable via infrastructure';
  WHEN undefined_file THEN
    RAISE NOTICE 'pg_stat_statements skipped: extension files unavailable';
  WHEN OTHERS THEN
    -- e.g. shared_preload_libraries not configured
    RAISE NOTICE 'pg_stat_statements skipped: %', SQLERRM;
END $$;
