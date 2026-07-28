import assert from "node:assert/strict";
import test from "node:test";
import { query } from "../src/db.js";

const REQUIRED_TABLES = [
  "users",
  "worlds",
  "rooms",
  "role_slots",
  "script_sections",
  "clues",
  "clue_ownership",
  "clue_read_receipts",
  "items",
  "inventory",
  "checkpoints",
  "checkpoint_restores",
  "room_recaps",
  "room_event_journal",
  "platform_event_journal",
  "event_outbox",
  "host_audit_log",
  "write_idempotency",
  "automation_rules",
  "rule_executions",
  "pending_host_events",
  "room_content_unlocks",
  "reading_progress",
  "auth_sessions",
  "user_plans",
  "world_member_invites",
  "oauth_accounts",
  "oauth_states",
  "oauth_login_codes",
  "creator_review_threads",
  "user_portal_profiles",
  "portal_profile_avatar_uploads"
];

const CLUE_OWNERSHIP_COLUMNS = [
  "shared_with_room",
  "shared_with_roles",
  "player_note",
  "host_note",
  "shared_at"
];

test("schema migrations applied expected tables", async () => {
  for (const table of REQUIRED_TABLES) {
    const result = await query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    assert.ok(result.rowCount, `missing table: ${table}`);
  }
});

test("clue sharing columns exist on clue_ownership", async () => {
  const result = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'checkpoints' AND column_name = 'schema_version'`
  );
  assert.equal(result.rowCount, 1, "checkpoints.schema_version required");

  for (const column of CLUE_OWNERSHIP_COLUMNS) {
    const col = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'clue_ownership' AND column_name = $1`,
      [column]
    );
    assert.ok(col.rowCount, `missing clue_ownership.${column}`);
  }
});

test("checkpoint restore status enum exists", async () => {
  const result = await query(
    `SELECT 1 FROM pg_type WHERE typname = 'checkpoint_restore_status'`
  );
  assert.equal(result.rowCount, 1);
});

test("event journal retention index migration is applied", async () => {
  const migration = await query(
    `SELECT 1 FROM schema_migrations WHERE filename = '066_room_event_journal_retention_index.sql'`
  );
  const index = await query(
    `SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'room_event_journal'
       AND indexname = 'idx_room_event_journal_created_at'`
  );
  assert.equal(migration.rowCount, 1);
  assert.equal(index.rowCount, 1);
});

test("every applied migration has an immutable checksum", async () => {
  const metadata = await query(
    `SELECT is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'schema_migrations'
       AND column_name = 'checksum'`
  );
  const missing = await query(
    `SELECT filename FROM schema_migrations WHERE checksum IS NULL OR checksum !~ '^[0-9a-f]{64}$'`
  );
  assert.equal(metadata.rows[0]?.is_nullable, "NO", "schema_migrations.checksum must be NOT NULL");
  assert.deepEqual(missing.rows, [], "all applied migrations must have a SHA-256 checksum");
});

test("transactional event outbox migration and dispatch index are present", async () => {
  const migration = await query(
    `SELECT 1 FROM schema_migrations WHERE filename = '067_transactional_event_outbox.sql'`
  );
  const dispatchIndex = await query(
    `SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'event_outbox'
       AND indexname = 'idx_event_outbox_dispatch'`
  );
  assert.equal(migration.rowCount, 1);
  assert.equal(dispatchIndex.rowCount, 1);
});
