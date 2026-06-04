import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

test("GET /worlds hides archived worlds by default", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const archived = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, $2, $3, 'archived') RETURNING id`,
    [hostUserId, `archived-filter-${Date.now()}`, "should not appear in default list"]
  );
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [archived.rows[0].id]);
  });
  await query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')
     ON CONFLICT (world_id, user_id) DO NOTHING`,
    [archived.rows[0].id, hostUserId]
  );

  const defaultList = await app.inject({
    method: "GET",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(defaultList.statusCode, 200);
  assert.ok(!defaultList.json().some((world) => world.id === archived.rows[0].id));

  const fullList = await app.inject({
    method: "GET",
    url: "/api/worlds?includeArchived=true",
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(fullList.statusCode, 200);
  assert.ok(fullList.json().some((world) => world.id === archived.rows[0].id));
});