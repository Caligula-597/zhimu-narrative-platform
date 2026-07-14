import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";
import {
  migrationChecksum,
  planMigrationIntegrity,
  validateMigrationFilenames
} from "./migration-integrity.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "migrations");
const verifyOnly = process.argv.includes("--verify-only");
const MIGRATION_LOCK_KEY = "zhimu:schema-migrations:v1";

/** Renamed migrations — copy applied_at so existing DBs skip re-apply. */
const MIGRATION_RENAMES = [
  ["047_content_platform_runtime.sql", "049_content_platform_runtime.sql"],
  ["049_player_tasks.sql", "050_player_tasks.sql"],
  ["050_player_suspicions.sql", "051_player_suspicions.sql"],
  ["051_testimonies.sql", "052_testimonies.sql"],
  ["052_world_tags.sql", "053_world_tags.sql"],
  ["053_segment_remedies.sql", "054_segment_remedies.sql"],
  ["054_feedback_satisfaction.sql", "055_feedback_satisfaction.sql"],
  ["055_content_platform_rls.sql", "056_content_platform_rls.sql"]
];

async function reconcileMigrationRenames(client) {
  for (const [oldName, newName] of MIGRATION_RENAMES) {
    await client.query(
      `INSERT INTO schema_migrations (filename, applied_at, checksum)
       SELECT $2, applied_at, checksum FROM schema_migrations WHERE filename = $1
       ON CONFLICT (filename) DO NOTHING`,
      [oldName, newName]
    );
    await client.query(`DELETE FROM schema_migrations WHERE filename = $1`, [oldName]);
  }
}

const client = await pool.connect();
let migrationLockAcquired = false;

try {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const lock = await client.query(`SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`, [MIGRATION_LOCK_KEY]);
    migrationLockAcquired = lock.rows[0]?.acquired === true;
    if (migrationLockAcquired) break;
    console.warn(`[migrate] deployment lock busy (${attempt}/30); waiting 2s…`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (!migrationLockAcquired) {
    throw new Error("Another migration runner currently holds the deployment lock");
  }
  if (verifyOnly) {
    const metadata = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'schema_migrations'
         AND column_name IN ('filename', 'checksum')`
    );
    const columns = new Set(metadata.rows.map((row) => row.column_name));
    if (!columns.has("filename") || !columns.has("checksum")) {
      throw new Error("Migration checksum metadata is not initialized; run db:migrate once to establish it");
    }
  } else {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now(),
        checksum text
      )
    `);
    await client.query(`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text`);
    await reconcileMigrationRenames(client);
  }
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  validateMigrationFilenames(files);
  const entries = await Promise.all(files.map(async (filename) => {
    const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
    return { filename, sql, checksum: migrationChecksum(sql) };
  }));
  const applied = await client.query(`SELECT filename, checksum FROM schema_migrations ORDER BY filename`);
  const integrity = planMigrationIntegrity(entries, applied.rows);

  if (integrity.unknown.length) {
    throw new Error(`Applied migrations missing from this release: ${integrity.unknown.join(", ")}`);
  }
  if (integrity.drifted.length) {
    const detail = integrity.drifted
      .map((row) => `${row.filename} (database=${row.expected}, local=${row.actual})`)
      .join("; ");
    throw new Error(`Applied migration checksum mismatch; never edit an applied migration: ${detail}`);
  }
  if (!verifyOnly) {
    for (const row of integrity.baseline) {
      await client.query(
        `UPDATE schema_migrations SET checksum = $2 WHERE filename = $1 AND checksum IS NULL`,
        [row.filename, row.checksum]
      );
      console.warn(`Baselined checksum for historical migration ${row.filename}`);
    }
  }

  if (verifyOnly) {
    if (integrity.baseline.length) {
      throw new Error(
        `${integrity.baseline.length} applied migrations have no checksum baseline; run db:migrate once before verification`
      );
    }
    console.log(`Migration integrity OK (${applied.rowCount} applied, ${integrity.pending.length} pending)`);
  }

  for (const { filename, sql, checksum } of verifyOnly ? [] : entries) {
    if (!integrity.pending.includes(filename)) continue;
    const nonTransactional = /^\s*--\s*migrate:no-transaction\b/im.test(sql);
    if (nonTransactional) {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [filename, checksum]);
      console.log(`Applied ${filename} (non-transactional)`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [filename, checksum]);
      await client.query("COMMIT");
      console.log(`Applied ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  if (!verifyOnly) {
    await client.query(`ALTER TABLE schema_migrations ALTER COLUMN checksum SET NOT NULL`);
  }
} finally {
  if (migrationLockAcquired) {
    await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [MIGRATION_LOCK_KEY]).catch(() => {});
  }
  client.release();
  await pool.end();
}
