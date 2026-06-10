import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fogRoomId } from "./helpers/fixture-ids.js";

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

test("GET /worlds includes worlds visible through active room membership", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const room = await query(`SELECT world_id FROM rooms WHERE id = $1`, [fogRoomId]);
  const fogWorldId = room.rows[0].world_id;
  const role = await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, $2, 9999) RETURNING id`,
    [fogWorldId, `room-player-role-${Date.now()}`]
  );
  const roleSlotId = role.rows[0].id;
  const user = await query(
    `INSERT INTO users (display_name, email) VALUES ($1, $2) RETURNING id`,
    [`room-player-${Date.now()}`, `room-player-${Date.now()}@example.test`]
  );
  const roomPlayerId = user.rows[0].id;

  await query(
    `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id, status)
     VALUES ($1, $2, 'player', $3, 'active')
     ON CONFLICT (room_id, user_id)
     DO UPDATE SET role_slot_id = EXCLUDED.role_slot_id, status = 'active'`,
    [fogRoomId, roomPlayerId, roleSlotId]
  );
  context.after(async () => {
    await query(`DELETE FROM room_members WHERE room_id = $1 AND user_id = $2`, [fogRoomId, roomPlayerId]);
    await query(`DELETE FROM role_slots WHERE id = $1`, [roleSlotId]);
    await query(`DELETE FROM users WHERE id = $1`, [roomPlayerId]);
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/worlds",
    headers: { "x-user-id": roomPlayerId }
  });

  assert.equal(response.statusCode, 200);
  const world = response.json().find((row) => row.id === fogWorldId);
  assert.equal(world?.membership_role, "player");
});
