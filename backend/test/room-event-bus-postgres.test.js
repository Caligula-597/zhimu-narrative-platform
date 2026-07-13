import assert from "node:assert/strict";
import test from "node:test";
import {
  publishRoomEvent,
  resetRoomEventBusForTests,
  startRoomEventBus,
  stopRoomEventBus,
  subscribeRoomEvents
} from "../src/room-event-bus.js";
import { query } from "../src/db.js";

function parsePayload(message) {
  const payload = typeof message === "string" ? message : message.payload;
  return JSON.parse(payload);
}

test("postgres bus mode delivers exactly once to local subscribers", async (context) => {
  if (!process.env.DATABASE_URL) {
    console.log("skip postgres bus test — no DATABASE_URL");
    return;
  }
  const previous = process.env.ROOM_EVENTS_BUS;
  process.env.ROOM_EVENTS_BUS = "postgres";
  resetRoomEventBusForTests();
  await startRoomEventBus();
  context.after(async () => {
    await stopRoomEventBus();
    resetRoomEventBusForTests();
    if (previous === undefined) delete process.env.ROOM_EVENTS_BUS;
    else process.env.ROOM_EVENTS_BUS = previous;
  });

  const received = [];
  subscribeRoomEvents("room-bus-test", (message) => received.push(parsePayload(message)));
  await publishRoomEvent("room-bus-test", "room.test_bus", { probe: true });
  assert.equal(received.length, 1);
  assert.equal(received[0].type, "room.test_bus");
});

test("postgres room bus receives events published by another instance", async (context) => {
  if (!process.env.DATABASE_URL) return;
  const previous = process.env.ROOM_EVENTS_BUS;
  process.env.ROOM_EVENTS_BUS = "postgres";
  await startRoomEventBus();
  context.after(async () => {
    await stopRoomEventBus();
    resetRoomEventBusForTests();
    if (previous === undefined) delete process.env.ROOM_EVENTS_BUS;
    else process.env.ROOM_EVENTS_BUS = previous;
  });
  const received = [];
  const roomId = "cross-instance-room";
  subscribeRoomEvents(roomId, (message) => received.push(parsePayload(message)));
  await query(`SELECT pg_notify($1, $2)`, ["zhimu_room_events", JSON.stringify({
    sourceInstanceId: "another-instance",
    roomId,
    id: 991,
    payload: JSON.stringify({ type: "room.test_cross_instance", roomId })
  })]);
  const deadline = Date.now() + 2000;
  while (!received.length && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(received[0]?.type, "room.test_cross_instance");
});
