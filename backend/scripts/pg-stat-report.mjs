#!/usr/bin/env node
/**
 * Print top SQL statements from pg_stat_statements (requires migration 063).
 * Usage: node backend/scripts/pg-stat-report.mjs [--limit=20]
 */
import { query, pool } from "../src/db.js";

const limit = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || 20);

async function main() {
  const ext = await query(`SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'`);
  if (!ext.rowCount) {
    console.error("pg_stat_statements extension is not installed. Run db:migrate first.");
    process.exitCode = 1;
    return;
  }

  const result = await query(
    `SELECT
       LEFT(query, 160) AS query_preview,
       calls,
       ROUND(total_exec_time::numeric, 2) AS total_ms,
       ROUND(mean_exec_time::numeric, 2) AS mean_ms,
       rows
     FROM pg_stat_statements
     WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
       AND query NOT ILIKE '%pg_stat_statements%'
     ORDER BY total_exec_time DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)]
  );

  if (!result.rowCount) {
    console.log("No pg_stat_statements rows yet — run some API traffic first.");
    return;
  }

  console.log(`Top ${result.rowCount} queries by total time:\n`);
  for (const row of result.rows) {
    console.log(`calls=${row.calls} total_ms=${row.total_ms} mean_ms=${row.mean_ms} rows=${row.rows}`);
    console.log(`  ${row.query_preview}\n`);
  }
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => pool.end().catch(() => {}));
