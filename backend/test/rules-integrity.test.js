import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { pool, query } from "../src/db.js";
import { lockRuleReferences } from "../src/repositories/rules-repository.js";
import { fixtureWorldId, hostUserId } from "./helpers/fixture-ids.js";

async function fixtureRoleSections() {
  const result = await query(
    `SELECT role_slot.id AS role_id, section.id AS section_id
     FROM role_slots role_slot
     JOIN script_sections section ON section.role_slot_id = role_slot.id
     WHERE role_slot.world_id = $1
     ORDER BY role_slot.sequence, section.sequence`,
    [fixtureWorldId]
  );
  assert.ok(result.rowCount >= 2, "two role/section fixtures required");
  const first = result.rows[0];
  const other = result.rows.find((row) => row.role_id !== first.role_id);
  assert.ok(other, "a section owned by another role is required");
  return { first, other };
}

function validPayload(roleId, sectionId, overrides = {}) {
  return {
    name: "规则完整性测试",
    priority: 0,
    conditions: {
      all: [{ type: "reading_completed", roleSlotId: roleId, scriptSectionId: sectionId }]
    },
    actions: [{ type: "timeline_log", message: "完整性测试通过" }],
    ...overrides
  };
}

test("rule create and update preserve priority zero and trim names", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const { first } = await fixtureRoleSections();
  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/rules`,
    headers: { "x-user-id": hostUserId },
    payload: validPayload(first.role_id, first.section_id, { name: "  零优先级规则  " })
  });
  assert.equal(created.statusCode, 201, created.body);
  assert.equal(created.json().name, "零优先级规则");
  assert.equal(created.json().priority, 0);
  context.after(() => query(`DELETE FROM automation_rules WHERE id = $1`, [created.json().id]));

  const updated = await app.inject({
    method: "PUT",
    url: `/api/worlds/${fixtureWorldId}/rules/${created.json().id}`,
    headers: { "x-user-id": hostUserId },
    payload: validPayload(first.role_id, first.section_id, { name: "  更新后规则  ", priority: 0 })
  });
  assert.equal(updated.statusCode, 200, updated.body);
  assert.equal(updated.json().name, "更新后规则");
  assert.equal(updated.json().priority, 0);
});

test("rule writes reject whitespace names and inconsistent role sections without revision drift", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const { first, other } = await fixtureRoleSections();
  const revisionBefore = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [fixtureWorldId]);

  const whitespace = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/rules`,
    headers: { "x-user-id": hostUserId },
    payload: validPayload(first.role_id, first.section_id, { name: "   " })
  });
  assert.equal(whitespace.statusCode, 400, whitespace.body);
  assert.equal(whitespace.json().code, "NAME_EMPTY");

  const mismatched = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/rules`,
    headers: { "x-user-id": hostUserId },
    payload: validPayload(first.role_id, other.section_id)
  });
  assert.equal(mismatched.statusCode, 422, mismatched.body);
  assert.equal(mismatched.json().code, "RULE_BODY_INVALID");
  assert.ok(mismatched.json().details.errors.some((item) => item.message.includes("分幕不属于所选角色")));

  let tooDeepConditions = {
    type: "reading_completed",
    roleSlotId: first.role_id,
    scriptSectionId: first.section_id
  };
  for (let index = 0; index < 13; index += 1) tooDeepConditions = { not: tooDeepConditions };
  const tooDeep = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/rules`,
    headers: { "x-user-id": hostUserId },
    payload: validPayload(first.role_id, first.section_id, { conditions: tooDeepConditions })
  });
  assert.equal(tooDeep.statusCode, 422, tooDeep.body);
  assert.equal(tooDeep.json().code, "RULE_BODY_INVALID");
  assert.ok(tooDeep.json().details.errors.some((item) => item.message.includes("不能超过 12 层")));

  const revisionAfter = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [fixtureWorldId]);
  assert.equal(revisionAfter.rows[0].content_revision, revisionBefore.rows[0].content_revision);
});

test("rule writes reject a room from another world without revision drift", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const { first } = await fixtureRoleSections();
  const foreignWorld = await query(
    `INSERT INTO worlds (owner_user_id, name) VALUES ($1, $2) RETURNING id`,
    [hostUserId, `rule-foreign-${Date.now()}`]
  );
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [foreignWorld.rows[0].id]));
  const foreignRoom = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code)
     VALUES ($1, $2, 'foreign-rule-room', $3)
     RETURNING id`,
    [foreignWorld.rows[0].id, hostUserId, `RULE-${Date.now()}-${Math.random().toString(16).slice(2)}`]
  );
  const revisionBefore = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [fixtureWorldId]);
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/rules`,
    headers: { "x-user-id": hostUserId },
    payload: validPayload(first.role_id, first.section_id, { roomId: foreignRoom.rows[0].id })
  });
  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, "RULE_ROOM_WORLD_MISMATCH");
  const revisionAfter = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [fixtureWorldId]);
  assert.equal(revisionAfter.rows[0].content_revision, revisionBefore.rows[0].content_revision);
});

test("rule reference validation holds key-share locks until the revision transaction ends", async (context) => {
  const scene = await query(
    `INSERT INTO scenes (world_id, name) VALUES ($1, $2) RETURNING id`,
    [fixtureWorldId, `rule-reference-lock-${Date.now()}`]
  );
  context.after(() => query(`DELETE FROM scenes WHERE id = $1`, [scene.rows[0].id]));
  const locker = await pool.connect();
  const contender = await pool.connect();
  try {
    await locker.query("BEGIN");
    await lockRuleReferences(locker, {
      worldId: fixtureWorldId,
      roleSlotIds: [],
      scriptSectionIds: [],
      sceneIds: [scene.rows[0].id],
      clueIds: [],
      investigationPointIds: [],
      itemIds: []
    });
    await contender.query(`SET lock_timeout = '100ms'`);
    await assert.rejects(
      contender.query(`DELETE FROM scenes WHERE id = $1`, [scene.rows[0].id]),
      (error) => error.code === "55P03"
    );
  } finally {
    await locker.query("ROLLBACK").catch(() => {});
    await contender.query("RESET lock_timeout").catch(() => {});
    locker.release();
    contender.release();
  }
});

test("rule world-order index supports creator lists and snapshots", async () => {
  const index = await query(
    `SELECT indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'idx_automation_rules_world_priority_created'`
  );
  assert.equal(index.rowCount, 1);
  assert.match(index.rows[0].indexdef, /\(world_id, priority, created_at\)/);
});
