import assert from "node:assert/strict";
import test from "node:test";
import {
  validateRoomEvent,
  listRegisteredEventTypes,
  getRoomEventSchema,
  ROOM_EVENT_SCHEMAS,
} from "../src/room-event-schemas.js";

test("accepts a known event type with all required fields", () => {
  const result = validateRoomEvent("room.player_joined", {
    roleSlotId: "rs-1",
    roleName: "侦探",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("rejects unknown event type", () => {
  const result = validateRoomEvent("room.totally_made_up", { foo: "bar" });
  assert.equal(result.ok, false);
  assert.ok(result.errors[0].includes("Unknown room event type"));
});

test("rejects missing required fields", () => {
  const result = validateRoomEvent("room.player_joined", {
    roleSlotId: "rs-1",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("roleName")));
});

test("rejects wrong field type", () => {
  const result = validateRoomEvent("room.player_joined", {
    roleSlotId: "rs-1",
    roleName: 12345,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("roleName")));
});

test("rejects non-object data", () => {
  const result = validateRoomEvent("room.player_joined", "not-an-object");
  assert.equal(result.ok, false);
  assert.ok(result.errors[0].includes("must be a plain object"));
});

test("rejects array data", () => {
  const result = validateRoomEvent("room.player_joined", [{ roleSlotId: "x" }]);
  assert.equal(result.ok, false);
});

test("allows test-prefixed event types with any object payload", () => {
  const result = validateRoomEvent("room.test_custom", { anything: true });
  assert.equal(result.ok, true);
});

test("allows dev-prefixed event types", () => {
  const result = validateRoomEvent("room.dev_probe", { probe: 42 });
  assert.equal(result.ok, true);
});

test("rejects non-object data for test-prefixed type", () => {
  const result = validateRoomEvent("room.test_bad", "string-data");
  assert.equal(result.ok, false);
});

test("rejects empty event type", () => {
  const result = validateRoomEvent("", { data: true });
  assert.equal(result.ok, false);
});

test("accepts room.host_event_pending with only eventId", () => {
  const result = validateRoomEvent("room.host_event_pending", {
    eventId: "evt-1",
  });
  assert.equal(result.ok, true);
});

test("accepts room.host_event_pending with all fields", () => {
  const result = validateRoomEvent("room.host_event_pending", {
    eventId: "evt-1",
    action: "delayed",
    delayMinutes: 30,
    title: "待处理事件",
    source: "rule",
  });
  assert.equal(result.ok, true);
});

test("rejects invalid action enum for host_event_pending", () => {
  const result = validateRoomEvent("room.host_event_pending", {
    eventId: "evt-1",
    action: "bogus_action",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("action")));
});

test("accepts room.game_completed with optional forced flag", () => {
  const result = validateRoomEvent("room.game_completed", {
    currentGame: { id: "g1" },
    forced: true,
  });
  assert.equal(result.ok, true);
});

test("accepts room.game_updated with required correct boolean", () => {
  const result = validateRoomEvent("room.game_updated", {
    currentGame: { id: "g1" },
    correct: false,
  });
  assert.equal(result.ok, true);
});

test("rejects room.game_updated missing correct field", () => {
  const result = validateRoomEvent("room.game_updated", {
    currentGame: { id: "g1" },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("correct")));
});

test("accepts room.clue_granted with minimal required clueId", () => {
  const result = validateRoomEvent("room.clue_granted", { clueId: "clue-1" });
  assert.equal(result.ok, true);
});

test("accepts room.clue_granted with all optional fields", () => {
  const result = validateRoomEvent("room.clue_granted", {
    clueId: "clue-1",
    roleSlotId: "rs-1",
    source: "host_manual",
    clueName: "神秘线索",
    pointId: "pt-1",
    ownerRoleSlotId: "rs-2",
  });
  assert.equal(result.ok, true);
});

test("accepts mechanism settlement as a durable clue source", () => {
  assert.equal(validateRoomEvent("room.clue_granted", {
    clueId: "clue-1",
    roleSlotId: "rs-1",
    source: "mechanism_settlement",
    clueName: "密令残页",
  }).ok, true);
});

test("accepts durable batch-B event contracts and rejects missing identifiers", () => {
  for (const [type, payload, requiredField] of [
    [
      "room.player_task_completed",
      { taskId: "task-1", roleSlotId: "role-1" },
      "taskId",
    ],
    [
      "room.testimony_submitted",
      { testimonyId: "testimony-1", roleSlotId: "role-1" },
      "testimonyId",
    ],
    [
      "room.segment_remedy_applied",
      { remedyId: "remedy-1", segmentKey: "ch1", title: "补救" },
      "remedyId",
    ],
  ]) {
    assert.equal(validateRoomEvent(type, payload).ok, true, type);
    const invalid = { ...payload };
    delete invalid[requiredField];
    assert.equal(
      validateRoomEvent(type, invalid).ok,
      false,
      `${type} requires ${requiredField}`,
    );
  }
});

test("listRegisteredEventTypes returns sorted array of known types", () => {
  const types = listRegisteredEventTypes();
  assert.ok(Array.isArray(types));
  assert.ok(types.length >= 15);
  assert.ok(types.includes("room.player_joined"));
  assert.ok(types.includes("room.host_event_pending"));
  // Verify sorted
  const sorted = [...types].sort();
  assert.deepEqual(types, sorted);
});

test("getRoomEventSchema returns schema for known type", () => {
  const schema = getRoomEventSchema("room.player_joined");
  assert.ok(schema);
  assert.ok(schema.required.includes("roleSlotId"));
  assert.ok(schema.required.includes("roleName"));
});

test("getRoomEventSchema returns null for unknown type", () => {
  assert.equal(getRoomEventSchema("room.nonexistent"), null);
});

test("all production room contracts remain JSON-Schema-shaped and additive", () => {
  assert.equal(Object.keys(ROOM_EVENT_SCHEMAS).length, 35);
  assert.ok(ROOM_EVENT_SCHEMAS["room.host_log_created"]);
  assert.ok(ROOM_EVENT_SCHEMAS["room.host_player_notes_updated"]);
  assert.ok(ROOM_EVENT_SCHEMAS["room.content_release_changed"]);
  assert.ok(ROOM_EVENT_SCHEMAS["room.mechanism_state_updated"]);
  assert.ok(ROOM_EVENT_SCHEMAS["room.mechanism_submission_updated"]);
  assert.ok(ROOM_EVENT_SCHEMAS["room.presentation_updated"]);
  for (const schema of Object.values(ROOM_EVENT_SCHEMAS)) {
    assert.equal(schema.type, "object");
    assert.equal(schema.additionalProperties, true);
    assert.ok(Array.isArray(schema.required));
    assert.equal(typeof schema.properties, "object");
  }
});

test("presentation updates accept tabletop check lifecycle fields", () => {
  const payload = {
    activeSegmentKey: "authorization-review",
    activeLocationId: "review-room",
    revealedLocationIds: ["server-lobby", "review-room"],
    mapVisible: true,
    checkStatus: "resolved",
    checkLabel: "核验二次授权",
    updatedAt: "2026-08-10T12:00:00.000Z"
  };
  assert.equal(validateRoomEvent("room.presentation_updated", payload).ok, true);
  assert.equal(validateRoomEvent("room.presentation_updated", {
    ...payload,
    checkStatus: "secret"
  }).ok, false);
});

test("mechanism state updates have a durable public event contract", () => {
  const valid = validateRoomEvent("room.mechanism_state_updated", {
    action: "advance",
    revision: 4,
    status: "running",
    roundSequence: 2,
    roundTitle: "第二次潮窗",
  });
  assert.equal(valid.ok, true);
  assert.equal(
    validateRoomEvent("room.mechanism_state_updated", {
      action: "advance",
      status: "running",
    }).ok,
    false,
  );
});

test("mechanism preference updates have a durable host event contract", () => {
  assert.equal(
    validateRoomEvent("room.mechanism_submission_updated", {
      decisionKey: "decision-protect-zone",
      submissionCount: 4,
    }).ok,
    true,
  );
  assert.equal(
    validateRoomEvent("room.mechanism_submission_updated", {
      submissionCount: 4,
    }).ok,
    false,
  );
});

test("room contract validates array item types", () => {
  const result = validateRoomEvent("room.host_nudge", {
    message: "hi",
    roleSlotIds: [123],
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /roleSlotIds\[0\].*string/);
});

test("accepts null data for test-prefixed type (default empty object)", () => {
  // Transaction producers default event data to an empty object.
  const result = validateRoomEvent("room.test_probe", {});
  assert.equal(result.ok, true);
});
