#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import pg from "pg";
import "dotenv/config";
import { assertSafeDatabaseUrlForDestructiveOps } from "./lib/assert-safe-database-url.mjs";

const separator = process.argv.indexOf("--");
const command = separator >= 0 ? process.argv[separator + 1] : null;
const commandArgs = separator >= 0 ? process.argv.slice(separator + 2) : [];
if (!command || !process.env.DATABASE_URL) {
  console.error("Usage: DATABASE_URL=... node scripts/with-isolated-database.mjs -- <command> [...args]");
  process.exit(2);
}

assertSafeDatabaseUrlForDestructiveOps(process.env.DATABASE_URL, {
  opName: "with-isolated-database"
});

const source = new URL(process.env.DATABASE_URL);
const dbName = `zhimu_verify_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const admin = new URL(source);
admin.pathname = "/postgres";
const isolated = new URL(source);
isolated.pathname = `/${dbName}`;
const client = new pg.Client({ connectionString: admin.toString() });

await client.connect();
try {
  await client.query(`CREATE DATABASE "${dbName}"`);
  console.log(`[isolated-db] created ${dbName}`);
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, DATABASE_URL: isolated.toString(), ZHIMU_FIXTURE_NAMESPACE: dbName }
  });
  process.exitCode = result.status ?? 1;
} finally {
  await client.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [dbName]
  ).catch(() => {});
  await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  console.log(`[isolated-db] dropped ${dbName}`);
  await client.end();
}
