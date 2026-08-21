import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPaceClockPayload,
  projectPaceClockState,
} from "../src/room-pace-clock-service.js";

const now = new Date("2026-08-11T12:00:10.000Z");

function stored(payload = {}) {
  return {
    revision: 4,
    updatedAt: "2026-08-11T12:00:00.000Z",
    payload: {
      mode: "countdown",
      status: "running",
      label: "调查阶段",
      durationMs: 30_000,
      elapsedMs: 5_000,
      startedAt: "2026-08-11T12:00:05.000Z",
      visibleToPlayers: true,
      updatedAt: "2026-08-11T12:00:05.000Z",
      ...payload,
    },
  };
}

test("pace projection recalibrates from the server anchor and hides private clocks", () => {
  const host = projectPaceClockState(stored(), { audience: "host", now });
  assert.equal(host.elapsedMs, 10_000);
  assert.equal(host.revision, 4);
  assert.equal(host.serverNow, now.toISOString());
  assert.equal(projectPaceClockState(stored({ visibleToPlayers: false }), {
    audience: "player",
    now,
  }), null);
});

test("pause materializes elapsed time and extend keeps a running clock anchored", () => {
  const paused = buildPaceClockPayload({
    previous: stored().payload,
    input: { action: "pause" },
    now,
  });
  assert.equal(paused.status, "paused");
  assert.equal(paused.elapsedMs, 10_000);
  assert.equal(paused.startedAt, null);

  const extended = buildPaceClockPayload({
    previous: stored().payload,
    input: { action: "extend", extendMs: 60_000 },
    now,
  });
  assert.equal(extended.durationMs, 90_000);
  assert.equal(extended.elapsedMs, 10_000);
  assert.equal(extended.startedAt, now.toISOString());
});

test("countdown completion is projected without trusting a browser timer", () => {
  const clock = projectPaceClockState(stored({
    durationMs: 8_000,
  }), { audience: "player", now });
  assert.equal(clock.status, "completed");
  assert.equal(clock.elapsedMs, 8_000);
});
