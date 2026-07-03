#!/usr/bin/env node
/**
 * Backup drill for managed Postgres (Supabase/Railway): clone core tables into
 * a temporary schema, verify row counts match, then drop the schema.
 * No pg_dump / CREATE DATABASE required — only node `pg` + DATABASE_URL.
 *
 * Usage:
 *   node scripts/verify-backup-restore-managed.mjs
 *   node scripts/verify-backup-restore-managed.mjs --keep
 */
import pg from "pg";
import "dotenv/config";

const { Client } = pg;
const TABLES = ["users", "worlds", "chapters", "asset_files", "auth_sessions"];
const keep = process.argv.includes("--keep");

async function countTables(client, schema) {
  const counts = {};
  for (const table of TABLES) {
    const qualified = schema === "public" ? table : `${schema}.${table}`;
    const result = await client.query(`SELECT COUNT(*)::int AS n FROM ${qualified}`);
    counts[table] = result.rows[0].n;
  }
  return counts;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const schema = `zhimu_drill_${Date.now()}`;
  const startedAt = new Date().toISOString();
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    console.log("▶ Counting source tables (public)…");
    const before = await countTables(client, "public");
    console.log(before);

    console.log("▶ CREATE SCHEMA", schema);
    await client.query(`CREATE SCHEMA ${schema}`);

    console.log("▶ Cloning tables into drill schema…");
    for (const table of TABLES) {
      await client.query(`CREATE TABLE ${schema}.${table} AS TABLE public.${table} WITH NO DATA`);
      await client.query(`INSERT INTO ${schema}.${table} SELECT * FROM public.${table}`);
    }

    console.log("▶ Counting restored clone…");
    const after = await countTables(client, schema);
    console.log(after);

    const mismatches = TABLES.filter((table) => before[table] !== after[table]).map((table) => ({
      table,
      source: before[table],
      restored: after[table]
    }));

    if (mismatches.length) {
      console.error("✗ Row count mismatch:", mismatches);
      process.exit(1);
    }

    const record = {
      passed: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      mode: "managed-schema-clone",
      drillSchema: schema,
      databaseHost: new URL(databaseUrl).hostname,
      sourceCounts: before,
      restoredCounts: after
    };
    console.log("✓ Managed backup restore drill passed — clone row counts match source");
    console.log(JSON.stringify(record, null, 2));
  } finally {
    if (!keep) {
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      console.log("▶ dropped schema", schema);
    } else {
      console.log(`--keep: schema ${schema} left for inspection`);
    }
    await client.end();
  }
}

main().catch((error) => {
  console.error("✗ Drill failed:", error.message);
  process.exit(1);
});
