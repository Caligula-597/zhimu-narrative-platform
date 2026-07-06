import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "migrations");

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
      `INSERT INTO schema_migrations (filename, applied_at)
       SELECT $2, applied_at FROM schema_migrations WHERE filename = $1
       ON CONFLICT (filename) DO NOTHING`,
      [oldName, newName]
    );
    await client.query(`DELETE FROM schema_migrations WHERE filename = $1`, [oldName]);
  }
}

const client = await pool.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await reconcileMigrationRenames(client);
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const filename of files) {
    const applied = await client.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
    if (applied.rowCount) continue;
    const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      console.log(`Applied ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
