import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

test("clue PATCH preserves assetId when metadata merged", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const world = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Clue asset ${Date.now()}`, summary: "test" }
  });
  const worldId = world.json().id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const assetId = "00000000-0000-4000-8000-00000000aa01";
  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/clues`,
    headers: { "x-user-id": hostUserId },
    payload: {
      name: "测试线索",
      publicText: "正文",
      hostText: "",
      visibility: "role",
      metadata: { assetId, clueType: "file", importance: "key" }
    }
  });
  assert.equal(created.statusCode, 201, created.body);
  const clueId = created.json().id;

  const updated = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/clues/${clueId}`,
    headers: { "x-user-id": hostUserId },
    payload: {
      name: "测试线索 · 改名",
      metadata: { assetId, clueType: "file", importance: "key" }
    }
  });
  assert.equal(updated.statusCode, 200, updated.body);
  assert.equal(updated.json().metadata?.assetId, assetId);
});
