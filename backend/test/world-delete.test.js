import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

test("owner can delete world that has parallel rooms", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const register = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: "删除测试",
      email: `delete-world-${Date.now()}@example.invalid`,
      password: "test-pass-123"
    }
  });
  assert.equal(register.statusCode, 201);
  const { token, user } = register.json();

  const create = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "待删除剧本", summary: "含平行房" }
  });
  assert.equal(create.statusCode, 201);
  const worldId = create.json().id;

  const room = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/rooms`,
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "测试房", inviteCode: `DEL-${Date.now()}` }
  });
  assert.equal(room.statusCode, 201);

  const del = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(del.statusCode, 200, del.body);

  const roomsLeft = await query(`SELECT COUNT(*)::int AS n FROM rooms WHERE world_id = $1`, [worldId]);
  assert.equal(roomsLeft.rows[0].n, 0);
  const worldLeft = await query(`SELECT id FROM worlds WHERE id = $1`, [worldId]);
  assert.equal(worldLeft.rowCount, 0);

  const memberLeft = await query(`SELECT 1 FROM world_members WHERE world_id = $1 AND user_id = $2`, [worldId, user.id]);
  assert.equal(memberLeft.rowCount, 0);
});
