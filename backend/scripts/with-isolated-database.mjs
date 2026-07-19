#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
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

function resolveInvocation(rawCommand, rawArgs) {
  if (process.platform !== "win32" || !/^(npm|npx)$/i.test(rawCommand)) {
    return { executable: rawCommand, args: rawArgs };
  }
  const cliName = rawCommand.toLowerCase() === "npx" ? "npx-cli.js" : "npm-cli.js";
  const cliPath = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", cliName);
  return { executable: process.execPath, args: [cliPath, ...rawArgs] };
}

async function dropIsolatedDatabase() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      // FORCE closes pooler sessions atomically with the drop and avoids the
      // terminate-then-drop race seen on managed PostgreSQL.
      await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      console.log(`[isolated-db] dropped ${dbName}`);
      return;
    } catch (error) {
      lastError = error;
      if (error.code !== "55006" || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 100));
    }
  }
  throw lastError;
}

await client.connect();
try {
  await client.query(`CREATE DATABASE "${dbName}"`);
  console.log(`[isolated-db] created ${dbName}`);
  const invocation = resolveInvocation(command, commandArgs);
  const result = spawnSync(invocation.executable, invocation.args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
    env: { ...process.env, DATABASE_URL: isolated.toString(), ZHIMU_FIXTURE_NAMESPACE: dbName }
  });
  if (result.error) console.error(`[isolated-db] command failed to start: ${result.error.message}`);
  process.exitCode = result.status ?? 1;
} finally {
  try {
    await dropIsolatedDatabase();
  } finally {
    await client.end();
  }
}
