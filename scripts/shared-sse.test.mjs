import assert from "node:assert/strict";
import test from "node:test";
import { consumeSseStream } from "../shared/sse.js";
import { openSseStream } from "../shared/sse-client.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    }
  };
}

function sseResponse(chunks) {
  const encoder = new TextEncoder();
  return {
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      }
    })
  };
}

test.beforeEach(() => {
  globalThis.localStorage = memoryStorage();
});

test("consumeSseStream parses CRLF-delimited events and persists cursor", async () => {
  const events = [];
  await consumeSseStream(sseResponse([
    "id: 41\r\n",
    "event: room\r\n",
    'data: {"type":"connected"}\r\n\r\n'
  ]), {
    cursorKey: "cursor:room-1",
    onEvent: (type, data) => events.push({ type, data })
  });

  assert.deepEqual(events, [{ type: "room", data: { type: "connected" } }]);
  assert.equal(localStorage.getItem("cursor:room-1"), "41");
});

test("consumeSseStream preserves multiline data and flushes final block", async () => {
  const events = [];
  await consumeSseStream(sseResponse([
    "data: {\n",
    'data: "ok": true\n',
    "data: }\n"
  ]), {
    onEvent: (type, data) => events.push({ type, data })
  });

  assert.deepEqual(events, [{ type: "message", data: { ok: true } }]);
});

test("consumeSseStream ignores malformed events without stopping stream", async () => {
  const events = [];
  await consumeSseStream(sseResponse([
    "id: bad-json\n",
    "data: not-json\n\n",
    'data: {"ok":true}\n\n'
  ]), {
    cursorKey: "cursor:room-2",
    onEvent: (type, data) => events.push({ type, data })
  });

  assert.deepEqual(events, [{ type: "message", data: { ok: true } }]);
  assert.equal(localStorage.getItem("cursor:room-2"), null);
});

test("consumeSseStream applies backpressure to async event handlers", async () => {
  const order = [];
  let concurrent = 0;
  let maxConcurrent = 0;

  await consumeSseStream(sseResponse([
    'data: {"sequence":1}\n\ndata: {"sequence":2}\n\n'
  ]), {
    onEvent: async (_type, data) => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      order.push(`start:${data.sequence}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(`end:${data.sequence}`);
      concurrent -= 1;
    }
  });

  assert.equal(maxConcurrent, 1);
  assert.deepEqual(order, ["start:1", "end:1", "start:2", "end:2"]);
});

test("openSseStream resumes the cursor and normalizes lifecycle events", async (context) => {
  localStorage.setItem("cursor:test", "41");
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let sentHeaders;
  globalThis.fetch = async (_url, options) => {
    sentHeaders = options.headers;
    return new Response('data: {"type":"connected"}\n\ndata: {"type":"room.host_nudge","roomId":"r1","at":"now","message":"hi","roleSlotIds":["a"]}\n\n', {
      status: 200,
      headers: { "content-type": "text/event-stream" }
    });
  };
  const events = [];

  await openSseStream({
    url: "/api/events",
    cursorKey: "cursor:test",
    onEvent: async (type, payload) => events.push({ type, payload })
  });

  assert.equal(sentHeaders["Last-Event-ID"], "41");
  assert.equal(sentHeaders.Accept, "text/event-stream");
  assert.deepEqual(events, [
    { type: "__connected__", payload: { type: "connected" } },
    { type: "room.host_nudge", payload: { message: "hi", roleSlotIds: ["a"] } }
  ]);
});

test("openSseStream drops unknown room.* event types by contract", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(
    'data: {"type":"room.not_a_real_event","roomId":"r1"}\n\ndata: {"type":"room.player_joined","roleSlotId":"a","roleName":"A"}\n\n',
    { status: 200, headers: { "content-type": "text/event-stream" } }
  );
  const events = [];
  await openSseStream({
    url: "/api/events",
    onEvent: async (type, payload) => events.push({ type, payload })
  });
  assert.deepEqual(events, [
    { type: "room.player_joined", payload: { roleSlotId: "a", roleName: "A" } }
  ]);
});

test("openSseStream drops known room events with invalid payload contracts", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(
    'data: {"type":"room.player_joined","roleSlotId":"a"}\n\ndata: {"type":"room.player_joined","roleSlotId":"a","roleName":"A"}\n\n',
    { status: 200, headers: { "content-type": "text/event-stream" } }
  );
  const events = [];
  await openSseStream({
    url: "/api/events",
    onEvent: async (type, payload) => events.push({ type, payload })
  });
  assert.deepEqual(events, [
    { type: "room.player_joined", payload: { roleSlotId: "a", roleName: "A" } }
  ]);
});

test("consumeSseStream does not advance cursor when async handling fails", async () => {
  await assert.rejects(
    consumeSseStream(sseResponse(['id: 42\ndata: {"ok":true}\n\n']), {
      cursorKey: "cursor:retry",
      onEvent: async () => { throw new Error("handler failed"); }
    }),
    /handler failed/
  );
  assert.equal(localStorage.getItem("cursor:retry"), null);
});
