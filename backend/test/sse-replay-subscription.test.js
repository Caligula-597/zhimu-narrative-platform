import assert from "node:assert/strict";
import test from "node:test";
import { createReplaySubscription } from "../src/sse-replay-subscription.js";

function envelope(id) {
  return { id, payload: JSON.stringify({ type: "room.test_event", id }) };
}

function releaseEnvelope(id, releaseNumber) {
  return {
    id,
    payload: JSON.stringify({
      type: "room.content_release_changed",
      roomId: "room-release-matrix",
      releaseId: `release-${releaseNumber}`,
      releaseNumber,
      direction: "upgrade"
    })
  };
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
  liveSend(envelope(3));
  liveSend(envelope(4));
  assert.deepEqual(sent, [1, 2, 3, 4]);
  subscription.unsubscribe();
});

test("replay subscription drains events buffered in the flushing-to-live gap", async () => {
  let liveSend;
  const sent = [];
  let releaseFetch;
  const fetchGate = new Promise((resolve) => { releaseFetch = resolve; });
  const subscription = createReplaySubscription({
    lastEventId: "0",
    subscribe(send) { liveSend = send; return () => {}; },
    getLatestId: async () => 1,
    async fetchAfter() {
      await fetchGate;
      return [{ id: 1, payload: { type: "room.test_event", id: 1 } }];
    },
    send(message) { sent.push(Number(message.id)); return true; }
  });
  // Arrive after flush loop would have seen an empty buffer, before live.
  queueMicrotask(() => {
    liveSend(envelope(2));
    releaseFetch();
  });
  assert.equal(await subscription.ready, true);
  assert.deepEqual(sent, [1, 2]);
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

test("replay subscription disconnects when the live race buffer reaches its ceiling", async () => {
  let liveSend;
  let releaseLatest;
  let unsubscribed = 0;
  let closed = 0;
  const latestGate = new Promise((resolve) => { releaseLatest = resolve; });
  const subscription = createReplaySubscription({
    lastEventId: "0",
    subscribe(send) {
      liveSend = send;
      return () => { unsubscribed += 1; };
    },
    getLatestId: () => latestGate,
    fetchAfter: async () => [],
    send: () => true,
    onClose: () => { closed += 1; },
    maxBufferedEvents: 2
  });
  liveSend(envelope(1));
  liveSend(envelope(2));
  liveSend(envelope(3));
  releaseLatest(0);
  assert.equal(await subscription.ready, false);
  assert.equal(unsubscribed, 1);
  assert.equal(closed, 1);
});

test("Release changes survive replay/live overlap without duplicate refresh events", async () => {
  let liveSend;
  const sent = [];
  const subscription = createReplaySubscription({
    lastEventId: "41",
    subscribe(send) {
      liveSend = send;
      return () => {};
    },
    async getLatestId() {
      liveSend(releaseEnvelope(42, 2));
      return 42;
    },
    async fetchAfter() {
      return [{
        id: 42,
        payload: JSON.parse(releaseEnvelope(42, 2).payload)
      }];
    },
    send(message) {
      sent.push({ id: Number(message.id), event: JSON.parse(message.payload) });
      return true;
    }
  });

  assert.equal(await subscription.ready, true);
  liveSend(releaseEnvelope(42, 2));
  liveSend(releaseEnvelope(43, 3));

  assert.deepEqual(sent.map((item) => item.id), [42, 43]);
  assert.deepEqual(sent.map((item) => item.event.releaseNumber), [2, 3]);
  assert.ok(sent.every((item) => item.event.type === "room.content_release_changed"));
  subscription.unsubscribe();
});
