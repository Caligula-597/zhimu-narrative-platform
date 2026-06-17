import test from "node:test";
import assert from "node:assert/strict";
import { searchWorldContent } from "../src/world-search.js";

const worldId = process.env.SMOKE_WORLD_ID || "11111111-2222-4333-8444-555555550001";

test("searchWorldContent returns unified result shape", async () => {
  const payload = await searchWorldContent(worldId, { q: "测试", limit: 10 });
  assert.equal(typeof payload.query, "string");
  assert.ok(Array.isArray(payload.results));
  if (payload.results.length) {
    const row = payload.results[0];
    assert.ok(row.type);
    assert.ok(row.id);
    assert.ok(row.title);
    assert.ok(row.view);
  }
});

test("searchWorldContent empty query", async () => {
  const payload = await searchWorldContent(worldId, { q: "   " });
  assert.deepEqual(payload.results, []);
});
