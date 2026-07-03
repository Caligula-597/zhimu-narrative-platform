import assert from "node:assert/strict";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import test from "node:test";
import { publishRoomEvent, resetRoomEventBusForTests, subscribeRoomEvents } from "../src/room-event-bus.js";
import { validateRoomEvent } from "../src/room-event-schemas.js";

function parsePayload(message) {
  const payload = typeof message === "string" ? message : message.payload;
  return JSON.parse(payload);
}

test("room event bus delivers events to room subscribers only", async () => {
  resetRoomEventBusForTests();
  const roomA = [];
  const roomB = [];
  const offA = subscribeRoomEvents("room-a", (message) => roomA.push(parsePayload(message)));
  subscribeRoomEvents("room-b", (message) => roomB.push(parsePayload(message)));

  await publishRoomEvent("room-a", "room.section_completed", { sectionId: "sec-1", roleSlotId: "role-1" });
  assert.equal(roomA.length, 1);
  assert.equal(roomA[0].type, "room.section_completed");
  assert.equal(roomA[0].sectionId, "sec-1");
  assert.equal(roomB.length, 0);

  offA();
  await publishRoomEvent("room-a", "room.player_joined", { roleSlotId: "role-1", roleName: "测试角色" });
  assert.equal(roomA.length, 1);
  resetRoomEventBusForTests();
});

test("publishRoomEvent includes type and room metadata", async () => {
  resetRoomEventBusForTests();
  const event = await publishRoomEvent("room-x", "room.host_event_pending", { eventId: "e1" });
  assert.equal(event.type, "room.host_event_pending");
  assert.equal(event.roomId, "room-x");
  assert.equal(event.eventId, "e1");
  assert.ok(event.at);
  resetRoomEventBusForTests();
});

test("publishRoomEvent passes journal id envelope to subscribers", async () => {
  resetRoomEventBusForTests();
  
  const received = [];
  subscribeRoomEvents(fixtureRoomId, (message) => received.push(message));

  await publishRoomEvent(fixtureRoomId, "room.test_event", { probe: "journal-id" });
  assert.equal(received.length, 1);
  assert.ok(typeof received[0].payload === "string");
  assert.ok(received[0].id != null, "live SSE subscribers should receive journal id when available");
  resetRoomEventBusForTests();
});

test("publishRoomEvent rejects unknown event type", async () => {
  resetRoomEventBusForTests();
  await assert.rejects(
    publishRoomEvent("room-x", "room.nonexistent_type", { data: true }),
    /Unknown room event type/
  );
  resetRoomEventBusForTests();
});

test("publishRoomEvent rejects missing required fields", async () => {
  resetRoomEventBusForTests();
  await assert.rejects(
    publishRoomEvent("room-x", "room.player_joined", { roleSlotId: "rs-1" }),
    /roleName/
  );
  resetRoomEventBusForTests();
});

test("publishRoomEvent accepts test-prefixed event types", async () => {
  resetRoomEventBusForTests();
  const event = await publishRoomEvent("room-x", "room.test_validation", { probe: true });
  assert.equal(event.type, "room.test_validation");
  assert.equal(event.probe, true);
  resetRoomEventBusForTests();
});

test("validateRoomEvent is exported and usable", () => {
  const ok = validateRoomEvent("room.host_nudge", { message: "hi", roleSlotIds: ["rs-1"] });
  assert.equal(ok.ok, true);
  const bad = validateRoomEvent("room.host_nudge", { message: "hi" });
  assert.equal(bad.ok, false);
});
