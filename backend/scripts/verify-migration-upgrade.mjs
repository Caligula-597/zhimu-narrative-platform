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
import "dotenv/config";
import { migrationChecksum, validateMigrationFilenames } from "./migration-integrity.mjs";
import { assertSafeDatabaseUrlForDestructiveOps } from "./lib/assert-safe-database-url.mjs";
import { assertPgClientAvailable, runPgTool } from "./pg-bin.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "migrations");

function runPsql(args, opts = {}) {
  const result = runPgTool("psql", args, { spawnSync, ...opts });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "psql failed").trim());
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

async function applyMigration(client, filename, sql) {
  const checksum = migrationChecksum(sql);
  if (/^\s*--\s*migrate:no-transaction\b/im.test(sql)) {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [filename, checksum]);
    return;
  }
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [filename, checksum]);
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

async function tableExists(client, table) {
  const result = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return result.rowCount > 0;
}

async function indexExists(client, index) {
  const result = await client.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`,
    [index]
  );
  return result.rowCount > 0;
}

async function constraintDefinition(client, table, constraint) {
  const result = await client.query(
    `SELECT pg_get_constraintdef(oid) AS definition
     FROM pg_constraint
     WHERE conrelid = to_regclass($1) AND conname = $2`,
    [`public.${table}`, constraint]
  );
  return result.rows[0]?.definition || "";
}

async function latestMigrationMarkerExists(client, filename) {
  if (filename.startsWith("110_room_experience_states")) {
    return tableExists(client, "room_experience_states");
  }
  if (filename.startsWith("111_communication_templates")) {
    const actionType = await constraintDefinition(
      client,
      "room_private_actions",
      "room_private_actions_action_type_check"
    );
    const visibility = await constraintDefinition(
      client,
      "room_private_actions",
      "room_private_actions_visibility_check"
    );
    return actionType.includes("public_statement") && visibility.includes("public");
  }
  if (filename.startsWith("112_mini_game_protocol")) {
    return columnExists(client, "room_mini_games", "protocol_version");
  }
  return null;
}

async function assertCurrentRoomExperienceSchema(client) {
  if (!await tableExists(client, "room_experience_states")) {
    throw new Error("room_experience_states missing after migration upgrade");
  }
  for (const column of [
    "state_kind",
    "scope_key",
    "subject_key",
    "schema_version",
    "visibility",
    "payload",
    "revision",
    "expires_at"
  ]) {
    if (!await columnExists(client, "room_experience_states", column)) {
      throw new Error(`room_experience_states.${column} missing after migration upgrade`);
    }
  }
  for (const index of [
    "room_experience_states_room_kind_updated_idx",
    "room_experience_states_expiry_idx",
    "room_private_actions_public_idx",
    "room_mini_games_active_deadline_idx"
  ]) {
    if (!await indexExists(client, index)) {
      throw new Error(`${index} missing after migration upgrade`);
    }
  }
  const rls = await client.query(
    `SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.room_experience_states')`
  );
  if (rls.rows[0]?.relrowsecurity !== true) {
    throw new Error("room_experience_states row-level security is not enabled");
  }

  const actionType = await constraintDefinition(
    client,
    "room_private_actions",
    "room_private_actions_action_type_check"
  );
  const visibility = await constraintDefinition(
    client,
    "room_private_actions",
    "room_private_actions_visibility_check"
  );
  if (!actionType.includes("public_statement")) {
    throw new Error("room_private_actions public_statement contract missing after migration upgrade");
  }
  if (!visibility.includes("public")) {
    throw new Error("room_private_actions public visibility contract missing after migration upgrade");
  }

  for (const column of ["protocol_version", "deadline_at", "revision", "settlement"]) {
    if (!await columnExists(client, "room_mini_games", column)) {
      throw new Error(`room_mini_games.${column} missing after migration upgrade`);
    }
  }
  const miniGameStatus = await constraintDefinition(
    client,
    "room_mini_games",
    "room_mini_games_status_check"
  );
  for (const status of ["active", "completed", "failed", "timed_out", "skipped"]) {
    if (!miniGameStatus.includes(status)) {
      throw new Error(`room_mini_games status ${status} missing after migration upgrade`);
    }
  }
}

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
assertSafeDatabaseUrlForDestructiveOps(sourceUrl, { opName: "verify-migration-upgrade" });

assertPgClientAvailable();

const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
validateMigrationFilenames(files);
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
  runPsql([adminDatabaseUrl(sourceUrl), "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${drillDb}"`]);

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now(),
        checksum text NOT NULL
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
    if (latest.includes("event_outbox") && await tableExists(client, "event_outbox")) {
      throw new Error(`Expected event_outbox missing before ${latest}`);
    }
    const markerBefore = await latestMigrationMarkerExists(client, latest);
    if (markerBefore === true) {
      throw new Error(`Expected ${latest} schema marker to be absent before the final migration`);
    }

    console.log(`▶ Apply final migration ${latest}`);
    const latestSql = await fs.readFile(path.join(migrationsDir, latest), "utf8");
    await applyMigration(client, latest, latestSql);

    if (latest.includes("content_revision")) {
      const hasRevision = await columnExists(client, "worlds", "content_revision");
      if (!hasRevision) throw new Error("worlds.content_revision missing after final migration");
    }
    if (latest.includes("event_outbox") && !(await tableExists(client, "event_outbox"))) {
      throw new Error("event_outbox missing after final migration");
    }
    const markerAfter = await latestMigrationMarkerExists(client, latest);
    if (markerAfter === false) {
      throw new Error(`Expected ${latest} schema marker after the final migration`);
    }
    await assertCurrentRoomExperienceSchema(client);

    console.log("✓ Migration upgrade drill passed");
  } finally {
    client.release();
  }
} finally {
  await pool.end().catch(() => {});
  try {
    runPsql([adminDatabaseUrl(sourceUrl), "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS "${drillDb}"`]);
    console.log("▶ dropped", drillDb);
  } catch (error) {
    console.warn("dropdb warning:", error.message);
  }
}
