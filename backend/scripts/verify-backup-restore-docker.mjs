#!/usr/bin/env node
/**
 * Backup → restore drill for managed Postgres (Supabase/Railway):
 * pg_dump remote DATABASE_URL, restore into ephemeral Docker Postgres, compare row counts.
 *
 * Requires: Docker daemon, DATABASE_URL in env (backend/.env via dotenv).
 *
 * Usage:
 *   node scripts/verify-backup-restore-docker.mjs
 *   node scripts/verify-backup-restore-docker.mjs --keep
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import "dotenv/config";

const TABLES = ["users", "worlds", "chapters", "asset_files", "auth_sessions"];
const PG_IMAGE = process.env.PG_DRILL_IMAGE || "postgres:17";
const keep = process.argv.includes("--keep");

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: false,
    ...opts
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${cmd} failed`).trim());
  }
  return (result.stdout || "").trim();
}

function docker(args, opts = {}) {
  return run("docker", args, opts);
}

function requireDocker() {
  const probe = spawnSync("docker", ["info"], { encoding: "utf8", shell: false });
  if (probe.error || probe.status !== 0) {
    console.error("Docker is required for verify-backup-restore-docker.mjs");
    process.exit(1);
  }
}

function countTablesInContainer(containerName) {
  const counts = {};
  for (const table of TABLES) {
    const out = docker([
      "exec",
      containerName,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-t",
      "-A",
      "-c",
      `SELECT COUNT(*) FROM public.${table}`
    ]);
    counts[table] = Number(out);
  }
  return counts;
}

async function countSourceTables(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const counts = {};
    for (const table of TABLES) {
      const result = await client.query(`SELECT COUNT(*)::int AS n FROM public.${table}`);
      counts[table] = result.rows[0].n;
    }
    return counts;
  } finally {
    await client.end();
  }
}

function waitForPostgres(containerName, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    const probe = spawnSync(
      "docker",
      ["exec", containerName, "pg_isready", "-U", "postgres"],
      { encoding: "utf8", shell: false }
    );
    if (probe.status === 0) return;
    spawnSync("powershell", ["-Command", "Start-Sleep -Seconds 1"], { shell: true });
  }
  throw new Error("Docker Postgres did not become ready in time");
}

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

requireDocker();

const containerName = `zhimu_restore_drill_${Date.now()}`;
const workDir = mkdtempSync(join(tmpdir(), "zhimu-restore-docker-"));
const dumpPath = join(workDir, "backup.sql");
const startedAt = new Date().toISOString();

try {
  console.log("▶ Counting source tables (remote via pg)…");
  const before = await countSourceTables(sourceUrl);
  console.log(before);

  console.log("▶ pg_dump remote →", dumpPath);
  docker([
    "run",
    "--rm",
    "-e",
    `DATABASE_URL=${sourceUrl}`,
    "-v",
    `${workDir}:/work`,
    PG_IMAGE,
    "pg_dump",
    sourceUrl,
    "--no-owner",
    "--no-acl",
    "-F",
    "p",
    "-f",
    "/work/backup.sql"
  ]);

  const dumpSize = readFileSync(dumpPath).length;
  console.log(`▶ dump size: ${(dumpSize / 1024 / 1024).toFixed(2)} MB`);

  console.log("▶ Starting ephemeral Postgres container", containerName);
  docker([
    "run",
    "-d",
    "--name",
    containerName,
    "-e",
    "POSTGRES_PASSWORD=drill",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    PG_IMAGE
  ]);
  waitForPostgres(containerName);

  console.log("▶ Restoring dump into container…");
  const dumpSql = readFileSync(dumpPath, "utf8");
  const restore = spawnSync(
    "docker",
    ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=0"],
    { input: dumpSql, encoding: "utf8", shell: false }
  );
  if (restore.status !== 0 && !/ERROR/.test(restore.stderr || "")) {
    throw new Error((restore.stderr || restore.stdout || "restore failed").trim());
  }

  console.log("▶ Counting restored tables…");
  const after = countTablesInContainer(containerName);
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
    mode: "docker-restore",
    pgImage: PG_IMAGE,
    dumpBytes: dumpSize,
    sourceCounts: before,
    restoredCounts: after,
    databaseHost: new URL(sourceUrl).hostname
  };
  writeFileSync(join(workDir, "drill-result.json"), JSON.stringify(record, null, 2));
  console.log("✓ Backup restore drill passed — all table counts match");
  console.log(JSON.stringify(record, null, 2));
} finally {
  if (!keep) {
    spawnSync("docker", ["rm", "-f", containerName], { encoding: "utf8", shell: false });
    console.log("▶ removed container", containerName);
  } else {
    console.log(`--keep: container ${containerName} and ${dumpPath} left for inspection`);
  }
  if (!keep) rmSync(workDir, { recursive: true, force: true });
}
