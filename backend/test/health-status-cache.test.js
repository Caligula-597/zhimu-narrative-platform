import assert from "node:assert/strict";
import test from "node:test";
import {
  createHealthStatusLoader,
  resolveHealthStatusCacheMs
} from "../src/health-status-cache.js";

test("production health cache is short and bounded", () => {
  assert.equal(resolveHealthStatusCacheMs(undefined, "production"), 1000);
  assert.equal(resolveHealthStatusCacheMs(undefined, "development"), 0);
  assert.equal(resolveHealthStatusCacheMs("2500", "production"), 2500);
  assert.equal(resolveHealthStatusCacheMs("60000", "production"), 1000);
});

test("concurrent health probes share one database read", async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const load = createHealthStatusLoader(async () => {
    calls += 1;
    await gate;
    return { ok: true, sequence: calls };
  }, { ttlMs: 1000 });

  const pending = [load(), load(), load()];
  release();
  const values = await Promise.all(pending);
  assert.equal(calls, 1);
  assert.deepEqual(values, [values[0], values[0], values[0]]);
});

test("failed health probes are not cached", async () => {
  let calls = 0;
  const load = createHealthStatusLoader(async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporary database failure");
    return { ok: true };
  }, { ttlMs: 1000 });

  await assert.rejects(load, /temporary database failure/u);
  assert.deepEqual(await load(), { ok: true });
  assert.equal(calls, 2);
});
