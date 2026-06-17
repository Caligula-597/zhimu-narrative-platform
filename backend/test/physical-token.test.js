import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";
const fogRoomId = "11111111-2222-4333-8444-555555550002";

async function fogWorldId() {
  const result = await query(`SELECT world_id FROM rooms WHERE id = $1`, [fogRoomId]);
  return result.rows[0].world_id;
}

async function fogRoleId() {
  const result = await query(
    `SELECT role_slot_id FROM room_members WHERE room_id = $1 AND user_id = $2 AND status = 'active'`,
    [fogRoomId, playerUserId]
  );
  return result.rows[0].role_slot_id;
}

test("creator issues lists revokes physical tokens", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fogWorldId();
  const clue = await query(`SELECT id FROM clues WHERE world_id = $1 ORDER BY created_at LIMIT 1`, [worldId]);
  assert.ok(clue.rowCount);

  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/physical-tokens`,
    headers: { "x-user-id": hostUserId },
    payload: {
      contentType: "clue",
      contentId: clue.rows[0].id,
      count: 2,
      label: "测试实体卡",
      metadata: { integration: { provider: "tump", campaignId: "demo-campaign", costAmount: 10 } }
    }
  });
  assert.equal(created.statusCode, 201, created.body);
  const tokens = created.json().tokens;
  assert.equal(tokens.length, 2);
  assert.match(tokens[0].tokenCode, /^ZHM-/);

  const list = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/physical-tokens?status=issued`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().tokens.some((row) => row.id === tokens[0].id));

  const revoked = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/physical-tokens/${tokens[1].id}/revoke`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(revoked.statusCode, 200);
  assert.equal(revoked.json().token.status, "revoked");

  context.after(async () => {
    await query(`DELETE FROM physical_tokens WHERE id = ANY($1::uuid[])`, [tokens.map((row) => row.id)]);
  });
});

test("player activates clue token once in room", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fogWorldId();
  const roleSlotId = await fogRoleId();
  const clue = await query(
    `SELECT c.id FROM clues c
     WHERE c.world_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM clue_ownership co
         WHERE co.room_id = $2 AND co.role_slot_id = $3 AND co.clue_id = c.id
       )
     ORDER BY c.created_at LIMIT 1`,
    [worldId, fogRoomId, roleSlotId]
  );
  assert.ok(clue.rowCount, "need unowned clue for activation test");

  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/physical-tokens`,
    headers: { "x-user-id": hostUserId },
    payload: { contentType: "clue", contentId: clue.rows[0].id, label: "激活测试" }
  });
  assert.equal(created.statusCode, 201);
  const token = created.json().tokens[0];

  const preview = await app.inject({
    method: "GET",
    url: `/api/physical-tokens/${token.tokenCode}/preview`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(preview.statusCode, 200);
  assert.equal(preview.json().status, "issued");

  const activate = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/physical-tokens/activate`,
    headers: { "x-user-id": playerUserId },
    payload: { tokenCode: token.tokenCode }
  });
  assert.equal(activate.statusCode, 200, activate.body);
  assert.equal(activate.json().effect.effect, "grant_clue");

  const again = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/physical-tokens/activate`,
    headers: { "x-user-id": playerUserId },
    payload: { tokenCode: token.tokenCode }
  });
  assert.equal(again.statusCode, 409);

  const owned = await query(
    `SELECT 1 FROM clue_ownership WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3`,
    [fogRoomId, roleSlotId, clue.rows[0].id]
  );
  assert.ok(owned.rowCount);

  context.after(async () => {
    await query(`DELETE FROM clue_ownership WHERE room_id = $1 AND clue_id = $2 AND role_slot_id = $3`, [
      fogRoomId,
      clue.rows[0].id,
      roleSlotId
    ]);
    await query(`DELETE FROM physical_tokens WHERE id = $1`, [token.id]);
  });
});

test("tump-gated token requires external proof", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fogWorldId();
  const item = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/items`,
    headers: { "x-user-id": hostUserId },
    payload: { name: `tump卡 ${Date.now()}`, publicText: "联动测试" }
  });
  assert.equal(item.statusCode, 201);
  const itemId = item.json().id;

  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/physical-tokens`,
    headers: { "x-user-id": hostUserId },
    payload: {
      contentType: "item",
      contentId: itemId,
      tokenCode: "ZHM-DEMTMPPKARD23",
      activationRule: { externalGate: { provider: "tump", required: true, minAmount: 5 } },
      metadata: { integration: { provider: "tump", sku: "tump-demo" } }
    }
  });
  assert.equal(created.statusCode, 201, created.body);
  const tokenCode = created.json().tokens[0].tokenCode;

  const blocked = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/physical-tokens/activate`,
    headers: { "x-user-id": playerUserId },
    payload: { tokenCode }
  });
  assert.equal(blocked.statusCode, 402);

  const ok = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/physical-tokens/activate`,
    headers: { "x-user-id": playerUserId },
    payload: {
      tokenCode,
      externalProof: { provider: "tump", transactionId: "tump-tx-demo-001", amount: 10 }
    }
  });
  assert.equal(ok.statusCode, 200, ok.body);
  assert.equal(ok.json().effect.effect, "grant_item");

  context.after(async () => {
    await query(`DELETE FROM inventory WHERE room_id = $1 AND item_id = $2`, [fogRoomId, itemId]);
    await query(`DELETE FROM physical_tokens WHERE token_code = $1`, [tokenCode]);
    await query(`DELETE FROM items WHERE id = $1`, [itemId]);
  });
});
