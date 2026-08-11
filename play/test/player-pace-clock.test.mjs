import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPlayerPaceClock,
  renderPlayerPaceClock,
} from "../src/runtime/player-pace-clock.js";

test("player clock uses the received server projection and stays absent when private", () => {
  const receivedAt = 1_000_000;
  const clock = {
    mode: "countdown",
    status: "running",
    label: "调查阶段",
    durationMs: 60_000,
    elapsedMs: 10_000,
    visibleToPlayers: true,
    _receivedAt: receivedAt,
  };
  assert.equal(formatPlayerPaceClock(clock, receivedAt + 5_000), "00:45");
  assert.match(renderPlayerPaceClock(clock), /调查阶段/);
  assert.match(renderPlayerPaceClock(clock), /data-player-pace-clock/);
  assert.equal(renderPlayerPaceClock({ ...clock, visibleToPlayers: false }), "");
});
