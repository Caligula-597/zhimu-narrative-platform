import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { scopedSseCursorKey } from "../shared/sse-client.js";

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
    assert.match(lifecycle, /createPortalEventLifecycle/);
    assert.match(lifecycle, /\brefresh\s*:/);
    assert.match(lifecycle, /\bonAuthLost\s*:/);
    assert.match(lifecycle, /\bonConnectionChange\s*:/);
    assert.match(api, surface.streamPattern);
    assert.match(api, /cursorKey/);
  });
}

test("the shared transport covers cursor validation, de-duplication and stream-local ordering", () => {
  const transport = read("shared/sse-client.js");
  const parser = read("shared/sse.js");
  const lifecycle = read("shared/sse-lifecycle.js");
  const poller = read("shared/adaptive-poller.js");
  const replay = read("backend/src/sse-replay-subscription.js");
  assert.match(transport, /Last-Event-ID/);
  assert.match(transport, /initialCursor/);
  assert.match(parser, /deliveredIds/);
  assert.match(parser, /lastHandledCursor = Math\.max/);
  assert.match(parser, /handler failed|onEvent/);
  assert.match(lifecycle, /createAdaptivePoller/);
  assert.match(poller, /if \(inFlight\) return inFlight/);
  assert.match(lifecycle, /currentGeneration !== generation/);
  assert.match(replay, /phase = "buffering"/);
  assert.match(replay, /throughId: highWaterMark/);
});

test("resume cursors are isolated by authenticated principal", () => {
  const userA = scopedSseCursorKey("zhimuPlayPlatformSseCursor", "user-a");
  const userB = scopedSseCursorKey("zhimuPlayPlatformSseCursor", "user-b");
  assert.notEqual(userA, userB);
  assert.match(userA, /user-a$/);
  for (const apiPath of ["src/api/room.js", "host/src/api.js", "play/src/api.js"]) {
    assert.match(read(apiPath), /userId/);
  }
});

test("room SSE applies a server-side audience projection and bounded reauthentication", () => {
  const route = read("backend/src/routes/room-events-routes.js");
  const platformRoute = read("backend/src/routes/platform-social-routes.js");
  assert.match(route, /projectRoomEventEnvelope/);
  assert.match(route, /resolveSseMaxConnectionAgeMs/);
  assert.match(platformRoute, /resolveSseMaxConnectionAgeMs/);
});

test("Release changes fan out to all room surfaces and every surface has pull recovery", () => {
  const creator = read("src/runtime/room-events.js");
  const host = read("host/src/runtime/room-events.js");
  const player = read("play/src/room-events.js");
  const audience = read("backend/src/room-event-audience.js");

  for (const source of [creator, host, player]) {
    assert.match(source, /room\.content_release_changed/);
  }
  assert.match(creator, /refreshCreatorRoomWorkspace/);
  assert.match(creator, /view === "rooms"/);
  assert.match(host, /room\.content_release_changed[\s\S]*?refreshHostRoom/);
  assert.match(player, /room\.content_release_changed[\s\S]*?onRefresh/);
  assert.match(audience, /PUBLIC_PLAYER_EVENT_TYPES[\s\S]*?room\.content_release_changed/);
});

test("the documented SSE fault matrix names every release-gating failure class", () => {
  const matrix = read("docs/SSE_FAILURE_MATRIX_ZH.md");
  for (const marker of [
    "SSE-01", "SSE-02", "SSE-03", "SSE-04", "SSE-05", "SSE-06", "SSE-07",
    "SSE-08", "SSE-09", "SSE-10", "SSE-11", "SSE-12", "SSE-13", "SSE-14",
    "SSE-15", "SSE-16", "SSE-17", "SSE-18", "SSE-19"
  ]) {
    assert.match(matrix, new RegExp(`\\b${marker}\\b`));
  }
});
