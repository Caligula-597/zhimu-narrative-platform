import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId } from "./helpers/fixture-ids.js";

test("POST /worlds/:id/catalog/request blocked when publish readiness fails", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const suffix = `${Date.now()}`;
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, $2, 'empty for catalog gate', 'testing')
     RETURNING id`,
    [hostUserId, `未就绪 ${suffix}`]
  );
  const worldId = world.rows[0].id;
  await query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [
    worldId,
    hostUserId
  ]);

  context.after(async () => {
    await query(`DELETE FROM world_members WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/catalog/request`,
    headers: { "x-user-id": hostUserId },
    payload: {
      playtestNotes: "三人完整跑通开始体验流程，分幕与角色正常。",
      themeNotes: "悬疑推理题材，无真实人物影射，无色情暴力描写。",
      agreed: true
    }
  });
  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.code, "CATALOG_READINESS_BLOCKED");
  assert.ok(Array.isArray(body.details?.issues));
  assert.equal(body.details.readyForCatalog, false);
});
