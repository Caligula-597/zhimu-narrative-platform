#!/usr/bin/env node
/**
 * Remove automated-test beta applications (@example.invalid) from production DB.
 * Usage: node backend/scripts/cleanup-test-beta-applications.mjs [--dry-run]
 */
import pg from "pg";
import "dotenv/config";
import {
  resolveDatabaseSsl,
  resolveDatabaseUrl
} from "../src/database-connection-options.js";

const { Client } = pg;
const dryRun = process.argv.includes("--dry-run");

const client = new Client({
  connectionString: resolveDatabaseUrl(),
  ssl: resolveDatabaseSsl()
});
await client.connect();

const preview = await client.query(
  `SELECT id, email, display_name, status, created_at
   FROM beta_applications
   WHERE lower(email) LIKE '%@example.invalid'
   ORDER BY created_at`
);

console.log(`Found ${preview.rowCount} test beta application(s) (@example.invalid):`);
for (const row of preview.rows) {
  console.log(`  - ${row.email} (${row.status}) ${row.created_at.toISOString().slice(0, 10)}`);
}

if (!preview.rowCount) {
  await client.end();
  process.exit(0);
}

if (dryRun) {
  console.log("\nDry run — no rows deleted.");
  await client.end();
  process.exit(0);
}

const deleted = await client.query(
  `DELETE FROM beta_applications WHERE lower(email) LIKE '%@example.invalid' RETURNING id, email`
);
console.log(`\nDeleted ${deleted.rowCount} row(s).`);
await client.end();
