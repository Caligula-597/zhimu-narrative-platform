import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRuntimeCurrentState,
  primaryRuntimeAction
} from "../shared/runtime-current-state.js";

test("current-state normalization overlays local SSE connectivity without changing server cursor", () => {
  const value = {
    audience: "host",
    roomId: "room",
    worldId: "world",
    phase: { key: "running", label: "运行中", detail: "ready" },
    suggestedActions: [
      { key: "later", label: "later", priority: 3, target: "room", reason: "" },
      { key: "first", label: "first", priority: 1, target: "events", reason: "" }
    ],
    blockers: [],
    syncState: {
      status: "synced",
      runtimeSource: "release_snapshot",
      isFrozen: true,
      serverCursor: 88,
      generatedAt: "2026-07-24T00:00:00.000Z"
    },
    metrics: {}
  };
  const offline = normalizeRuntimeCurrentState(value, { audience: "host", connected: false });
  assert.equal(offline.syncState.status, "reconnecting");
  assert.equal(offline.syncState.serverCursor, 88);
  assert.equal(primaryRuntimeAction(value).key, "first");
});
