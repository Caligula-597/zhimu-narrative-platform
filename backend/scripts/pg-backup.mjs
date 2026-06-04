#!/usr/bin/env node
/**
 * PostgreSQL logical backup via pg_dump.
 * Requires pg_dump on PATH and DATABASE_URL in env (or --url).
 *
 * Usage:
 *   node scripts/pg-backup.mjs
 *   node scripts/pg-backup.mjs --out ./backups/zhimu-$(date +%Y%m%d).sql.gz
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const args = process.argv.slice(2);
let outPath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out" && args[i + 1]) {
    outPath = args[++i];
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const defaultDir = join(dirname(fileURLToPath(import.meta.url)), "..", "backups");
mkdirSync(defaultDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = outPath || join(defaultDir, `zhimu-${timestamp}.sql`);

const pgDumpArgs = ["--dbname", databaseUrl, "--no-owner", "--no-acl", "-F", "p", "-f", target];
const result = spawnSync("pg_dump", pgDumpArgs, { encoding: "utf8", shell: process.platform === "win32" });

if (result.error) {
  console.error("Failed to run pg_dump:", result.error.message);
  console.error("Install PostgreSQL client tools and ensure pg_dump is on PATH.");
  process.exit(1);
}

if (result.status !== 0) {
  console.error(result.stderr || "pg_dump failed");
  process.exit(result.status ?? 1);
}

console.log(`Backup written: ${target}`);
