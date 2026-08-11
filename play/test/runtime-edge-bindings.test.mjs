import assert from "node:assert/strict";
import test from "node:test";
import { bindPlayRuntimeEdges } from "../src/runtime/runtime-edge-bindings.js";

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
}

test("runtime edge bindings centralize discovery, connectivity session and teardown", async () => {
  const windowRef = eventTarget();
  const app = eventTarget();
  const state = { paceClock: { revision: 2 }, user: { id: "player-1" } };
  const calls = [];
  let sessionListener;
  const stopCalls = [];
  const cleanup = bindPlayRuntimeEdges({
    app,
    windowRef,
    state,
    render: () => calls.push("render"),
    syncPlayerDiscovery: async (detail) => ({ ...detail, revision: 3 }),
    setVoiceRenderCallback: () => calls.push("voice-render-bound"),
    subscribeSessionToken: (listener) => {
      sessionListener = listener;
      return () => calls.push("session-unsubscribed");
    },
    loadSessionUser: async () => calls.push("session-loaded"),
    handleAuthLost: () => calls.push("auth-lost"),
    syncRoomStream: (options) => calls.push(["room-stream", options]),
    createPacePoller: (options) => ({
      start: (startOptions) => calls.push(["pace-start", options.intervalMs, startOptions]),
      stop: () => stopCalls.push("stopped"),
    }),
    paceTick: () => {},
    tabKeydown: () => calls.push("tab-keydown"),
  });

  let resolved;
  windowRef.listeners.get("zhimu:tabletop-discovery-action")({
    detail: { action: "scan_started", resolve: (value) => { resolved = value; } },
  });
  await Promise.resolve();
  await sessionListener({ source: "storage", token: "next-token" });
  assert.equal(resolved.revision, 3);
  assert.deepEqual(calls.find((entry) => Array.isArray(entry) && entry[0] === "room-stream"), [
    "room-stream",
    { force: true },
  ]);

  await sessionListener({ source: "rejected", token: "" });
  assert.ok(calls.includes("auth-lost"));
  app.listeners.get("keydown")({ key: "ArrowRight" });
  assert.ok(calls.includes("tab-keydown"));

  cleanup();
  assert.deepEqual(stopCalls, ["stopped"]);
  assert.ok(calls.includes("session-unsubscribed"));
  assert.equal(windowRef.listeners.size, 0);
  assert.equal(app.listeners.size, 0);
});
