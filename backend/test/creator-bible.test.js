import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { query, transaction } from "../src/db.js";
import { getCoreTrick, upsertCoreTrick } from "../src/creator-bible.js";
import { FIXTURE } from "../scripts/fixture-constants.mjs";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

async function fixtureWorldId() {
  const { rows } = await query(`SELECT world_id FROM rooms WHERE id = $1`, [fixtureRoomId]);
  return rows[0].world_id;
}

test("bible write helpers honor transaction rollback", async () => {
  const worldId = await fixtureWorldId();
  const before = await getCoreTrick(worldId);
  const marker = `rollback-marker-${Date.now()}`;

  await assert.rejects(
    transaction(async (client) => {
      await upsertCoreTrick(worldId, { summary: marker }, { patch: true, client });
      throw new Error("force rollback");
    }),
    /force rollback/
  );

  const after = await getCoreTrick(worldId);
  assert.equal(after?.summary ?? "", before?.summary ?? "");
});

test("bible summary and core trick upsert", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fixtureWorldId();

  const summaryRes = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/bible/summary`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(summaryRes.statusCode, 200);
  assert.ok(summaryRes.json().counts);

  const patchRes = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/bible/core-trick`,
    headers: { "x-user-id": hostUserId },
    payload: { summary: "测试核诡摘要", method: "密室手法", motive: "复仇" }
  });
  assert.equal(patchRes.statusCode, 200);
  assert.equal(patchRes.json().coreTrick.method, "密室手法");

  const getRes = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/bible/core-trick`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(getRes.json().coreTrick.summary, "测试核诡摘要");
});

test("role archive upsert and foreshadow CRUD", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fixtureWorldId();
  const roleSlotId = await queryFixtureRoleId();

  const archiveRes = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/bible/role-archives/${roleSlotId}`,
    headers: { "x-user-id": hostUserId },
    payload: {
      externalGoal: "洗清嫌疑",
      secret: "当晚不在场",
      arc: { start: "平静", conflict: "被怀疑", turn: "反转", end: "真相" }
    }
  });
  assert.equal(archiveRes.statusCode, 200);
  assert.equal(archiveRes.json().archive.externalGoal, "洗清嫌疑");

  const createBeat = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/bible/foreshadow-beats`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "怀表", plantSummary: "提及旧怀表", payoffSummary: "不在场证明" }
  });
  assert.equal(createBeat.statusCode, 201);
  const beatId = createBeat.json().beat.id;

  const listBeats = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/bible/foreshadow-beats`,
    headers: { "x-user-id": hostUserId }
  });
  assert.ok(listBeats.json().beats.some((b) => b.id === beatId));

  const delBeat = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/bible/foreshadow-beats/${beatId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(delBeat.statusCode, 200);
  assert.equal(delBeat.json().ok, true);
});

