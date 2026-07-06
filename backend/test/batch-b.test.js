import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";

async function fixtureWorldId() {
  const { rows } = await query(`SELECT world_id FROM rooms WHERE id = $1`, [fixtureRoomId]);
  return rows[0].world_id;
}

test("player tasks complete flow", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fixtureWorldId();
  const roleSlotId = await queryFixtureRoleId();

  const homeProbe = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/player-home`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(homeProbe.statusCode, 200);
  const actKey = homeProbe.json().currentActKey || "ch1";

  const task = await query(
    `INSERT INTO player_tasks (world_id, role_slot_id, act_key, body, tips, visibility, sequence, source)
     VALUES ($1, $2, $3, '向他人确认案发前行踪', '可公聊', 'public', 1, 'test')
     RETURNING id`,
    [worldId, roleSlotId, actKey]
  );
  context.after(async () => {
    await query(`DELETE FROM player_task_progress WHERE player_task_id = $1`, [task.rows[0].id]);
    await query(`DELETE FROM player_tasks WHERE id = $1`, [task.rows[0].id]);
  });

  const home = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/player-home`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(home.statusCode, 200);
  assert.ok(home.json().tasks?.some((row) => row.id === task.rows[0].id));

  const done = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/player-tasks/${task.rows[0].id}/complete`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(done.statusCode, 200);
  assert.equal(done.json().progress.status, "completed");
});

test("player suspicion upsert", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const observerRole = await queryFixtureRoleId();
  const peer = await query(
    `SELECT rs.id FROM role_slots rs
     JOIN rooms r ON r.world_id = rs.world_id
     WHERE r.id = $1 AND rs.id <> $2
     ORDER BY rs.sequence LIMIT 1`,
    [fixtureRoomId, observerRole]
  );
  assert.ok(peer.rowCount);
  const targetRole = peer.rows[0].id;

  const res = await app.inject({
    method: "PUT",
    url: `/api/rooms/${fixtureRoomId}/suspicions/${targetRole}`,
    headers: { "x-user-id": playerUserId },
    payload: { level: 4, reason: "时间线对不上" }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().suspicion.level, 4);

  context.after(async () => {
    await query(
      `DELETE FROM player_suspicions WHERE room_id = $1 AND observer_role_slot_id = $2 AND target_role_slot_id = $3`,
      [fixtureRoomId, observerRole, targetRole]
    );
  });
});

test("testimony submit and host review", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const submit = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/testimonies`,
    headers: { "x-user-id": playerUserId },
    payload: { actKey: "ch1", body: "案发时我在大厅，没有进过书房。" }
  });
  assert.equal(submit.statusCode, 200);
  const testimonyId = submit.json().testimony.id;

  const hostList = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/host/testimonies`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(hostList.statusCode, 200);
  assert.ok(hostList.json().items.some((row) => row.id === testimonyId));

  const review = await app.inject({
    method: "PATCH",
    url: `/api/rooms/${fixtureRoomId}/host/testimonies/${testimonyId}`,
    headers: { "x-user-id": hostUserId },
    payload: { hostFlag: "contradiction", hostNote: "与线索 3 冲突" }
  });
  assert.equal(review.statusCode, 200);
  assert.equal(review.json().testimony.host_flag, "contradiction");

  context.after(async () => {
    await query(`DELETE FROM testimonies WHERE id = $1`, [testimonyId]);
  });
});

test("world tags and catalog filter", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fixtureWorldId();

  await query(`UPDATE worlds SET catalog_public = true WHERE id = $1`, [worldId]);
  context.after(async () => {
    await query(`UPDATE worlds SET catalog_public = false WHERE id = $1`, [worldId]);
    await query(`DELETE FROM world_tags WHERE world_id = $1`, [worldId]);
  });

  const put = await app.inject({
    method: "PUT",
    url: `/api/worlds/${worldId}/tags`,
    headers: { "x-user-id": hostUserId },
    payload: { tags: [{ tagKey: "players", tagValue: "6" }, { tagKey: "difficulty", tagValue: "medium" }] }
  });
  assert.equal(put.statusCode, 200);
  assert.equal(put.json().tags.length, 2);

  const facets = await app.inject({
    method: "GET",
    url: "/api/worlds/catalog/tag-facets",
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(facets.statusCode, 200);
  assert.ok(facets.json().facets.players);
});

test("segment remedy create and host apply", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fixtureWorldId();

  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/segment-remedies`,
    headers: { "x-user-id": hostUserId },
    payload: {
      segmentKey: "ch1",
      title: "暗示去书房",
      hostScript: "请大家留意书房门闩是否有异常。",
      triggerHint: "玩家 10 分钟无进展"
    }
  });
  assert.equal(created.statusCode, 201);
  const remedyId = created.json().item.id;

  const apply = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/segment-remedies/${remedyId}/apply`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(apply.statusCode, 200);

  context.after(async () => {
    await query(`DELETE FROM segment_remedies WHERE id = $1`, [remedyId]);
  });
});

test("satisfaction feedback requires auth and room membership", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const res = await app.inject({
    method: "POST",
    url: "/api/feedback",
    headers: { "x-user-id": playerUserId },
    payload: {
      kind: "satisfaction",
      subject: "满意度 5/5",
      body: "节奏很好",
      roomId: fixtureRoomId
    }
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().kind, "satisfaction");

  context.after(async () => {
    await query(`DELETE FROM feedback WHERE id = $1`, [res.json().id]);
  });
});
