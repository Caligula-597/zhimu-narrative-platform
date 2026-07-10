import assert from "node:assert/strict";
import test from "node:test";
import { runGuardianProductProbes } from "./guardian-product-probes.mjs";

test("runGuardianProductProbes returns structured checks", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () => (url.includes("host/players") ? { players: [] } : { suggestions: [] })
  });
  try {
    const result = await runGuardianProductProbes("http://localhost:4180");
    assert.equal(result.ok, true);
    assert.ok(result.checks.length >= 3);
  } finally {
    globalThis.fetch = original;
  }
});
