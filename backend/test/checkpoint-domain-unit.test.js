import assert from "node:assert/strict";
import test from "node:test";
import { validateRestoreSnapshot } from "../src/checkpoint-restore.js";
import { buildRoomCheckpointSnapshot } from "../src/checkpoint-snapshot.js";
import { applyCheckpointState } from "../src/repositories/checkpoint-restore-state-repository.js";

test("checkpoint snapshot uses one repository round trip", async () => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      return {
        rows: [{
          id: "room-1",
          name: "room",
          status: "testing",
          players: [],
          clue_ownership: [],
          unlocked_scenes: [],
          pending_events: [],
          recent_logs: [],
          timeline_logs: [],
          reading_progress: [],
          inventory: [],
          content_unlocks: [],
          rule_executions: [],
          investigation_records: [],
          player_states: []
        }]
      };
    }
  };

  const snapshot = await buildRoomCheckpointSnapshot("room-1", { client });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ["room-1", true]);
  assert.equal(snapshot.schemaVersion, 2);
  assert.deepEqual(snapshot.players, []);
});

test("checkpoint restore batches rows per dataset instead of per row", async () => {
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      return { rows: [], rowCount: 0 };
    }
  };
  const readingProgress = Array.from({ length: 500 }, (_, index) => ({
    role_slot_id: "11111111-1111-4111-8111-111111111111",
    script_section_id: "22222222-2222-4222-8222-222222222222",
    started_at: `2026-01-01T00:00:${String(index % 60).padStart(2, "0")}.000Z`,
    completed_at: null
  }));
  const inventory = Array.from({ length: 300 }, () => ({
    role_slot_id: "11111111-1111-4111-8111-111111111111",
    item_id: "33333333-3333-4333-8333-333333333333",
    quantity: 1,
    metadata: {}
  }));

  await applyCheckpointState(client, "room-1", { readingProgress, inventory }, {
    readingProgress: true,
    inventory: true,
    contentUnlocks: false,
    clueOwnership: false,
    pendingHostEvents: false,
    investigationRecords: false,
    playerStates: false,
    ruleExecutions: false,
    timelineLogs: false
  });

  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[0].params[1]).length, 500);
  assert.equal(JSON.parse(calls[1].params[1]).length, 300);
  assert.match(calls[0].text, /jsonb_to_recordset/);
  assert.match(calls[1].text, /jsonb_to_recordset/);
});

test("checkpoint restore rejects malformed selected datasets before deleting state", () => {
  assert.throws(
    () => validateRestoreSnapshot({ schemaVersion: 2, readingProgress: {} }, {
      readingProgress: true,
      clueOwnership: false,
      inventory: false,
      contentUnlocks: false,
      pendingHostEvents: false,
      investigationRecords: false,
      playerStates: false,
      ruleExecutions: false,
      timelineLogs: false
    }),
    (error) => error.code === "INVALID_SNAPSHOT" && error.details?.dataset === "readingProgress"
  );
});

test("checkpoint restore refuses destructive timeline replacement from a truncated snapshot", () => {
  assert.throws(
    () => validateRestoreSnapshot({
      schemaVersion: 2,
      timelineLogs: [],
      timelineLogsTruncated: true
    }, {
      readingProgress: false,
      clueOwnership: false,
      inventory: false,
      contentUnlocks: false,
      pendingHostEvents: false,
      investigationRecords: false,
      playerStates: false,
      ruleExecutions: false,
      timelineLogs: true
    }),
    (error) => error.code === "SNAPSHOT_TIMELINE_TRUNCATED"
  );
});
