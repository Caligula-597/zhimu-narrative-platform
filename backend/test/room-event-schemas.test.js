import assert from "node:assert/strict";
import test from "node:test";
import {
  validateRoomEvent,
  listRegisteredEventTypes,
  getRoomEventSchema
} from "../src/room-event-schemas.js";

test("accepts a known event type with all required fields", () => {
  const result = validateRoomEvent("room.player_joined", {
    roleSlotId: "rs-1",
    roleName: "侦探"
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
  const result = validateRoomEvent("room.player_joined", { roleSlotId: "rs-1" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("roleName")));
});

test("rejects wrong field type", () => {
  const result = validateRoomEvent("room.player_joined", {
    roleSlotId: "rs-1",
    roleName: 12345
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
  const result = validateRoomEvent("room.host_event_pending", { eventId: "evt-1" });
  assert.equal(result.ok, true);
});

test("accepts room.host_event_pending with all fields", () => {
  const result = validateRoomEvent("room.host_event_pending", {
    eventId: "evt-1",
    action: "delayed",
    delayMinutes: 30,
    title: "待处理事件",
    source: "rule"
  });
  assert.equal(result.ok, true);
});

test("rejects invalid action enum for host_event_pending", () => {
  const result = validateRoomEvent("room.host_event_pending", {
    eventId: "evt-1",
    action: "bogus_action"
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("action")));
});

test("accepts room.game_completed with optional forced flag", () => {
  const result = validateRoomEvent("room.game_completed", {
    currentGame: { id: "g1" },
    forced: true
  });
  assert.equal(result.ok, true);
});

test("accepts room.game_updated with required correct boolean", () => {
  const result = validateRoomEvent("room.game_updated", {
    currentGame: { id: "g1" },
    correct: false
  });
  assert.equal(result.ok, true);
});

test("rejects room.game_updated missing correct field", () => {
  const result = validateRoomEvent("room.game_updated", { currentGame: { id: "g1" } });
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
    ownerRoleSlotId: "rs-2"
  });
  assert.equal(result.ok, true);
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

test("accepts null data for test-prefixed type (default empty object)", () => {
  // publishRoomEvent defaults data to {}; validateRoomEvent receives the default
  const result = validateRoomEvent("room.test_probe", {});
  assert.equal(result.ok, true);
});
