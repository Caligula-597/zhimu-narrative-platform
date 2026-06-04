import assert from "node:assert/strict";
import test from "node:test";
import { transactionWithEvents } from "../src/transaction-events.js";
import { subscribeRoomEvents, resetRoomEventBusForTests } from "../src/room-event-bus.js";

const fogRoomId = "a65f94eb-a987-463c-bb81-aa482367e54a";

function parsePayload(message) {
  const payload = typeof message === "string" ? message : message.payload;
  return JSON.parse(payload);
}

test("transactionWithEvents publishes only after commit", async () => {
  resetRoomEventBusForTests();
  const received = [];
  subscribeRoomEvents(fogRoomId, (message) => received.push(parsePayload(message)));

  await transactionWithEvents(async (client, queueEvent) => {
    queueEvent(fogRoomId, "room.test_event", { step: 1 });
    assert.equal(received.length, 0, "event must not publish inside open transaction");
    await client.query("SELECT 1");
  });
  assert.equal(received.length, 1);
  assert.equal(received[0].type, "room.test_event");
});

test("transactionWithEvents does not publish when transaction rolls back", async () => {
  resetRoomEventBusForTests();
  const received = [];
  subscribeRoomEvents(fogRoomId, (message) => received.push(parsePayload(message)));

  await assert.rejects(
    () =>
      transactionWithEvents(async (client, queueEvent) => {
        queueEvent(fogRoomId, "room.test_event", { step: 2 });
        await client.query("SELECT 1");
        throw new Error("rollback probe");
      }),
    /rollback probe/
  );
  assert.equal(received.length, 0);
});