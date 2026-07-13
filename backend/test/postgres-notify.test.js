import assert from "node:assert/strict";
import test from "node:test";
import { safePostgresNotify } from "../src/postgres-notify.js";

test("pg_notify failure is contained after the authoritative write", async () => {
  let reported = null;
  const result = await safePostgresNotify({
    channel: "zhimu_test_events",
    payload: "{}",
    queryFn: async () => { throw new Error("notify unavailable"); },
    onError: (error) => { reported = error; }
  });
  assert.equal(result, false);
  assert.match(reported.message, /notify unavailable/);
});
