import assert from "node:assert/strict";
import test from "node:test";
import { startNonOverlappingInterval } from "../src/non-overlapping-interval.js";

test("startNonOverlappingInterval skips a tick while the task is running", async () => {
  let release;
  let runs = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const interval = startNonOverlappingInterval(async () => {
    runs += 1;
    await gate;
  }, 60_000);

  const first = interval.runNow();
  const second = await interval.runNow();
  assert.equal(second, false);
  assert.equal(runs, 1);
  release();
  assert.equal(await first, true);
  interval.stop();
});

test("startNonOverlappingInterval reports errors without rejecting the timer", async () => {
  let captured;
  const interval = startNonOverlappingInterval(
    async () => { throw new Error("maintenance failed"); },
    60_000,
    { onError: (error) => { captured = error; } }
  );

  assert.equal(await interval.runNow(), false);
  assert.match(captured.message, /maintenance failed/);
  interval.stop();
});
