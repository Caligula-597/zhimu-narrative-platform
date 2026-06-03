/**
 * Demo Act 2 · 玩家阅读与第二章解锁（雾港来信种子）
 * 对应 DEMO_ROUTE.md Act 2 步骤 4–7
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";
const fogRoomId = "a65f94eb-a987-463c-bb81-aa482367e54a";

async function fogPlayerRoleId() {
  const result = await query(
    `SELECT rm.role_slot_id
     FROM room_members rm
     WHERE rm.room_id = $1 AND rm.user_id = $2 AND rm.status = 'active'`,
    [fogRoomId, playerUserId]
  );
  assert.ok(result.rowCount, "fog player fixture is required");
  return result.rows[0].role_slot_id;
}

async function fogSections(roleId) {
  return query(
    `SELECT id, title, sequence
     FROM script_sections
     WHERE role_slot_id = $1
     ORDER BY sequence`,
    [roleId]
  );
}

function sectionIds(home) {
  return (home.sections || []).map((section) => section.id);
}

test("Act 2: invite code exposes fog harbor roles", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "GET",
    url: "/api/rooms/invite/FOG-HARBOR-DEMO",
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.world.name, "雾港来信");
  assert.ok(payload.roles.some((role) => role.name.includes("顾言")));
});

test("Act 2: completing first section unlocks second section (第二章)", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleId = await fogPlayerRoleId();
  const sections = await fogSections(roleId);
  assert.ok(sections.rowCount >= 2, "fog seed needs at least two sections");
  const first = sections.rows[0];
  const second = sections.rows[1];
  assert.match(first.title, /档案馆|抵达/);
  assert.match(second.title, /撕去|一页/);

  await query(
    `DELETE FROM reading_progress WHERE room_id = $1 AND role_slot_id = $2 AND script_section_id = ANY($3::uuid[])`,
    [fogRoomId, roleId, [first.id, second.id]]
  );
  await query(
    `DELETE FROM room_content_unlocks
     WHERE room_id = $1 AND content_type = 'script_section' AND content_id = $2`,
    [fogRoomId, second.id]
  );
  await query(
    `DELETE FROM rule_executions
     WHERE room_id = $1
       AND rule_id IN (
         SELECT id FROM automation_rules
         WHERE world_id = (SELECT world_id FROM rooms WHERE id = $1)
           AND name = '读完首章后解锁第二章'
       )`,
    [fogRoomId]
  );

  const homeBefore = await app.inject({
    method: "GET",
    url: `/api/rooms/${fogRoomId}/player-home`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(homeBefore.statusCode, 200);
  const idsBefore = sectionIds(homeBefore.json());
  assert.ok(idsBefore.includes(first.id));
  assert.ok(!idsBefore.includes(second.id));

  const complete = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/sections/${first.id}/complete`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(complete.statusCode, 200);
  assert.equal(complete.json().ok, true);

  const unlock = await query(
    `SELECT 1 FROM room_content_unlocks
     WHERE room_id = $1 AND content_type = 'script_section' AND content_id = $2`,
    [fogRoomId, second.id]
  );
  assert.equal(unlock.rowCount, 1);

  const homeAfter = await app.inject({
    method: "GET",
    url: `/api/rooms/${fogRoomId}/player-home`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(homeAfter.statusCode, 200);
  const idsAfter = sectionIds(homeAfter.json());
  assert.ok(idsAfter.includes(second.id), "second section should become readable");
});

test("Act 2: host players reflect reading progress after first section", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleId = await fogPlayerRoleId();
  const response = await app.inject({
    method: "GET",
    url: `/api/rooms/${fogRoomId}/host/players`,
    headers: { "x-user-id": "154aa8a9-9cd2-4098-90f4-c75e56c0cc53" }
  });
  assert.equal(response.statusCode, 200);
  const player = response.json().players.find((item) => item.role_slot_id === roleId);
  assert.ok(player);
  assert.ok(player.completed_sections >= 1, "host table should show at least one completed section");
});