test("timeline events and truth claim patch delete", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fixtureWorldId();

  const createEvent = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/bible/timeline-events`,
    headers: { "x-user-id": hostUserId },
    payload: { timeLabel: "22:00", eventSummary: "停电", sequence: 1 }
  });
  assert.equal(createEvent.statusCode, 201);
  const eventId = createEvent.json().event.id;

  const createClaim = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/truth-claims`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "测试断言", claim: "内容" }
  });
  assert.equal(createClaim.statusCode, 201);
  const claimId = createClaim.json().claim.id;

  const patchClaim = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/truth-claims/${claimId}`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "更新断言" }
  });
  assert.equal(patchClaim.statusCode, 200);
  assert.equal(patchClaim.json().claim.title, "更新断言");

  const delClaim = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/truth-claims/${claimId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(delClaim.statusCode, 200);
  assert.equal(delClaim.json().ok, true);

  const delEvent = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/bible/timeline-events/${eventId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(delEvent.statusCode, 200);
  assert.equal(delEvent.json().ok, true);
});

test("role relationship can be created and deleted only inside its world", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fixtureWorldId();
  const fromRoleId = randomUUID();
  const toRoleId = randomUUID();
  const otherWorldId = randomUUID();

  await query(
    `INSERT INTO worlds (id, owner_user_id, name, summary, status)
     VALUES ($1, $2, $3, '', 'testing')`,
    [otherWorldId, hostUserId, `关系隔离测试-${otherWorldId.slice(0, 6)}`]
  );
  await query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [otherWorldId, hostUserId]
  );
  await query(
    `INSERT INTO role_slots (id, world_id, name, sequence)
     VALUES ($1, $3, $4, 901), ($2, $3, $5, 902)`,
    [fromRoleId, toRoleId, worldId, `关系测试甲-${fromRoleId.slice(0, 6)}`, `关系测试乙-${toRoleId.slice(0, 6)}`]
  );
  context.after(async () => {
    await query(`DELETE FROM role_slots WHERE id = ANY($1::uuid[])`, [[fromRoleId, toRoleId]]);
    await query(`DELETE FROM worlds WHERE id = $1`, [otherWorldId]);
  });

  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/role-relationships`,
    headers: { "x-user-id": hostUserId },
    payload: { fromRoleSlotId: fromRoleId, toRoleSlotId: toRoleId, label: "互相怀疑", strength: -4 }
  });
  assert.equal(created.statusCode, 201, created.body);
  const relationshipId = created.json().relationship.id;

  const wrongWorld = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${otherWorldId}/role-relationships/${relationshipId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(wrongWorld.statusCode, 404, wrongWorld.body);
  const stillExists = await query(`SELECT 1 FROM world_role_relationships WHERE id = $1`, [relationshipId]);
  assert.equal(stillExists.rowCount, 1);

  const deleted = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/role-relationships/${relationshipId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.equal(deleted.json().ok, true);

  const deletedAgain = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/role-relationships/${relationshipId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(deletedAgain.statusCode, 404, deletedAgain.body);
});

test("missing role archive returns 404 not 500", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fixtureWorldId();
  const roleSlotId = await queryFixtureRoleId();

  await query(`DELETE FROM world_role_archives WHERE world_id = $1 AND role_slot_id = $2`, [worldId, roleSlotId]);

  const res = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/bible/role-archives/${roleSlotId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().code, "NOT_FOUND");
});

