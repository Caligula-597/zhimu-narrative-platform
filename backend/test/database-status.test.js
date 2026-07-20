import assert from "node:assert/strict";
import test from "node:test";
import { inspectRequiredDatabaseSchema } from "../src/database-status.js";

const requiredTables = [
  "host_audit_log",
  "write_idempotency",
  "room_event_journal",
  "platform_event_journal",
  "event_outbox",
  "checkpoint_restores",
  "auth_account_creation_events"
];
const requiredMigrations = [
  "084_room_creation_idempotency.sql",
  "085_room_creation_idempotency_index.sql",
  "086_rooms_world_created_index.sql",
  "087_room_members_role_active_index.sql",
  "088_auth_account_creation_events.sql",
  "089_auth_account_creation_events_indexes.sql",
  "090_auth_account_creation_events_user_index.sql"
];

test("database readiness requires the current creator and identity migrations", () => {
  const current = inspectRequiredDatabaseSchema({
    tableNames: requiredTables,
    migrationNames: requiredMigrations
  });
  assert.deepEqual(current, { ok: true, missingTables: [], missingMigrations: [] });

  const stale = inspectRequiredDatabaseSchema({
    tableNames: requiredTables,
    migrationNames: requiredMigrations.slice(0, 1)
  });
  assert.equal(stale.ok, false);
  assert.deepEqual(stale.missingMigrations, requiredMigrations.slice(1));
});
