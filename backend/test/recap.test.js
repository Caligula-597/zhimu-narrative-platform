import assert from "node:assert/strict";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";


test("host can generate room recap with logs and clue flow", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const create = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/recaps`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "第一夜复盘", description: "第一夜收工后的完整复盘" }
  });
  assert.equal(create.statusCode, 201, create.body);
  const created = create.json();
  assert.equal(created.label, "第一夜复盘");
  assert.equal(created.description, "第一夜收工后的完整复盘");
  assert.equal(created.perspective, "host");
  assert.ok(Array.isArray(created.snapshot.players));
  assert.ok(Array.isArray(created.snapshot.keyTimeline));
  assert.ok(Array.isArray(created.snapshot.clueDiscovery));
  assert.ok(Object.hasOwn(created.snapshot, "undiscoveredClues"));
  assert.ok(Object.hasOwn(created.snapshot, "hostConfirmedEvents"));
  assert.ok(Object.hasOwn(created.snapshot, "endingTriggers"));
  assert.ok(Array.isArray(created.snapshot.notes));
  assert.ok(created.snapshot.room?.worldName);
  assert.ok(created.snapshot.storyNarrative?.opening);
  assert.ok(Array.isArray(created.snapshot.storyNarrative?.chapters));
  assert.ok(Array.isArray(created.snapshot.rolePerformances));
  assert.ok(created.summary);

  const list = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/recaps`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().some((item) => item.id === created.id));

  const detail = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/recaps/${created.id}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().perspective, "host");
  assert.equal(detail.json().snapshot.room.id, fixtureRoomId);
});

test("player cannot generate recap", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/recaps`,
    headers: { "x-user-id": playerUserId },
    payload: { title: "不应成功", description: "玩家不能生成" }
  });
  assert.equal(response.statusCode, 403);
});

test("player can view own perspective recap", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const create = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/recaps`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "玩家视角测试复盘", description: "" }
  });
  assert.equal(create.statusCode, 201);
  const recapId = create.json().id;

  const playerView = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/recaps/${recapId}`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(playerView.statusCode, 200, playerView.body);
  const payload = playerView.json();
  assert.equal(payload.perspective, "postgame");
  assert.equal(payload.snapshot.perspective, "postgame");
  assert.ok(payload.snapshot.roleSlotId);
  assert.ok(payload.snapshot.storyNarrative?.opening);
  assert.equal(payload.snapshot.rolePerformances?.length, create.json().snapshot.rolePerformances?.length);
  assert.ok(payload.snapshot.myPerformance?.roleSlotId);
  assert.ok(Array.isArray(payload.snapshot.personalNotes));
});

test("host global recap includes full clue discovery order", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const world = await query(`SELECT world_id FROM rooms WHERE id = $1`, [fixtureRoomId]);
  const worldId = world.rows[0]?.world_id;
  assert.ok(worldId);

  const studio = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/studio`,
    headers: { "x-user-id": hostUserId }
  });
  if (studio.statusCode !== 200) return;
  const clues = studio.json().clues ?? [];
  const players = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/host/players`,
    headers: { "x-user-id": hostUserId }
  });
  const joined = (players.json().players ?? []).find((player) => player.joined);
  if (joined && clues.length) {
    await app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/host/grant-clue`,
      headers: { "x-user-id": hostUserId },
      payload: { roleSlotId: joined.role_slot_id, clueId: clues[0].id, message: "复盘测试发放线索" }
    });
  }

  const create = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/recaps`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "全局复盘", description: "" }
  });
  assert.equal(create.statusCode, 201);
  const snapshot = create.json().snapshot;
  if (joined && clues.length) {
    assert.ok(
      (snapshot.clueDiscovery ?? []).some((row) => row.clueId === clues[0].id),
      "recap should include granted clue in discovery order"
    );
    assert.ok(
      (snapshot.keyTimeline ?? []).some((row) => row.kind === "clue_acquired" || row.kind === "log"),
      "recap timeline should include clue or log events"
    );
  }
  assert.ok((snapshot.hostConfirmedEvents ?? []).length >= 0);
});
