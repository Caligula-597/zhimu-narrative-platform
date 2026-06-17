import assert from "node:assert/strict";
import { fixtureRoomId, fixtureWorldId } from "./helpers/fixture-ids.js";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";


test("creator can create update and delete items", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;
  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/items`,
    headers: { "x-user-id": hostUserId },
    payload: {
      name: `测试钥匙 ${Date.now()}`,
      publicText: "一把生锈的钥匙",
      hostText: "用于档案室",
      unique: true,
      consumable: false
    }
  });
  assert.equal(created.statusCode, 201);
  const itemId = created.json().id;
  assert.equal(created.json().metadata.unique, true);

  const patched = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/items/${itemId}`,
    headers: { "x-user-id": hostUserId },
    payload: { publicText: "更新后的描述", consumable: true }
  });
  assert.equal(patched.statusCode, 200);
  assert.equal(patched.json().metadata.consumable, true);

  const deleted = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/items/${itemId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(deleted.statusCode, 200);
});

test("host can grant item and player sees inventory", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;
  const roleSlotId = await queryFixtureRoleId();
  const item = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/items`,
    headers: { "x-user-id": hostUserId },
    payload: { name: `发放测试 ${Date.now()}`, publicText: "测试物品", unique: false }
  });
  assert.equal(item.statusCode, 201);
  const itemId = item.json().id;

  const grant = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/grant-item`,
    headers: { "x-user-id": hostUserId },
    payload: { roleSlotId, itemId, quantity: 1 }
  });
  assert.equal(grant.statusCode, 200);

  const home = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/player-home`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(home.statusCode, 200);
  assert.ok(home.json().inventory.some((row) => row.item_id === itemId));

  await query(`DELETE FROM inventory WHERE room_id = $1 AND item_id = $2`, [fixtureRoomId, itemId]);
  await query(`DELETE FROM items WHERE id = $1`, [itemId]);
});

test("investigation requires item and consumes when consumable", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;
  const roleSlotId = await queryFixtureRoleId();
  const scene = await query(`SELECT id FROM scenes WHERE world_id = $1 LIMIT 1`, [worldId]);
  assert.ok(scene.rowCount);
  const sceneId = scene.rows[0].id;

  const itemRes = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/items`,
    headers: { "x-user-id": hostUserId },
    payload: { name: `消耗品 ${Date.now()}`, consumable: true, unique: false }
  });
  const itemId = itemRes.json().id;

  const pointRes = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/scenes/${sceneId}/investigation-points`,
    headers: { "x-user-id": hostUserId },
    payload: {
      name: `物品门 ${Date.now()}`,
      description: "需要钥匙",
      resultText: "门打开了",
      requiredItemId: itemId
    }
  });
  assert.equal(pointRes.statusCode, 201);
  const pointId = pointRes.json().id;

  await query(
    `INSERT INTO room_content_unlocks (room_id, content_type, content_id, unlocked_at)
     VALUES ($1, 'scene', $2, now()) ON CONFLICT DO NOTHING`,
    [fixtureRoomId, sceneId]
  );

  const blocked = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/investigation-points/${pointId}/investigate`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(blocked.statusCode, 409);

  await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/grant-item`,
    headers: { "x-user-id": hostUserId },
    payload: { roleSlotId, itemId, quantity: 1 }
  });

  const ok = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/investigation-points/${pointId}/investigate`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(ok.statusCode, 200);

  const inv = await query(
    `SELECT quantity FROM inventory WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3`,
    [fixtureRoomId, roleSlotId, itemId]
  );
  assert.equal(inv.rowCount, 0);

  await query(`DELETE FROM investigation_points WHERE id = $1`, [pointId]);
  await query(`DELETE FROM items WHERE id = $1`, [itemId]);
});

test("item_owned rule unlocks scene when player has item", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = fixtureWorldId;
  const roleSlotId = await queryFixtureRoleId();

  const itemRes = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/items`,
    headers: { "x-user-id": hostUserId },
    payload: { name: `规则钥匙 ${Date.now()}`, unique: true }
  });
  const itemId = itemRes.json().id;

  const sceneRes = await query(
    `INSERT INTO scenes (world_id, name, public_text) VALUES ($1, $2, '') RETURNING id`,
    [worldId, `规则场景 ${Date.now()}`]
  );
  const sceneId = sceneRes.rows[0].id;

  const ruleRes = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/rules`,
    headers: { "x-user-id": hostUserId },
    payload: {
      roomId: fixtureRoomId,
      name: `拥有钥匙解锁 ${Date.now()}`,
      mode: "automatic",
      priority: 1,
      conditions: {
        all: [{ type: "item_owned", roleSlotId, itemId }]
      },
      actions: [{ type: "unlock_scene", sceneId }]
    }
  });
  assert.equal(ruleRes.statusCode, 201, `rule create failed: ${JSON.stringify(ruleRes.json())}`);

  const grant = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/grant-item`,
    headers: { "x-user-id": hostUserId },
    payload: { roleSlotId, itemId }
  });
  assert.equal(grant.statusCode, 200);
  assert.ok(grant.json().executedRules.length > 0, "item_owned rule should execute on grant-item");

  const unlocked = await query(
    `SELECT 1 FROM room_content_unlocks WHERE room_id = $1 AND content_type = 'scene' AND content_id = $2`,
    [fixtureRoomId, sceneId]
  );
  assert.ok(unlocked.rowCount, "scene should unlock via item_owned rule");

  await query(`DELETE FROM automation_rules WHERE room_id = $1 AND name LIKE '拥有钥匙解锁%'`, [fixtureRoomId]);
  await query(`DELETE FROM scenes WHERE id = $1`, [sceneId]);
  await query(`DELETE FROM items WHERE id = $1`, [itemId]);
});