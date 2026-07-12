#!/usr/bin/env node
/**
 * Automated backup → restore → row-count verification drill (Trusted Beta TB-2.1).
 * Requires pg_dump, psql, createdb, dropdb on PATH and DATABASE_URL in env.
 *
 * Usage:
 *   node scripts/verify-backup-restore.mjs
 *   node scripts/verify-backup-restore.mjs --keep
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePgTool } from "./pg-bin.mjs";
import { assertSafeDatabaseUrlForDestructiveOps } from "./lib/assert-safe-database-url.mjs";
import "dotenv/config";

const REQUIRED_TABLES = ["users", "worlds", "chapters", "asset_files", "auth_sessions", "schema_migrations"];

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD },
    ...opts
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${cmd} failed`).trim());
  }
  return (result.stdout || "").trim();
}

function adminDatabaseUrl(url) {
  const parsed = new URL(url);
  parsed.pathname = "/postgres";
  return parsed.toString();
}

function withDatabase(url, dbName) {
  const parsed = new URL(url);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

function pgTool(name) {
  return resolvePgTool(name);
}

function listTables(databaseUrl) {
  const out = run(pgTool("psql"), [databaseUrl, "-t", "-A", "-c",
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"]);
  return out.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
}

function countTables(databaseUrl, tables) {
  const counts = {};
  for (const table of tables) {
    if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error(`Unsafe table identifier: ${table}`);
    const out = run(pgTool("psql"), [databaseUrl, "-t", "-A", "-c", `SELECT COUNT(*) FROM "${table}"`]);
    counts[table] = Number(out);
  }
  return counts;
}

function compareCounts(source, restored) {
  const mismatches = [];
  for (const table of Object.keys(source)) {
    if (source[table] !== restored[table]) {
      mismatches.push({ table, source: source[table], restored: restored[table] });
    }
  }
  return mismatches;
}

const keep = process.argv.includes("--keep");
const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
assertSafeDatabaseUrlForDestructiveOps(sourceUrl, { opName: "verify-backup-restore" });

function requireCli(name) {
  const probe = spawnSync(name, ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
  if (probe.error || probe.status !== 0) {
    console.error(`${name} not on PATH — restore evidence cannot be produced`);
    process.exit(1);
  }
}

requireCli(pgTool("psql"));
requireCli(pgTool("pg_dump"));

const drillDb = `zhimu_restore_drill_${Date.now()}`;
const restoreUrl = withDatabase(sourceUrl, drillDb);
const workDir = mkdtempSync(join(tmpdir(), "zhimu-restore-drill-"));
const dumpPath = join(workDir, "backup.sql");

try {
  console.log("▶ Counting source tables…");
  const tables = listTables(sourceUrl);
  const missing = REQUIRED_TABLES.filter((table) => !tables.includes(table));
  if (missing.length) throw new Error(`Source database missing required tables: ${missing.join(", ")}`);
  const before = countTables(sourceUrl, tables);
  console.log(before);

  console.log("▶ pg_dump →", dumpPath);
  run(pgTool("pg_dump"), ["--dbname", sourceUrl, "--no-owner", "--no-acl", "-F", "p", "-f", dumpPath]);

  console.log("▶ CREATE DATABASE", drillDb);
  run(pgTool("psql"), [adminDatabaseUrl(sourceUrl), "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${drillDb}"`]);

  console.log("▶ psql restore…");
  run(pgTool("psql"), [restoreUrl, "-v", "ON_ERROR_STOP=1", "-f", dumpPath]);

  console.log("▶ Counting restored tables…");
  const restoredTables = listTables(restoreUrl);
  if (JSON.stringify(restoredTables) !== JSON.stringify(tables)) {
    throw new Error("Restored public table inventory does not match source");
  }
  const after = countTables(restoreUrl, tables);
  console.log(after);

  const mismatches = compareCounts(before, after);
  if (mismatches.length) {
    console.error("✗ Row count mismatch:", mismatches);
    process.exit(1);
  }

  console.log("✓ Backup restore drill passed — all table counts match");
} finally {
  if (!keep) {
    try {
      run(pgTool("psql"), [adminDatabaseUrl(sourceUrl), "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS "${drillDb}"`]);
      console.log("▶ dropped", drillDb);
    } catch (error) {
      console.warn("dropdb warning:", error.message);
    }
  } else {
    console.log(`--keep: restored database left at ${drillDb}`);
  }
  rmSync(workDir, { recursive: true, force: true });
}
