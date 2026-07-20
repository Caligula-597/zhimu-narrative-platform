import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { evaluateRoomRules, previewRoomRules, triggerManualRule } from "../src/rule-engine.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

async function createRuleFixture(suffix) {
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, $2, 'rule runtime fixture', 'testing')
     RETURNING id`,
    [hostUserId, `规则运行时 ${suffix}`]
  );
  const role = await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, '测试角色', 1)
     RETURNING id`,
    [world.rows[0].id]
  );
  const item = await query(
    `INSERT INTO items (world_id, name, public_text, metadata)
     VALUES ($1, '规则测试物品', 'desc', '{"unique":false}'::jsonb)
     RETURNING id`,
    [world.rows[0].id]
  );
  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, $3, $4, 'testing')
     RETURNING id`,
    [world.rows[0].id, hostUserId, `规则房 ${suffix}`, `RR-${suffix}`]
  );
  await query(
    `INSERT INTO room_members (room_id, user_id, member_type, status)
     VALUES ($1, $2, 'host', 'active')
     ON CONFLICT (room_id, user_id) DO UPDATE SET status = 'active'`,
    [room.rows[0].id, hostUserId]
  );
  return {
    worldId: world.rows[0].id,
    roomId: room.rows[0].id,
    roleId: role.rows[0].id,
    itemId: item.rows[0].id
  };
}

async function deleteFixture(worldId) {
  await query(`DELETE FROM rooms WHERE world_id = $1`, [worldId]);
  await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
}

test("automatic grant_item rule adds inventory once", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const fx = await createRuleFixture(suffix);
  context.after(() => deleteFixture(fx.worldId));

  const rule = await query(
    `INSERT INTO automation_rules (world_id, room_id, name, mode, enabled, conditions, actions)
     VALUES ($1, $2, '发放测试物品', 'automatic', true, $3::jsonb, $4::jsonb)
     RETURNING id`,
    [
      fx.worldId,
      fx.roomId,
      JSON.stringify({ all: [{ type: "item_owned", roleSlotId: fx.roleId, itemId: fx.itemId }] }),
      JSON.stringify([{ type: "grant_item", roleSlotId: fx.roleId, itemId: fx.itemId, quantity: 2 }])
    ]
  );

  await query(
    `INSERT INTO inventory (room_id, role_slot_id, item_id, quantity)
     VALUES ($1, $2, $3, 1)`,
    [fx.roomId, fx.roleId, fx.itemId]
  );

  const executed = await evaluateRoomRules(fx.roomId);
  assert.deepEqual(executed, [rule.rows[0].id]);

  const inv = await query(
    `SELECT quantity FROM inventory WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3`,
    [fx.roomId, fx.roleId, fx.itemId]
  );
  assert.equal(Number(inv.rows[0].quantity), 3);
});

test("manual rule trigger executes actions when conditions met", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const fx = await createRuleFixture(suffix);
  context.after(() => deleteFixture(fx.worldId));

  const rule = await query(
    `INSERT INTO automation_rules (world_id, room_id, name, mode, enabled, conditions, actions)
     VALUES ($1, $2, '手动发放', 'manual', true, $3::jsonb, $4::jsonb)
     RETURNING id`,
    [
      fx.worldId,
      fx.roomId,
      JSON.stringify({ all: [{ type: "item_owned", roleSlotId: fx.roleId, itemId: fx.itemId }] }),
      JSON.stringify([{ type: "grant_item", roleSlotId: fx.roleId, itemId: fx.itemId, quantity: 1 }])
    ]
  );

  await query(
    `INSERT INTO inventory (room_id, role_slot_id, item_id, quantity)
     VALUES ($1, $2, $3, 1)`,
    [fx.roomId, fx.roleId, fx.itemId]
  );

  const result = await triggerManualRule(fx.roomId, rule.rows[0].id);
  assert.equal(result.ok, true);

  const inv = await query(
    `SELECT quantity FROM inventory WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3`,
    [fx.roomId, fx.roleId, fx.itemId]
  );
  assert.equal(Number(inv.rows[0].quantity), 2);

  const again = await triggerManualRule(fx.roomId, rule.rows[0].id);
  assert.equal(again.ok, true);
  const inv2 = await query(
    `SELECT quantity FROM inventory WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3`,
    [fx.roomId, fx.roleId, fx.itemId]
  );
  assert.equal(Number(inv2.rows[0].quantity), 3, "manual rules may fire repeatedly");
});

test("previewRoomRules reports would_execute without writes", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const fx = await createRuleFixture(suffix);
  context.after(() => deleteFixture(fx.worldId));

  await query(
    `INSERT INTO automation_rules (world_id, room_id, name, mode, enabled, conditions, actions)
     VALUES ($1, $2, '预览规则', 'automatic', true, $3::jsonb, $4::jsonb)`,
    [
      fx.worldId,
      fx.roomId,
      JSON.stringify({ all: [{ type: "item_owned", roleSlotId: fx.roleId, itemId: fx.itemId }] }),
      JSON.stringify([{ type: "timeline_log", message: "preview probe" }])
    ]
  );

  await query(
    `INSERT INTO inventory (room_id, role_slot_id, item_id, quantity)
     VALUES ($1, $2, $3, 1)`,
    [fx.roomId, fx.roleId, fx.itemId]
  );

  const preview = await previewRoomRules(fx.roomId);
  assert.equal(preview.length, 1);
  assert.equal(preview[0].status, "would_execute");
  assert.ok(preview[0].conditionTrace);
  assert.equal(preview[0].failedConditions.length, 0);

  const logsBefore = await query(`SELECT 1 FROM timeline_logs WHERE room_id = $1 AND message = 'preview probe'`, [fx.roomId]);
  assert.equal(logsBefore.rowCount, 0);
});

test("previewRoomRules evaluates each condition leaf once", async () => {
  let queryCount = 0;
  const executor = async (sql) => {
    queryCount += 1;
    if (sql.includes("FROM automation_rules")) {
      return {
        rows: [{
          id: "rule-query-budget",
          name: "Query budget",
          mode: "automatic",
          priority: 100,
          conditions: {
            all: [{ type: "item_owned", roleSlotId: "role-1", itemId: "item-1" }]
          },
          enabled: true,
          already_executed: false,
          pending_host_event: false
        }]
      };
    }
    return { rows: [{ ok: true }], rowCount: 1 };
  };

  const preview = await previewRoomRules("room-query-budget", { executor });
  assert.equal(preview[0].conditionsMet, true);
  assert.equal(queryCount, 2, "one list query plus one query for the single condition leaf");
});

test("host can preview and trigger manual rules via API", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const fx = await createRuleFixture(suffix);
  context.after(() => deleteFixture(fx.worldId));

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const rule = await query(
    `INSERT INTO automation_rules (world_id, room_id, name, mode, enabled, conditions, actions)
     VALUES ($1, $2, 'API 手动规则', 'manual', true, $3::jsonb, $4::jsonb)
     RETURNING id`,
    [
      fx.worldId,
      fx.roomId,
      JSON.stringify({ all: [{ type: "item_owned", roleSlotId: fx.roleId, itemId: fx.itemId }] }),
      JSON.stringify([{ type: "timeline_log", message: "api manual trigger" }])
    ]
  );

  await query(
    `INSERT INTO inventory (room_id, role_slot_id, item_id, quantity)
     VALUES ($1, $2, $3, 1)`,
    [fx.roomId, fx.roleId, fx.itemId]
  );

  const preview = await app.inject({
    method: "GET",
    url: `/api/rooms/${fx.roomId}/rules/preview`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(preview.statusCode, 200);
  assert.ok(preview.json().rules.some((row) => row.id === rule.rows[0].id && row.status === "manual_ready"));

  const trigger = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/rules/${rule.rows[0].id}/trigger`,
    headers: { "x-user-id": hostUserId, "idempotency-key": `manual-${suffix}` }
  });
  assert.equal(trigger.statusCode, 200);
  assert.equal(trigger.json().ok, true);

  const log = await query(
    `SELECT 1 FROM timeline_logs WHERE room_id = $1 AND message = 'api manual trigger'`,
    [fx.roomId]
  );
  assert.equal(log.rowCount, 1);
});
