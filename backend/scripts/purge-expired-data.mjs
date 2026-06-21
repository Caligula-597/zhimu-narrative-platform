#!/usr/bin/env node
/**
 * Purge expired sessions/tokens (Trusted Beta TB-2.6).
 *
 * Usage:
 *   node scripts/purge-expired-data.mjs
 *   node scripts/purge-expired-data.mjs --dry-run
 */
import "dotenv/config";
import { purgeExpiredData } from "../src/data-retention.js";
import { pool } from "../src/db.js";

const dryRun = process.argv.includes("--dry-run");

try {
  const summary = await purgeExpiredData({ dryRun });
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await pool.end();
}
