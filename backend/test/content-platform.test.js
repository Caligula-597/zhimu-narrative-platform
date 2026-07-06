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

test("host vote create, player ballot, host publish", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/votes`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "测试指认", prompt: "请选择", voteType: "accusation" }
  });
  assert.equal(created.statusCode, 201);
  const voteId = created.json().vote.id;

  const hostList = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/host/votes`,
    headers: { "x-user-id": hostUserId }
  });
  assert.ok(hostList.json().votes.some((v) => v.id === voteId));

  const options = await query(`SELECT id FROM room_vote_options WHERE vote_id = $1 ORDER BY sequence LIMIT 1`, [voteId]);
  assert.ok(options.rowCount);

  const ballot = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/votes/${voteId}/ballots`,
    headers: { "x-user-id": playerUserId },
    payload: { optionId: options.rows[0].id }
  });
  assert.equal(ballot.statusCode, 200);

  const close = await app.inject({
    method: "PATCH",
    url: `/api/rooms/${fixtureRoomId}/host/votes/${voteId}`,
    headers: { "x-user-id": hostUserId },
    payload: { status: "published" }
  });
  assert.equal(close.statusCode, 200);

  context.after(async () => {
    await query(`DELETE FROM room_vote_ballots WHERE vote_id = $1`, [voteId]);
    await query(`DELETE FROM room_vote_options WHERE vote_id = $1`, [voteId]);
    await query(`DELETE FROM room_votes WHERE id = $1`, [voteId]);
  });
});

test("private action submit and host review", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const submit = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/private-actions`,
    headers: { "x-user-id": playerUserId },
    payload: { actionType: "ask_host", title: "能否搜查书房", body: "我有正当理由" }
  });
  assert.equal(submit.statusCode, 201);
  const actionId = submit.json().action.id;

  const hostList = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/host/private-actions`,
    headers: { "x-user-id": hostUserId }
  });
  assert.ok(hostList.json().actions.some((row) => row.id === actionId));

  const review = await app.inject({
    method: "PATCH",
    url: `/api/rooms/${fixtureRoomId}/host/private-actions/${actionId}`,
    headers: { "x-user-id": hostUserId },
    payload: { status: "accepted", hostResponse: "可以，但需消耗一轮" }
  });
  assert.equal(review.statusCode, 200);
  assert.equal(review.json().action.status, "accepted");

  context.after(async () => {
    await query(`DELETE FROM room_private_actions WHERE id = $1`, [actionId]);
  });
});

test("world segment create and list", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fixtureWorldId();
  const key = `test-seg-${Date.now()}`;

  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/segments`,
    headers: { "x-user-id": hostUserId },
    payload: { segmentKey: key, title: "测试段落", sequence: 99, story: { playerTasks: ["调查"] } }
  });
  assert.equal(created.statusCode, 201);
  const segmentId = created.json().segment.id;

  const list = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/segments`,
    headers: { "x-user-id": hostUserId }
  });
  assert.ok(list.json().segments.some((s) => s.id === segmentId));

  context.after(async () => {
    await query(`DELETE FROM world_segments WHERE id = $1`, [segmentId]);
  });
});

test("room run report for host", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/run-report`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.json().reading));
  assert.ok(Array.isArray(res.json().clues));
});

test("quality report list and create", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await fixtureWorldId();

  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/quality-reports`,
    headers: { "x-user-id": hostUserId },
    payload: { source: "manual", report: { note: "test" }, issueCount: 1, score: 88 }
  });
  assert.equal(created.statusCode, 201);
  const reportId = created.json().report.id;

  const list = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/quality-reports`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().reports.some((r) => r.id === reportId));

  context.after(async () => {
    await query(`DELETE FROM world_quality_reports WHERE id = $1`, [reportId]);
  });
});
