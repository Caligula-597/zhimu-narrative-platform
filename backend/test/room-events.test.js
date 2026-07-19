import assert from "node:assert/strict";
import test from "node:test";
import {
  publishPersistedRoomEvent,
  resetRoomEventBusForTests,
  subscribeRoomEvents
} from "../src/room-event-bus.js";
import { validateRoomEvent } from "../src/room-event-schemas.js";

function parsePayload(message) {
  const payload = typeof message === "string" ? message : message.payload;
  return JSON.parse(payload);
}

test("room event bus delivers persisted events to room subscribers only", async () => {
  resetRoomEventBusForTests();
  const roomA = [];
  const roomB = [];
  const offA = subscribeRoomEvents("room-a", (message) => roomA.push(parsePayload(message)));
  subscribeRoomEvents("room-b", (message) => roomB.push(parsePayload(message)));

  await publishPersistedRoomEvent({
    type: "room.section_completed",
    roomId: "room-a",
    at: new Date().toISOString(),
    sectionId: "sec-1",
    roleSlotId: "role-1"
  }, 1);
  assert.equal(roomA.length, 1);
  assert.equal(roomA[0].type, "room.section_completed");
  assert.equal(roomA[0].sectionId, "sec-1");
  assert.equal(roomB.length, 0);

  offA();
  await publishPersistedRoomEvent({
    type: "room.player_joined",
    roomId: "room-a",
    at: new Date().toISOString(),
    roleSlotId: "role-1",
    roleName: "测试角色"
  }, 2);
  assert.equal(roomA.length, 1);
  resetRoomEventBusForTests();
});

test("publishPersistedRoomEvent preserves durable metadata and journal cursor", async () => {
  resetRoomEventBusForTests();
  const received = [];
  subscribeRoomEvents("room-x", (message) => received.push(message));
  const event = await publishPersistedRoomEvent({
    type: "room.host_event_pending",
    roomId: "room-x",
    at: "persisted-at",
    eventId: "e1"
  }, 41);

  assert.equal(event.type, "room.host_event_pending");
  assert.equal(event.roomId, "room-x");
  assert.equal(event.at, "persisted-at");
  assert.equal(event.journalId, 41);
  assert.equal(received[0].id, 41);
  assert.equal(parsePayload(received[0]).eventId, "e1");
  resetRoomEventBusForTests();
});

test("validateRoomEvent remains available at the producer boundary", () => {
  const ok = validateRoomEvent("room.host_nudge", { message: "hi", roleSlotIds: ["rs-1"] });
  assert.equal(ok.ok, true);
  const bad = validateRoomEvent("room.host_nudge", { message: "hi" });
  assert.equal(bad.ok, false);
});

test("host manual log event contract requires its durable log identity", () => {
  const ok = validateRoomEvent("room.host_log_created", {
    logId: "42",
    eventType: "host_note"
  });
  assert.equal(ok.ok, true);
  const bad = validateRoomEvent("room.host_log_created", { eventType: "host_note" });
  assert.equal(bad.ok, false);
});

test("host player notes event contract requires role and timestamp", () => {
  const ok = validateRoomEvent("room.host_player_notes_updated", {
    roleSlotId: "role-1",
    updatedAt: new Date().toISOString()
  });
  assert.equal(ok.ok, true);
  const bad = validateRoomEvent("room.host_player_notes_updated", { roleSlotId: "role-1" });
  assert.equal(bad.ok, false);
});
