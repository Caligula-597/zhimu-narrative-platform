import assert from "node:assert/strict";
import test from "node:test";
import { createQueryScheduler } from "../src/recap-query-scheduler.js";

test("recap query scheduler limits concurrent database work", async () => {
  const schedule = createQueryScheduler({ concurrency: 3 });
  let active = 0;
  let peak = 0;
  const tasks = Array.from({ length: 10 }, (_, index) => schedule(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return index;
  }));
  assert.deepEqual(await Promise.all(tasks), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(peak, 3);
});

test("recap query scheduler releases a slot after rejection", async () => {
  const schedule = createQueryScheduler({ concurrency: 1 });
  const first = schedule(async () => { throw new Error("failed"); });
  const second = schedule(async () => "continued");
  await assert.rejects(first, /failed/);
  assert.equal(await second, "continued");
});
