import assert from "node:assert/strict";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import test from "node:test";
import { transactionWithEvents } from "../src/transaction-events.js";
import { subscribeRoomEvents, resetRoomEventBusForTests } from "../src/room-event-bus.js";
import { waitForScheduledEventOutbox } from "../src/event-outbox-dispatcher.js";



function parsePayload(message) {
  const payload = typeof message === "string" ? message : message.payload;
  return JSON.parse(payload);
}

test("transactionWithEvents publishes only after commit", async () => {
  resetRoomEventBusForTests();
  const received = [];
  subscribeRoomEvents(fixtureRoomId, (message) => received.push(parsePayload(message)));

  await transactionWithEvents(async (client, queueEvent) => {
    queueEvent(fixtureRoomId, "room.test_event", {
      step: 1,
      type: "spoofed.type",
      roomId: "spoofed-room",
      at: "spoofed-at"
    });
    assert.equal(received.length, 0, "event must not publish inside open transaction");
    await client.query("SELECT 1");
  });
  await waitForScheduledEventOutbox();
  assert.equal(received.length, 1, "committed event should be dispatched");
  assert.equal(received[0].type, "room.test_event");
  assert.equal(received[0].roomId, fixtureRoomId);
  assert.ok(received[0].at);
  assert.notEqual(received[0].at, "spoofed-at");
});

test("transactionWithEvents does not publish when transaction rolls back", async () => {
  resetRoomEventBusForTests();
  const received = [];
  subscribeRoomEvents(fixtureRoomId, (message) => received.push(parsePayload(message)));

  await assert.rejects(
    () =>
      transactionWithEvents(async (client, queueEvent) => {
        queueEvent(fixtureRoomId, "room.test_event", { step: 2 });
        await client.query("SELECT 1");
        throw new Error("rollback probe");
      }),
    /rollback probe/
  );
  assert.equal(received.length, 0);
});
