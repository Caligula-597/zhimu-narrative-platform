import assert from "node:assert/strict";
import test from "node:test";
import { inspectRequiredDatabaseSchema } from "../src/database-status.js";

const requiredTables = [
  "auth_sessions",
  "beta_applications",
  "host_audit_log",
  "storage_quotas",
  "user_plans",
  "users",
  "write_idempotency",
  "room_event_journal",
  "platform_event_journal",
  "event_outbox",
  "checkpoint_restores",
  "auth_account_creation_events",
  "creator_review_threads",
  "world_releases"
];
const requiredMigrations = [
  "084_room_creation_idempotency.sql",
  "085_room_creation_idempotency_index.sql",
  "086_rooms_world_created_index.sql",
  "087_room_members_role_active_index.sql",
  "088_auth_account_creation_events.sql",
  "089_auth_account_creation_events_indexes.sql",
  "090_auth_account_creation_events_user_index.sql",
  "091_creator_review_workflow.sql",
  "092_narrative_profile_settings.sql",
  "093_world_releases.sql",
  "094_room_release_binding.sql",
  "095_account_deletion_integrity.sql",
  "096_foreign_key_index_coverage.sql",
  "097_enable_rls_post_launch_tables.sql",
  "098_play_plaza_reply_review.sql",
  "099_account_delete_job_claims.sql",
  "100_identity_foundation_integrity.sql"
];

test("database readiness requires the current creator and identity migrations", () => {
  const current = inspectRequiredDatabaseSchema({
    tableNames: requiredTables,
    migrationNames: requiredMigrations
  });
  assert.deepEqual(current, {
    ok: true,
    missingTables: [],
    missingMigrations: [],
    missingRlsTables: []
  });

  const stale = inspectRequiredDatabaseSchema({
    tableNames: requiredTables,
    migrationNames: requiredMigrations.slice(0, 1)
  });
  assert.equal(stale.ok, false);
  assert.deepEqual(stale.missingMigrations, requiredMigrations.slice(1));

  const rlsDisabled = inspectRequiredDatabaseSchema({
    tableNames: requiredTables,
    migrationNames: requiredMigrations,
    rlsTableNames: requiredTables.slice(1)
  });
  assert.equal(rlsDisabled.ok, false);
  assert.deepEqual(rlsDisabled.missingRlsTables, [requiredTables[0]]);
});
