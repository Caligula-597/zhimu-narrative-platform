import assert from "node:assert/strict";
import test from "node:test";
import { createReplaySubscription } from "../src/sse-replay-subscription.js";

function envelope(id) {
  return { id, payload: JSON.stringify({ type: "room.test_event", id }) };
}

test("replay subscription closes the replay-subscribe race and de-duplicates buffered events", async () => {
  let liveSend;
  const sent = [];
  const rows = [1, 2, 3].map((id) => ({ id, payload: { type: "room.test_event", id } }));
  const subscription = createReplaySubscription({
    lastEventId: "0",
    subscribe(send) { liveSend = send; return () => {}; },
    async getLatestId() { liveSend(envelope(3)); return 3; },
    async fetchAfter(afterId, { throughId, limit }) {
      return rows.filter((row) => row.id > afterId && row.id <= throughId).slice(0, limit);
    },
    send(message) { sent.push(Number(message.id)); return true; },
    pageSize: 2
  });
  assert.equal(await subscription.ready, true);
  liveSend(envelope(4));
  assert.deepEqual(sent, [1, 2, 3, 4]);
  subscription.unsubscribe();
});

test("replay subscription paginates beyond one replay page", async () => {
  const sent = [];
  const rows = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, payload: { type: "room.test_event" } }));
  const subscription = createReplaySubscription({
    lastEventId: "0",
    subscribe: () => () => {},
    getLatestId: async () => 7,
    fetchAfter: async (afterId, { throughId, limit }) => rows.filter((row) => row.id > afterId && row.id <= throughId).slice(0, limit),
    send(message) { sent.push(Number(message.id)); return true; },
    pageSize: 3
  });
  await subscription.ready;
  assert.deepEqual(sent, [1, 2, 3, 4, 5, 6, 7]);
  subscription.unsubscribe();
});
