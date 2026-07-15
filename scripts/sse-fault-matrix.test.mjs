import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const SURFACES = [
  {
    name: "creator",
    lifecycle: "src/runtime/room-events.js",
    api: "src/api/room.js",
    streamPattern: /streamRoomEvents/
  },
  {
    name: "host",
    lifecycle: "host/src/runtime/room-events.js",
    api: "host/src/api.js",
    streamPattern: /streamRoomEvents/
  },
  {
    name: "player-room",
    lifecycle: "play/src/room-events.js",
    api: "play/src/api.js",
    streamPattern: /streamRoomEvents/
  },
  {
    name: "player-platform",
    lifecycle: "play/src/platform-events.js",
    api: "play/src/api.js",
    streamPattern: /streamPlatformEvents/
  }
];

for (const surface of SURFACES) {
  test(`${surface.name} uses the shared recoverable SSE lifecycle`, () => {
    const lifecycle = read(surface.lifecycle);
    const api = read(surface.api);
    assert.match(lifecycle, /createSseLifecycle/);
    assert.match(lifecycle, /\bpoll\s*:/);
    assert.match(lifecycle, /\breconcile\s*:/);
    assert.match(lifecycle, /\bonAuthLost\s*:/);
    assert.match(lifecycle, /\bonDisconnected\s*:/);
    assert.match(api, surface.streamPattern);
    assert.match(api, /cursorKey/);
  });
}

test("the shared transport covers cursor validation, de-duplication and stream-local ordering", () => {
  const transport = read("shared/sse-client.js");
  const parser = read("shared/sse.js");
  const lifecycle = read("shared/sse-lifecycle.js");
  const replay = read("backend/src/sse-replay-subscription.js");
  assert.match(transport, /Last-Event-ID/);
  assert.match(transport, /initialCursor/);
  assert.match(parser, /deliveredIds/);
  assert.match(parser, /lastHandledCursor = Math\.max/);
  assert.match(parser, /handler failed|onEvent/);
  assert.match(lifecycle, /pollInFlight/);
  assert.match(lifecycle, /currentGeneration !== generation/);
  assert.match(replay, /phase = "buffering"/);
  assert.match(replay, /throughId: highWaterMark/);
});

test("the documented SSE fault matrix names every release-gating failure class", () => {
  const matrix = read("docs/SSE_FAILURE_MATRIX_ZH.md");
  for (const marker of [
    "SSE-01", "SSE-02", "SSE-03", "SSE-04", "SSE-05", "SSE-06", "SSE-07",
    "SSE-08", "SSE-09", "SSE-10", "SSE-11", "SSE-12", "SSE-13", "SSE-14"
  ]) {
    assert.match(matrix, new RegExp(`\\b${marker}\\b`));
  }
});
