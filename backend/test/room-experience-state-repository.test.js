import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteRoomExperienceState,
  findRoomExperienceState,
  insertRoomExperienceState,
  listRoomExperienceStates,
  updateRoomExperienceState,
} from "../src/repositories/room-experience-state-repository.js";

function row({ revision = 1, scopeKey = "main" } = {}) {
  return {
    room_id: "room-1",
    state_kind: "pace_clock",
    scope_key: scopeKey,
    subject_key: "room",
    schema_version: 1,
    visibility: "room",
    payload: { status: "running" },
    revision,
    created_by_user_id: "host-1",
    updated_by_user_id: "host-1",
    expires_at: null,
    created_at: new Date("2026-08-11T10:00:00Z"),
    updated_at: new Date("2026-08-11T10:00:00Z"),
  };
}

function clientFor(rows = [row()], rowCount = rows.length) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      const indexes = [...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
      assert.equal(Math.max(0, ...indexes), params.length, "SQL placeholders must match params");
      return { rows, rowCount };
    },
  };
}

const state = {
  roomId: "room-1",
  stateKind: "pace_clock",
  scopeKey: "main",
  subjectKey: "room",
  schemaVersion: 1,
  visibility: "room",
  payload: { status: "running" },
  actorId: "host-1",
};

test("experience repository projects state and supports locking reads", async () => {
  const client = clientFor();
  const found = await findRoomExperienceState("room-1", {
    stateKind: "pace_clock",
    scopeKey: "main",
    client,
    forUpdate: true,
  });
  assert.equal(found.revision, 1);
  assert.match(client.calls[0].sql, /FOR UPDATE/);

  const listed = await listRoomExperienceStates("room-1", {
    stateKind: "pace_clock",
    visibility: "room",
    client,
  });
  assert.equal(listed[0].stateKind, "pace_clock");
  assert.equal(client.calls[1].params.length, 4);
});

test("experience repository insert and update preserve optimistic concurrency", async () => {
  const insertClient = clientFor();
  const inserted = await insertRoomExperienceState(insertClient, state);
  assert.equal(inserted.revision, 1);
  assert.match(insertClient.calls[0].sql, /ON CONFLICT[\s\S]+DO NOTHING/);
  assert.equal(insertClient.calls[0].params.length, 9);

  const updateClient = clientFor([row({ revision: 2 })]);
  const updated = await updateRoomExperienceState(updateClient, {
    ...state,
    expectedRevision: 1,
  });
  assert.equal(updated.revision, 2);
  assert.match(updateClient.calls[0].sql, /revision = revision \+ 1/);
  assert.match(updateClient.calls[0].sql, /revision = \$5/);
  assert.equal(updateClient.calls[0].params.length, 10);
});

test("experience repository exposes stale delete as a false result", async () => {
  const client = clientFor([], 0);
  const deleted = await deleteRoomExperienceState(client, {
    roomId: "room-1",
    stateKind: "pace_clock",
    scopeKey: "main",
    expectedRevision: 9,
  });
  assert.equal(deleted, false);
  assert.equal(client.calls[0].params.length, 5);
});
