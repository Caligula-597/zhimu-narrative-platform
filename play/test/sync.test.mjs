import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRefreshCoalescer,
  renderSyncStatusBannerHtml,
  shouldAutoScrollNearBottom
} from "../src/runtime/sync-helpers.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("createRefreshCoalescer merges rapid calls into one run", async () => {
  let runs = 0;
  const schedule = createRefreshCoalescer(async () => {
    runs += 1;
    await new Promise((r) => setTimeout(r, 20));
  }, 40);

  const p1 = schedule();
  const p2 = schedule();
  const p3 = schedule();
  await Promise.all([p1, p2, p3]);
  assert.equal(runs, 1);
});

test("shouldAutoScrollNearBottom detects bottom proximity", () => {
  const el = {
    scrollHeight: 1000,
    clientHeight: 200,
    scrollTop: 750
  };
  assert.equal(shouldAutoScrollNearBottom(el), true);
  el.scrollTop = 100;
  assert.equal(shouldAutoScrollNearBottom(el), false);
});

test("renderSyncStatusBannerHtml surfaces reconnect and poll states", () => {
  assert.match(
    renderSyncStatusBannerHtml({ view: "game", roomEventsStatus: "reconnecting" }),
    /重连中/
  );
  assert.match(
    renderSyncStatusBannerHtml({ view: "game", roomEventsStatus: "polling" }),
    /15 秒/
  );
  assert.equal(renderSyncStatusBannerHtml({ view: "game", roomEventsStatus: "connected" }), "");
});

test("main.js uses pull generation and partial refresh paths", () => {
  const main = readFileSync(path.join(root, "src", "main.js"), "utf8");
  const social = readFileSync(path.join(root, "src", "runtime", "social-controller.js"), "utf8");
  assert.match(main, /pullGeneration/);
  assert.match(main, /pendingRoomRefresh/);
  assert.match(main, /isGameInputFocused/);
  assert.match(main, /createSocialController/);
  assert.match(social, /dmScrollStickBottom/);
});

test("platform-events has poll fallback when SSE down", () => {
  const source = readFileSync(path.join(root, "src", "platform-events.js"), "utf8");
  assert.match(source, /syncPlatformPoll/);
  assert.match(source, /onInGameCommRefresh/);
  assert.match(source, /pollInFlight/);
});

test("api platform stream persists Last-Event-ID cursor", () => {
  const source = readFileSync(path.join(root, "src", "api.js"), "utf8");
  const transport = readFileSync(path.join(root, "..", "shared", "sse-client.js"), "utf8");
  const portalClient = readFileSync(path.join(root, "..", "shared", "api-client.js"), "utf8");
  assert.match(source, /PLATFORM_SSE_CURSOR/);
  assert.match(source, /streamPlatformEvents/);
  assert.match(portalClient, /openSseStream/);
  assert.match(transport, /Last-Event-ID/);
});

test("patch-game defers tab body when input focused", () => {
  const source = readFileSync(path.join(root, "src", "runtime", "patch-game.js"), "utf8");
  assert.match(source, /isGameInputFocused/);
  assert.match(source, /return "chrome"/);
});

test("patch-game supports tab switch without full render", () => {
  const source = readFileSync(path.join(root, "src", "runtime", "patch-game.js"), "utf8");
  assert.match(source, /patchGameTabSwitch/);
  assert.match(source, /patchGameSectionsTab/);
});

test("livekit-client is bundled not loaded from CDN", () => {
  const source = readFileSync(path.join(root, "src", "voice", "livekit-voice.js"), "utf8");
  assert.match(source, /import\("livekit-client"\)/);
  assert.doesNotMatch(source, /cdn\.jsdelivr\.net/);
});
