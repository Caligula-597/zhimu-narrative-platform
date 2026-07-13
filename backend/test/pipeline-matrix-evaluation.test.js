import assert from "node:assert/strict";
import test from "node:test";
import { mapWithConcurrency } from "../src/pipeline-matrix-evaluation.js";

test("matrix audit worker preserves order and limits concurrent LLM calls", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency(
    [0, 1, 2, 3, 4, 5, 6],
    async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, value % 2 ? 2 : 5));
      active -= 1;
      return value * 2;
    },
    3
  );

  assert.deepEqual(result, [0, 2, 4, 6, 8, 10, 12]);
  assert.equal(peak, 3);
});

test("matrix audit concurrency is capped to protect the provider", async () => {
  let active = 0;
  let peak = 0;
  await mapWithConcurrency(
    Array.from({ length: 12 }, (_, index) => index),
    async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
    },
    99
  );
  assert.equal(peak, 4);
});
