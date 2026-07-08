import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

async function fixtureWorldId() {
  const { rows } = await query(`SELECT world_id FROM rooms WHERE id = $1`, [fixtureRoomId]);
  return rows[0].world_id;
}

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
  assert.equal(delBeat.statusCode, 204);
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
  assert.equal(delClaim.statusCode, 204);

  const delEvent = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/bible/timeline-events/${eventId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(delEvent.statusCode, 204);
});
