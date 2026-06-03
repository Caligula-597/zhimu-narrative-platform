import assert from "node:assert/strict";
import test from "node:test";
import { publishRoomEvent, resetRoomEventBusForTests, subscribeRoomEvents } from "../src/room-event-bus.js";

test("room event bus delivers events to room subscribers only", () => {
  resetRoomEventBusForTests();
  const roomA = [];
  const roomB = [];
  const offA = subscribeRoomEvents("room-a", (payload) => roomA.push(JSON.parse(payload)));
  subscribeRoomEvents("room-b", (payload) => roomB.push(JSON.parse(payload)));

  publishRoomEvent("room-a", "room.section_completed", { sectionId: "sec-1" });
  assert.equal(roomA.length, 1);
  assert.equal(roomA[0].type, "room.section_completed");
  assert.equal(roomA[0].sectionId, "sec-1");
  assert.equal(roomB.length, 0);

  offA();
  publishRoomEvent("room-a", "room.player_joined", { roleSlotId: "role-1" });
  assert.equal(roomA.length, 1);
  resetRoomEventBusForTests();
});

test("publishRoomEvent includes type and room metadata", () => {
  resetRoomEventBusForTests();
  const event = publishRoomEvent("room-x", "room.host_event_pending", { eventId: "e1" });
  assert.equal(event.type, "room.host_event_pending");
  assert.equal(event.roomId, "room-x");
  assert.equal(event.eventId, "e1");
  assert.ok(event.at);
  resetRoomEventBusForTests();
});
