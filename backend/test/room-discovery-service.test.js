import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDiscoveryStatePayload,
  clueMatchesDiscoveryLocation,
  projectHostDiscoveryState,
  projectPlayerDiscoveryState,
  shuffledDiscoveryClueIds
} from "../src/room-discovery-service.js";

function storedState() {
  return {
    subjectKey: "role-1",
    revision: 4,
    updatedAt: "2026-08-11T11:00:00.000Z",
    payload: {
      locationId: "library",
      segmentKey: "ch2",
      phase: "drawing",
      drawnClueIds: ["clue-a", "clue-b"],
      remainingClueIds: ["clue-secret"],
      remainingCount: 1,
      scanStartedAt: "2026-08-11T10:59:50.000Z",
      scanReadyAt: "2026-08-11T10:59:54.000Z",
      completedAt: null
    }
  };
}

test("server shuffle de-duplicates ids and uses the injected secure picker", () => {
  const picks = [];
  const result = shuffledDiscoveryClueIds(["a", "b", "a", "c"], (upper) => {
    picks.push(upper);
    return 0;
  });
  assert.deepEqual(picks, [3, 2]);
  assert.deepEqual(result, ["b", "c", "a"]);
});

test("an explicit location binding takes precedence over a shared segment key", () => {
  const location = { id: "library", segmentKey: "ch2" };
  assert.equal(clueMatchesDiscoveryLocation({ metadata: { locationId: "vault", segmentKey: "ch2" } }, location), false);
  assert.equal(clueMatchesDiscoveryLocation({ metadata: { locationId: "library", segmentKey: "ch9" } }, location), true);
  assert.equal(clueMatchesDiscoveryLocation({ metadata: { segmentKey: "ch2" } }, location), true);
});

test("player discovery projection exposes only that player's drawn order", () => {
  const projected = projectPlayerDiscoveryState(storedState());
  assert.deepEqual(projected.drawnClueIds, ["clue-a", "clue-b"]);
  assert.equal(projected.lastDrawnClueId, "clue-b");
  assert.equal(projected.remainingCount, 1);
  assert.equal("remainingClueIds" in projected, false);
  assert.equal("roleSlotId" in projected, false);
});

test("host discovery projection exposes counts but no clue ids or content", () => {
  const projected = projectHostDiscoveryState(storedState());
  assert.equal(projected.roleSlotId, "role-1");
  assert.equal(projected.drawnCount, 2);
  assert.equal(projected.remainingCount, 1);
  assert.equal("drawnClueIds" in projected, false);
  assert.equal("remainingClueIds" in projected, false);
});

test("draw transition preserves server order and removes no-longer-authorized ids", () => {
  const payload = buildDiscoveryStatePayload({
    location: { id: "library", segmentKey: "ch2" },
    existing: {
      payload: {
        locationId: "library",
        segmentKey: "ch2",
        phase: "ready",
        drawnClueIds: ["revoked", "clue-a"],
        remainingClueIds: ["clue-b", "revoked"],
        remainingCount: 2,
      },
    },
    clueIds: ["clue-a", "clue-b", "clue-c"],
    action: "clue_drawn",
    now: "2026-08-11T11:01:00.000Z",
  });
  assert.deepEqual(payload.drawnClueIds, ["clue-a", "clue-b"]);
  assert.deepEqual(payload.remainingClueIds, ["clue-c"]);
  assert.equal(payload.remainingCount, 1);
  assert.equal(payload.phase, "drawing");
});

test("starting a completed discovery again exposes newly authorized clues", () => {
  const payload = buildDiscoveryStatePayload({
    location: { id: "library", segmentKey: "ch2" },
    existing: {
      payload: {
        locationId: "library",
        segmentKey: "ch2",
        phase: "complete",
        drawnClueIds: ["clue-a"],
        remainingClueIds: [],
        remainingCount: 0,
        scanStartedAt: "2026-08-11T10:59:50.000Z",
        scanReadyAt: "2026-08-11T10:59:54.000Z",
        completedAt: "2026-08-11T11:00:00.000Z",
      },
    },
    clueIds: ["clue-a", "clue-b"],
    action: "scan_started",
    now: "2026-08-11T11:05:00.000Z",
  });

  assert.equal(payload.phase, "ready");
  assert.deepEqual(payload.drawnClueIds, ["clue-a"]);
  assert.deepEqual(payload.remainingClueIds, ["clue-b"]);
  assert.equal(payload.remainingCount, 1);
  assert.equal(payload.completedAt, null);
});
