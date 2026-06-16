import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";
import {
  getOfficialExampleWorldId,
  loadOfficialExampleSnapshot,
  OFFICIAL_EXAMPLE_EXPERIENCE_STEPS
} from "../src/official-example.js";

function withOfficialExampleWorldId(worldId) {
  const previous = process.env.OFFICIAL_EXAMPLE_WORLD_ID;
  if (worldId) process.env.OFFICIAL_EXAMPLE_WORLD_ID = worldId;
  else delete process.env.OFFICIAL_EXAMPLE_WORLD_ID;
  return () => {
    if (previous === undefined) delete process.env.OFFICIAL_EXAMPLE_WORLD_ID;
    else process.env.OFFICIAL_EXAMPLE_WORLD_ID = previous;
  };
}

async function createPublicExampleWorld(suffix) {
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status, catalog_public, catalog_review_status)
     VALUES ($1, $2, 'official example fixture', 'testing', true, 'approved')
     RETURNING id, name`,
    [hostUserId, `官方示例 ${suffix}`]
  );
  await query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [
    world.rows[0].id,
    hostUserId
  ]);
  await query(`INSERT INTO role_slots (world_id, name, sequence) VALUES ($1, '体验角色', 1)`, [
    world.rows[0].id
  ]);
  return world.rows[0];
}

test("loadOfficialExampleSnapshot when env unset", async () => {
  const restore = withOfficialExampleWorldId("");
  try {
    assert.equal(getOfficialExampleWorldId(), "");
    const snapshot = await loadOfficialExampleSnapshot();
    assert.equal(snapshot.configured, false);
    assert.equal(snapshot.available, false);
    assert.equal(snapshot.experienceSteps.length, OFFICIAL_EXAMPLE_EXPERIENCE_STEPS.length);
  } finally {
    restore();
  }
});

test("GET /api/platform/official-example describes configured public world", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10_000)}`;
  const example = await createPublicExampleWorld(suffix);
  const restore = withOfficialExampleWorldId(example.id);
  context.after(async () => {
    restore();
    await query(`DELETE FROM role_slots WHERE world_id = $1`, [example.id]);
    await query(`DELETE FROM world_members WHERE world_id = $1`, [example.id]);
    await query(`DELETE FROM worlds WHERE id = $1`, [example.id]);
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/platform/official-example" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.configured, true);
  assert.equal(body.available, true);
  assert.equal(body.worldId, example.id);
  assert.equal(body.name, example.name);
  assert.equal(body.roleCount, 1);
  assert.equal(body.joinApiPath, "/api/platform/official-example/join");
  assert.ok(body.experienceSteps.length >= 5);
});

test("POST /api/platform/official-example/join creates personal runtime room", async (context) => {
  const suffix = `join-${Date.now()}`;
  const example = await createPublicExampleWorld(suffix);
  const restore = withOfficialExampleWorldId(example.id);
  context.after(async () => {
    restore();
    await query(`DELETE FROM voice_rooms WHERE room_id IN (SELECT id FROM rooms WHERE world_id = $1)`, [example.id]);
    await query(`DELETE FROM room_members WHERE room_id IN (SELECT id FROM rooms WHERE world_id = $1)`, [example.id]);
    await query(`DELETE FROM rooms WHERE world_id = $1`, [example.id]);
    await query(`DELETE FROM world_members WHERE world_id = $1 AND user_id = $2`, [example.id, playerUserId]);
    await query(`DELETE FROM role_slots WHERE world_id = $1`, [example.id]);
    await query(`DELETE FROM world_members WHERE world_id = $1 AND user_id = $2`, [example.id, hostUserId]);
    await query(`DELETE FROM worlds WHERE id = $1`, [example.id]);
  });

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const join = await app.inject({
    method: "POST",
    url: "/api/platform/official-example/join",
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(join.statusCode, 201, join.body);
  const payload = join.json();
  assert.equal(payload.worldId, example.id);
  assert.equal(payload.worldName, example.name);
  assert.equal(payload.membershipRole, "host");
  assert.ok(payload.room?.invite_code);

  const again = await app.inject({
    method: "POST",
    url: "/api/platform/official-example/join",
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(again.statusCode, 201);
  assert.equal(again.json().room.id, payload.room.id, "should reuse personal room");
});

test("POST /api/platform/official-example/join without env returns unavailable", async (context) => {
  const restore = withOfficialExampleWorldId("");
  context.after(restore);
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/platform/official-example/join",
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(response.statusCode, 503);
  assert.match(response.json().error, /未配置官方示例/);
});
