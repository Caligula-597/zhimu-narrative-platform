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
    contentBinding: {
      mode: "release",
      runtimeSource: "release_snapshot",
      isFrozen: true,
      release: {
        id: "release-1",
        releaseNumber: 3,
        label: "Acceptance",
        sourceRevision: 7,
        createdAt: "2026-07-23T00:00:00.000Z"
      },
      currentDraftRevision: 9
    },
    currentBeat: {
      id: "beat-1",
      key: "opening",
      title: "Opening",
      sequence: 1,
      position: 1,
      total: 4,
      source: "reading_progress",
      player: {
        content: "Compare the statements",
        tips: ["Read the timestamps"],
        tasks: []
      },
      host: {
        goal: "Confirm the timeline",
        flow: "Read and compare",
        hostTruth: "Host-only truth",
        dmTasks: "Ask for a theory",
        openClues: "Receipt",
        privateChatHints: "Nudge the detective",
        advanceCondition: "A theory is recorded",
        fallbacks: ["Reveal a timestamp"],
        estimatedMinutes: 20
      }
    },
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
  assert.equal(offline.contentBinding.release.releaseNumber, 3);
  assert.equal(offline.currentBeat.host.hostTruth, "Host-only truth");
  assert.equal(primaryRuntimeAction(value).key, "first");
});

test("player current-state normalization strips host-only beat guidance", () => {
  const normalized = normalizeRuntimeCurrentState({
    audience: "player",
    currentBeat: {
      id: "beat-1",
      key: "opening",
      title: "Opening",
      sequence: 1,
      position: 1,
      total: 1,
      source: "segment_order",
      player: { content: "Public", tips: [], tasks: [] },
      host: { hostTruth: "must not cross the boundary" }
    },
    presentation: {
      activeSegmentKey: "opening",
      map: {
        visible: true,
        locations: [{ id: "public", name: "Public" }],
        host: { variables: [{ id: "secret", value: 99 }] }
      }
    }
  }, { audience: "player" });
  assert.equal(normalized.currentBeat.player.content, "Public");
  assert.equal(normalized.currentBeat.host, null);
  assert.equal(normalized.presentation.map.host, null);
  assert.equal(normalized.presentation.map.locations[0].name, "Public");
});
