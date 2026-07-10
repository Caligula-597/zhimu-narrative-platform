-- Enable pg_stat_statements for query analysis (requires superuser on managed PG).
-- Safe to re-run; extension objects live in shared catalog.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

COMMENT ON EXTENSION pg_stat_statements IS 'Query performance analysis — use backend/scripts/pg-stat-report.mjs';
