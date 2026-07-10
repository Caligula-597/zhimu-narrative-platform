import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { searchWorldContent } from "../src/world-search.js";
import { fixtureWorldId, hostUserId } from "./helpers/fixture-ids.js";

const worldId = process.env.SMOKE_WORLD_ID || fixtureWorldId;

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

test("world search supports knowledge type filter", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const marker = `knowledge-only-${Date.now()}`;

  await query(
    `INSERT INTO knowledge_chunks (world_id, source_type, visibility, chunk_index, title, body, metadata)
     VALUES ($1, 'story_manuscript', 'author', 9001, $2, $3, $4::jsonb)
     ON CONFLICT (world_id, source_type, source_id, role_slot_id, chunk_index)
     DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, metadata = EXCLUDED.metadata`,
    [worldId, "Knowledge filter probe", marker, JSON.stringify({ test: "world-search" })]
  );
  context.after(async () => {
    await query(`DELETE FROM knowledge_chunks WHERE world_id = $1 AND metadata->>'test' = 'world-search'`, [worldId]);
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/search?q=${encodeURIComponent(marker)}&type=knowledge&limit=5`,
    headers: { "x-user-id": hostUserId }
  });

  assert.equal(response.statusCode, 200, response.body);
  const payload = response.json();
  assert.ok(payload.results.length >= 1);
  assert.ok(payload.results.every((row) => row.type === "knowledge"));
});
