import assert from "node:assert/strict";
import test from "node:test";
import { PLAN_DEFAULTS } from "../src/plans.js";
import {
  STORAGE_USAGE_SQL,
  storageUsage
} from "../src/routes/world-access-service.js";

test("storageUsage resolves plan, overrides, assets and worlds in one database round trip", async () => {
  const calls = [];
  const usage = await storageUsage("user-1", {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          plan_code: "creator",
          stored_max_bytes: PLAN_DEFAULTS.creator.max_bytes + 100,
          stored_max_worlds: 3,
          stored_max_single_file_bytes: null,
          used_bytes: "456",
          used_worlds: 2
        }]
      };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, STORAGE_USAGE_SQL);
  assert.deepEqual(calls[0].params, ["user-1"]);
  assert.deepEqual(usage, {
    max_bytes: PLAN_DEFAULTS.creator.max_bytes + 100,
    max_worlds: PLAN_DEFAULTS.creator.max_worlds,
    max_single_file_bytes: PLAN_DEFAULTS.creator.max_single_file_bytes,
    used_bytes: 456,
    used_worlds: 2,
    plan_code: "creator"
  });
});

test("storageUsage falls back to the free plan without creating a quota row", async () => {
  const usage = await storageUsage("user-2", {
    query: async () => ({
      rows: [{ plan_code: "unknown", used_bytes: 0, used_worlds: 0 }]
    })
  });

  assert.equal(usage.plan_code, "free");
  assert.equal(usage.max_bytes, PLAN_DEFAULTS.free.max_bytes);
  assert.equal(usage.max_worlds, PLAN_DEFAULTS.free.max_worlds);
});
