import assert from "node:assert/strict";
import test from "node:test";
import {
  appendRoomMechanismAction,
  grantMechanismClueOwnership,
  insertRoomMechanismState,
  replaceRoomMechanismState,
  updateRoomMechanismRuntime,
} from "../src/repositories/room-mechanism-runtime-repository.js";

function storedRow({ revision = 1 } = {}) {
  return {
    room_id: "room-1",
    mechanism_schema_version: 1,
    content_binding_mode: "release",
    content_release_id: "release-1",
    source_content_revision: 8,
    mechanism_package_sha256: "a".repeat(64),
    status: "running",
    current_round_key: "round-1",
    current_round_sequence: 1,
    prepared_round_key: "round-1",
    current_branch: "pass",
    current_variant_key: "default",
    state_values: { "state-auth": "unknown" },
    resource_values: { "review-seat": 2 },
    evidence_states: {},
    event_states: {},
    decision_states: {},
    executed_investigations: {},
    ending: null,
    revision,
    initialized_by_user_id: "user-host",
    initialized_at: new Date("2026-08-06T00:00:00.000Z"),
    round_started_at: new Date("2026-08-06T00:05:00.000Z"),
    updated_at: new Date("2026-08-06T00:00:00.000Z"),
    metadata: {},
  };
}

function runtime() {
  return {
    status: "running",
    currentRoundKey: "round-1",
    currentRoundSequence: 1,
    preparedRoundKey: "round-1",
    currentBranch: "pass",
    currentVariantKey: "default",
    states: { "state-auth": "unknown" },
    resources: { "review-seat": 2 },
    evidence: {},
    events: {},
    decisionStates: {},
    executedInvestigations: {},
    ending: null,
  };
}

function assertingClient(row = storedRow()) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      const indexes = [...sql.matchAll(/\$(\d+)/g)].map((match) =>
        Number(match[1]),
      );
      const highestPlaceholder = indexes.length > 0 ? Math.max(...indexes) : 0;
      assert.equal(
        highestPlaceholder,
        params.length,
        "SQL placeholders must match the supplied parameter list",
      );
      return {
        rows: [
          sql.includes("room_mechanism_action_log")
            ? { id: "action-1", created_at: row.updated_at }
            : row,
        ],
      };
    },
  };
}

const binding = {
  roomId: "room-1",
  mechanismSchemaVersion: 1,
  contentBindingMode: "release",
  contentReleaseId: "release-1",
  sourceContentRevision: 8,
  mechanismPackageSha256: "a".repeat(64),
  actorId: "user-host",
  metadata: { source: "test" },
};

test("room mechanism state writes keep SQL parameters and persisted runtime fields aligned", async () => {
  const insertClient = assertingClient();
  const inserted = await insertRoomMechanismState(insertClient, {
    ...binding,
    runtime: runtime(),
  });
  assert.equal(inserted.revision, 1);
  assert.equal(
    inserted.roundStartedAt.toISOString(),
    "2026-08-06T00:05:00.000Z",
  );
  assert.deepEqual(inserted.runtime.resources, { "review-seat": 2 });
  assert.equal(insertClient.calls[0].params.length, 21);
  assert.equal(
    insertClient.calls[0].params[12],
    JSON.stringify({ "state-auth": "unknown" }),
  );

  const replaceClient = assertingClient(storedRow({ revision: 2 }));
  const replaced = await replaceRoomMechanismState(replaceClient, {
    ...binding,
    expectedRevision: 1,
    runtime: runtime(),
  });
  assert.equal(replaced.revision, 2);
  assert.equal(replaceClient.calls[0].params.length, 22);

  const updateClient = assertingClient(storedRow({ revision: 3 }));
  const updated = await updateRoomMechanismRuntime(updateClient, {
    roomId: "room-1",
    expectedRevision: 2,
    runtime: runtime(),
    restartRoundClock: true,
  });
  assert.equal(updated.revision, 3);
  assert.equal(updateClient.calls[0].params.length, 16);
  assert.equal(updateClient.calls[0].params[15], true);
});

test("room mechanism action log persists the revision edge and structured changes", async () => {
  const client = assertingClient();
  const result = await appendRoomMechanismAction(client, {
    roomId: "room-1",
    actorId: "user-host",
    revisionBefore: 2,
    revisionAfter: 3,
    roundKey: "round-1",
    actionType: "decision",
    actionKey: "decision-auth",
    optionKey: "accept",
    changes: [
      { targetType: "state", targetKey: "state-auth", after: "accepted" },
    ],
    request: { expectedRevision: 2 },
    metadata: { source: "host-api" },
  });

  assert.equal(result.id, "action-1");
  assert.equal(client.calls[0].params.length, 11);
  assert.deepEqual(JSON.parse(client.calls[0].params[8]), [
    {
      targetType: "state",
      targetKey: "state-auth",
      after: "accepted",
    },
  ]);
});

test("mechanism clue ownership uses the unique row as its idempotency boundary", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rowCount: calls.length === 1 ? 1 : 0,
        rows: calls.length === 1
          ? [{ acquired_at: new Date("2026-08-08T12:00:00.000Z") }]
          : [],
      };
    },
  };
  const input = {
    roomId: "room-1",
    roleSlotId: "role-1",
    clueId: "clue-1",
    metadata: { mechanismRevision: 3 },
  };
  const first = await grantMechanismClueOwnership(client, input);
  const duplicate = await grantMechanismClueOwnership(client, input);
  assert.equal(first.granted, true);
  assert.equal(duplicate.granted, false);
  assert.match(calls[0].sql, /ON CONFLICT \(room_id, role_slot_id, clue_id\) DO NOTHING/);
  assert.deepEqual(JSON.parse(calls[0].params[3]), {
    source: "mechanism_settlement",
    mechanismRevision: 3,
  });
});
