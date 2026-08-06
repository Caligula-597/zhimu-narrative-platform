import assert from "node:assert/strict";
import test from "node:test";
import { restoreMechanismRuntimeFromCheckpoint } from "../src/checkpoint-restore.js";

function stateRow({ revision, runtime }) {
  return {
    room_id: "room-1",
    mechanism_schema_version: 1,
    content_binding_mode: "release",
    content_release_id: "release-1",
    source_content_revision: 8,
    mechanism_package_sha256: "b".repeat(64),
    status: runtime.status,
    current_round_key: runtime.currentRoundKey,
    current_round_sequence: runtime.currentRoundSequence,
    prepared_round_key: runtime.preparedRoundKey,
    current_branch: runtime.currentBranch,
    current_variant_key: runtime.currentVariantKey,
    state_values: runtime.states,
    resource_values: runtime.resources,
    evidence_states: runtime.evidence,
    event_states: runtime.events,
    decision_states: runtime.decisionStates,
    executed_investigations: runtime.executedInvestigations,
    ending: runtime.ending,
    revision,
    initialized_by_user_id: "user-host",
    initialized_at: new Date("2026-08-06T00:00:00.000Z"),
    updated_at: new Date("2026-08-06T00:10:00.000Z"),
    metadata: {}
  };
}

const capturedRuntime = {
  schemaVersion: 1,
  mechanismSchemaVersion: 1,
  status: "running",
  currentRoundKey: "round-2",
  currentRoundSequence: 2,
  preparedRoundKey: "round-2",
  currentBranch: "read_pass",
  currentVariantKey: "full-review",
  states: { "state-auth": "accepted" },
  resources: { "review-seat": 1 },
  evidence: { "evidence-log": "available" },
  events: {},
  decisionStates: { "decision-auth": "accept" },
  executedInvestigations: {},
  ending: null
};

const captured = {
  mechanismSchemaVersion: 1,
  contentBindingMode: "release",
  contentReleaseId: "release-1",
  sourceContentRevision: 8,
  mechanismPackageSha256: "b".repeat(64),
  capturedRevision: 2,
  runtime: capturedRuntime
};

test("checkpoint mechanism restore preserves monotonic revisions and appends an override edge", async () => {
  const currentRuntime = { ...capturedRuntime, currentRoundKey: "round-4", currentRoundSequence: 4 };
  const currentRow = stateRow({ revision: 5, runtime: currentRuntime });
  const restoredRow = stateRow({ revision: 6, runtime: capturedRuntime });
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("SELECT") && sql.includes("room_mechanism_states")) return { rows: [currentRow] };
      if (sql.includes("UPDATE room_mechanism_states")) return { rows: [restoredRow] };
      if (sql.includes("INSERT INTO room_mechanism_action_log")) {
        return { rows: [{ id: "action-restore", created_at: new Date() }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const result = await restoreMechanismRuntimeFromCheckpoint(client, {
    roomId: "room-1",
    sourceRoomId: "room-1",
    actorId: "user-host",
    captured,
    checkpointId: "checkpoint-1",
    restoreId: "restore-1"
  });

  assert.deepEqual(result, { applied: true, revisionBefore: 5, revisionAfter: 6 });
  const actionCall = calls.find((call) => call.sql.includes("room_mechanism_action_log"));
  assert.equal(actionCall.params[2], 5);
  assert.equal(actionCall.params[3], 6);
  assert.equal(actionCall.params[5], "override");
  assert.equal(JSON.parse(actionCall.params[9]).checkpointId, "checkpoint-1");
});

test("checkpoint mechanism runtime cannot be copied across rooms", async () => {
  await assert.rejects(
    () => restoreMechanismRuntimeFromCheckpoint({ query: async () => ({ rows: [] }) }, {
      roomId: "room-2",
      sourceRoomId: "room-1",
      actorId: "user-host",
      captured
    }),
    (error) => error.code === "CHECKPOINT_MECHANISM_CROSS_ROOM_UNSUPPORTED"
  );
});
