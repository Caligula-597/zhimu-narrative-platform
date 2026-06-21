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
import "dotenv/config";

const TABLES = ["users", "worlds", "chapters", "asset_files", "auth_sessions"];

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

function countTables(databaseUrl) {
  const counts = {};
  for (const table of TABLES) {
    const out = run("psql", [databaseUrl, "-t", "-A", "-c", `SELECT COUNT(*) FROM ${table}`]);
    counts[table] = Number(out);
  }
  return counts;
}

function compareCounts(source, restored) {
  const mismatches = [];
  for (const table of TABLES) {
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

function requireCli(name) {
  const probe = spawnSync(name, ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
  if (probe.error || probe.status !== 0) {
    console.warn(`skip: ${name} not on PATH — install PostgreSQL client tools to run restore drill`);
    process.exit(0);
  }
}

requireCli("psql");
requireCli("pg_dump");

const drillDb = `zhimu_restore_drill_${Date.now()}`;
const restoreUrl = withDatabase(sourceUrl, drillDb);
const workDir = mkdtempSync(join(tmpdir(), "zhimu-restore-drill-"));
const dumpPath = join(workDir, "backup.sql");

try {
  console.log("▶ Counting source tables…");
  const before = countTables(sourceUrl);
  console.log(before);

  console.log("▶ pg_dump →", dumpPath);
  run("pg_dump", ["--dbname", sourceUrl, "--no-owner", "--no-acl", "-F", "p", "-f", dumpPath]);

  console.log("▶ CREATE DATABASE", drillDb);
  run("psql", [adminDatabaseUrl(sourceUrl), "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${drillDb}"`]);

  console.log("▶ psql restore…");
  run("psql", [restoreUrl, "-v", "ON_ERROR_STOP=1", "-f", dumpPath]);

  console.log("▶ Counting restored tables…");
  const after = countTables(restoreUrl);
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
      run("psql", [adminDatabaseUrl(sourceUrl), "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS "${drillDb}"`]);
      console.log("▶ dropped", drillDb);
    } catch (error) {
      console.warn("dropdb warning:", error.message);
    }
  } else {
    console.log(`--keep: restored database left at ${drillDb}`);
  }
  rmSync(workDir, { recursive: true, force: true });
}