test("role archive rejects role slot from another world", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fixtureWorldId();
  const foreignWorldId = randomUUID();
  const foreignRoleId = randomUUID();

  await query(
    `INSERT INTO worlds (id, owner_user_id, name, summary, status) VALUES ($1,$2,'Foreign Bible','', 'testing')`,
    [foreignWorldId, FIXTURE.hostUserId]
  );
  await query(`INSERT INTO role_slots (id, world_id, name, sequence) VALUES ($1,$2,'外人',$3)`, [
    foreignRoleId,
    foreignWorldId,
    1
  ]);
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [foreignWorldId]);
  });

  const res = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/bible/role-archives/${foreignRoleId}`,
    headers: { "x-user-id": hostUserId },
    payload: { secret: "不应写入" }
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, "ROLE_SLOT_WORLD_MISMATCH");
});

test("partial PATCH preserves untouched bible fields", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fixtureWorldId();
  const roleSlotId = await queryFixtureRoleId();
  const chapterRow = await query(`SELECT id FROM chapters WHERE world_id = $1 ORDER BY sequence LIMIT 1`, [worldId]);
  const chapterId = chapterRow.rows[0].id;
  const sceneRow = await query(
    `INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text)
     VALUES ($1, $2, 'Patch clear scene', '', '') RETURNING id`,
    [worldId, chapterId]
  );
  const sceneId = sceneRow.rows[0].id;
  context.after(async () => {
    await query(`DELETE FROM scenes WHERE id = $1`, [sceneId]);
  });

  const seedCore = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/bible/core-trick`,
    headers: { "x-user-id": hostUserId },
    payload: { summary: "完整摘要", method: "原始手法", motive: "原始动机", victim: "受害者A" }
  });
  assert.equal(seedCore.statusCode, 200);

  const patchCore = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/bible/core-trick`,
    headers: { "x-user-id": hostUserId },
    payload: { method: "更新手法" }
  });
  assert.equal(patchCore.statusCode, 200);
  assert.equal(patchCore.json().coreTrick.method, "更新手法");
  assert.equal(patchCore.json().coreTrick.summary, "完整摘要");
  assert.equal(patchCore.json().coreTrick.motive, "原始动机");
  assert.equal(patchCore.json().coreTrick.victim, "受害者A");

  const seedArchive = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/bible/role-archives/${roleSlotId}`,
    headers: { "x-user-id": hostUserId },
    payload: { externalGoal: "初始目标", secret: "初始秘密", voiceHints: "冷静" }
  });
  assert.equal(seedArchive.statusCode, 200);

  const patchArchive = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/bible/role-archives/${roleSlotId}`,
    headers: { "x-user-id": hostUserId },
    payload: { secret: "更新秘密" }
  });
  assert.equal(patchArchive.statusCode, 200);
  assert.equal(patchArchive.json().archive.secret, "更新秘密");
  assert.equal(patchArchive.json().archive.externalGoal, "初始目标");
  assert.equal(patchArchive.json().archive.voiceHints, "冷静");

  const createBeat = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/bible/foreshadow-beats`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "怀表", plantSummary: "提及旧怀表", payoffSummary: "不在场证明", sequence: 2, plantChapterId: chapterId }
  });
  assert.equal(createBeat.statusCode, 201);
  const beatId = createBeat.json().beat.id;
  assert.equal(createBeat.json().beat.plantChapterId, chapterId);

  const patchBeat = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/bible/foreshadow-beats/${beatId}`,
    headers: { "x-user-id": hostUserId },
    payload: { payoffSummary: "更新回收" }
  });
  assert.equal(patchBeat.statusCode, 200);
  assert.equal(patchBeat.json().beat.payoffSummary, "更新回收");
  assert.equal(patchBeat.json().beat.plantSummary, "提及旧怀表");
  assert.equal(patchBeat.json().beat.sequence, 2);
  assert.equal(patchBeat.json().beat.plantChapterId, chapterId);

  const clearBeatRef = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/bible/foreshadow-beats/${beatId}`,
    headers: { "x-user-id": hostUserId },
    payload: { plantChapterId: null }
  });
  assert.equal(clearBeatRef.statusCode, 200);
  assert.equal(clearBeatRef.json().beat.plantChapterId, null);
  assert.equal(clearBeatRef.json().beat.payoffSummary, "更新回收");

  const createEvent = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/bible/timeline-events`,
    headers: { "x-user-id": hostUserId },
    payload: { timeLabel: "22:00", eventSummary: "停电", alibiNotes: "全员在厅", sequence: 3, chapterId, sceneId }
  });
  assert.equal(createEvent.statusCode, 201);
  const eventId = createEvent.json().event.id;
  assert.equal(createEvent.json().event.chapterId, chapterId);
  assert.equal(createEvent.json().event.sceneId, sceneId);

  const patchEvent = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/bible/timeline-events/${eventId}`,
    headers: { "x-user-id": hostUserId },
    payload: { eventSummary: "恢复供电" }
  });
  assert.equal(patchEvent.statusCode, 200);
  assert.equal(patchEvent.json().event.eventSummary, "恢复供电");
  assert.equal(patchEvent.json().event.timeLabel, "22:00");
  assert.equal(patchEvent.json().event.alibiNotes, "全员在厅");
  assert.equal(patchEvent.json().event.sequence, 3);
  assert.equal(patchEvent.json().event.chapterId, chapterId);
  assert.equal(patchEvent.json().event.sceneId, sceneId);

  const clearEventRefs = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}/bible/timeline-events/${eventId}`,
    headers: { "x-user-id": hostUserId },
    payload: { chapterId: null, sceneId: null }
  });
  assert.equal(clearEventRefs.statusCode, 200);
  assert.equal(clearEventRefs.json().event.chapterId, null);
  assert.equal(clearEventRefs.json().event.sceneId, null);
  assert.equal(clearEventRefs.json().event.eventSummary, "恢复供电");
});

test("foreshadow beat rejects foreign chapter reference", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fixtureWorldId();
  const foreignWorldId = randomUUID();

  await query(
    `INSERT INTO worlds (id, owner_user_id, name, summary, status) VALUES ($1,$2,'Foreign Chapter','', 'testing')`,
    [foreignWorldId, FIXTURE.hostUserId]
  );
  await query(`INSERT INTO chapters (world_id, title, sequence) VALUES ($1,'外章',1)`, [foreignWorldId]);
  const chapterRow = await query(`SELECT id FROM chapters WHERE world_id = $1 LIMIT 1`, [foreignWorldId]);
  const chapterId = chapterRow.rows[0].id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [foreignWorldId]);
  });

  const res = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/bible/foreshadow-beats`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "跨世界伏笔", plantChapterId: chapterId }
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().code, "CHAPTER_NOT_FOUND");
});
