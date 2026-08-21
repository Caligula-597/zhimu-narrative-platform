import assert from "node:assert/strict";
import test from "node:test";
import { api } from "../src/api.js";
import { state } from "../src/state.js";
import {
  bindHostPaceTimerContext,
  bootstrapPaceTimer,
  formatPaceClock,
  resetPaceTimer,
  switchPaceMode,
  tickPaceTimer,
  togglePaceTimer,
} from "../src/runtime/host-pace-timer.js";

test("pace timer writes versioned room actions and patches the lightweight clock DOM", async () => {
  const clockElement = { textContent: "" };
  globalThis.document = {
    querySelector: (selector) => selector === "[data-host-pace-clock]" ? clockElement : null,
  };
  const calls = [];
  const originalUpdate = api.updateHostPaceClock;
  const originalGet = api.getHostPaceClock;
  api.updateHostPaceClock = async (payload) => {
    calls.push(payload);
    return {
      clock: {
        mode: payload.mode || state.paceTimer.mode,
        status: payload.action === "start" ? "running" : payload.action === "pause" ? "paused" : "idle",
        durationMs: payload.durationMs ?? state.paceTimer.durationMs,
        elapsedMs: 0,
        visibleToPlayers: false,
        revision: calls.length,
      },
    };
  };
  api.getHostPaceClock = async () => ({ clock: state.paceTimer });
  let renders = 0;
  bindHostPaceTimerContext({ render: () => { renders += 1; }, showToast: () => {} });
  state.paceTimer = null;

  bootstrapPaceTimer();
  assert.equal(state.paceTimer.mode, "countup");
  await switchPaceMode("countdown", 30 * 60 * 1000);
  assert.equal(calls[0].action, "configure");
  assert.equal(calls[0].expectedRevision, 0);
  assert.equal(state.paceTimer.durationMs, 30 * 60 * 1000);

  await togglePaceTimer();
  assert.equal(calls[1].action, "start");
  assert.equal(calls[1].expectedRevision, 1);
  assert.equal(state.paceTimer.status, "running");
  tickPaceTimer();
  assert.match(clockElement.textContent, /^(?:30:00|29:5\d)$/);

  await resetPaceTimer();
  assert.equal(calls[2].action, "reset");
  assert.equal(state.paceTimer.status, "idle");
  assert.ok(renders >= 3);
  assert.equal(formatPaceClock({ mode: "countup", status: "paused", elapsedMs: 65_000 }), "01:05");

  api.updateHostPaceClock = originalUpdate;
  api.getHostPaceClock = originalGet;
});
