import assert from "node:assert/strict";
import test from "node:test";
import { state } from "../src/state.js";
import {
  bindHostPaceTimerContext,
  bootstrapPaceTimer,
  resetPaceTimer,
  switchPaceMode,
  tickPaceTimer,
  togglePaceTimer
} from "../src/runtime/host-pace-timer.js";

function installBrowserFakes() {
  const values = new Map();
  const clock = { textContent: "" };
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  globalThis.document = {
    querySelector: (selector) => selector === "[data-host-pace-clock]" ? clock : null
  };
  return { clock, values };
}

test("pace timer persists mode and updates the lightweight clock DOM", () => {
  const { clock, values } = installBrowserFakes();
  let renders = 0;
  bindHostPaceTimerContext({ render: () => { renders += 1; } });
  state.paceTimer = null;

  bootstrapPaceTimer();
  assert.equal(state.paceTimer.mode, "count-up");
  assert.ok(values.size > 0);

  switchPaceMode("countdown-30", 30 * 60 * 1000);
  assert.equal(state.paceTimer.targetMs, 30 * 60 * 1000);
  assert.equal(state.paceTimer.running, false);

  togglePaceTimer();
  assert.equal(state.paceTimer.running, true);
  assert.equal(typeof state.paceTimer.startedAt, "number");

  tickPaceTimer();
  assert.match(clock.textContent, /^(?:30:00|29:5\d)$/);

  resetPaceTimer();
  assert.equal(state.paceTimer.running, false);
  assert.equal(state.paceTimer.elapsedMs, 0);
  assert.ok(renders >= 3);
});
