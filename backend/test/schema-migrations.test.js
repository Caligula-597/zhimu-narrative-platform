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
  "oauth_login_codes"
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