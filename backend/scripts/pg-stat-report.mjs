#!/usr/bin/env node
/**
 * Print top SQL statements from pg_stat_statements (requires migration 063).
 * Usage: node backend/scripts/pg-stat-report.mjs [--limit=20]
 */
import { query, pool } from "../src/db.js";

const limit = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || 20);

/**
 * Classify pg_stat_statements access failures for ops messaging / tests.
 * @param {Error & { code?: string }} error
 * @returns {{ code: string, message: string }}
 */
export function classifyPgStatError(error) {
  const msg = String(error?.message || error || "");
  const pgCode = error?.code || "";
  if (pgCode === "42501" || /permission denied/i.test(msg)) {
    return {
      code: "PG_STAT_PERMISSION_DENIED",
      message: "permission denied for pg_stat_statements — grant SELECT to the app role or run as a privileged user"
    };
  }
  if (pgCode === "42P01" || /does not exist/i.test(msg)) {
    return {
      code: "PG_STAT_NOT_INSTALLED",
      message: "pg_stat_statements is not available — run db:migrate (063) and ensure shared_preload_libraries includes it"
    };
  }
  return { code: "PG_STAT_QUERY_FAILED", message: msg.slice(0, 240) };
}

export async function fetchTopPgStatStatements(limitRows = 20, runQuery = query) {
  const ext = await runQuery(`SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'`);
  if (!ext.rowCount) {
    const err = new Error("pg_stat_statements extension is not installed. Run db:migrate first.");
    err.code = "PG_STAT_NOT_INSTALLED";
    throw err;
  }

  return runQuery(
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
    [Math.min(Math.max(limitRows, 1), 100)]
  );
}

async function main() {
  try {
    const result = await fetchTopPgStatStatements(limit);
    if (!result.rowCount) {
      console.log("No pg_stat_statements rows yet — run some API traffic first.");
      return;
    }
    console.log(`Top ${result.rowCount} queries by total time:\n`);
    for (const row of result.rows) {
      console.log(`calls=${row.calls} total_ms=${row.total_ms} mean_ms=${row.mean_ms} rows=${row.rows}`);
      console.log(`  ${row.query_preview}\n`);
    }
  } catch (error) {
    const classified = classifyPgStatError(error);
    console.error(`[${classified.code}] ${classified.message}`);
    process.exitCode = 1;
  }
}

const isCli = process.argv[1] && /pg-stat-report\.mjs$/.test(process.argv[1].replace(/\\/g, "/"));
if (isCli) {
  main().finally(() => pool.end().catch(() => {}));
}
