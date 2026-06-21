#!/usr/bin/env node
/**
 * N-1 → latest migration upgrade drill (Trusted Beta TB-4.3).
 * Creates a temp database, applies all migrations except the last one,
 * then applies the final migration and verifies expected schema markers.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "migrations");

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

function requireCli(name) {
  const probe = spawnSync(name, ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
  if (probe.error || probe.status !== 0) {
    console.warn(`skip: ${name} not on PATH`);
    process.exit(0);
  }
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

async function applyMigration(client, filename, sql) {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function columnExists(client, table, column) {
  const result = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return result.rowCount > 0;
}

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

requireCli("psql");

const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
if (files.length < 2) {
  console.error("Need at least 2 migrations for upgrade drill");
  process.exit(1);
}

const penultimate = files.at(-2);
const latest = files.at(-1);
const drillDb = `zhimu_migrate_drill_${Date.now()}`;
const drillUrl = withDatabase(sourceUrl, drillDb);
const pool = new pg.Pool({ connectionString: drillUrl });

try {
  console.log("▶ CREATE DATABASE", drillDb);
  run("psql", [adminDatabaseUrl(sourceUrl), "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${drillDb}"`]);

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    console.log(`▶ Apply migrations through ${penultimate}`);
    for (const filename of files.slice(0, -1)) {
      const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
      await applyMigration(client, filename, sql);
    }

    if (latest.includes("content_revision")) {
      const hasRevision = await columnExists(client, "worlds", "content_revision");
      if (hasRevision) {
        throw new Error(`Expected worlds.content_revision missing before ${latest}`);
      }
    }

    console.log(`▶ Apply final migration ${latest}`);
    const latestSql = await fs.readFile(path.join(migrationsDir, latest), "utf8");
    await applyMigration(client, latest, latestSql);

    if (latest.includes("content_revision")) {
      const hasRevision = await columnExists(client, "worlds", "content_revision");
      if (!hasRevision) throw new Error("worlds.content_revision missing after final migration");
    }

    console.log("✓ Migration upgrade drill passed");
  } finally {
    client.release();
  }
} finally {
  await pool.end().catch(() => {});
  try {
    run("psql", [adminDatabaseUrl(sourceUrl), "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS "${drillDb}"`]);
    console.log("▶ dropped", drillDb);
  } catch (error) {
    console.warn("dropdb warning:", error.message);
  }
}
