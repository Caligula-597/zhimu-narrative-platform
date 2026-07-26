import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";

async function createFixture(context) {
  const marker = randomUUID();
  const worldResult = await query(
    `INSERT INTO worlds (owner_user_id, name, settings)
     VALUES ($1, $2, '{"worldMode":"scripted"}'::jsonb)
     RETURNING id, content_revision`,
    [hostUserId, `runtime-${marker}`]
  );
  const world = worldResult.rows[0];
  context.after(async () => {
    await query(`DELETE FROM rooms WHERE world_id = $1`, [world.id]);
    await query(`DELETE FROM worlds WHERE id = $1`, [world.id]);
  });
  await query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [world.id, hostUserId]
  );
  const chapter = await query(
    `INSERT INTO chapters (world_id, title, sequence, publication_status)
     VALUES ($1, 'Act one', 1, 'testing') RETURNING id`,
    [world.id]
  );
  const role = await query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
     VALUES ($1, 'Frozen detective', 'public', 'private', 1) RETURNING id`,
    [world.id]
  );
  const script = await query(
    `INSERT INTO character_scripts (role_slot_id, title)
     VALUES ($1, 'Detective script') RETURNING id`,
    [role.rows[0].id]
  );
  const section = await query(
    `INSERT INTO script_sections (
       character_script_id, role_slot_id, chapter_id, title, body,
       sequence, publication_status, metadata
     ) VALUES ($1, $2, $3, 'Frozen section', 'Frozen body', 1, 'testing', '{"segmentKey":"ch1"}')
     RETURNING id`,
    [script.rows[0].id, role.rows[0].id, chapter.rows[0].id]
  );
  await query(
    `INSERT INTO world_segments (world_id, segment_key, title, sequence, operations)
     VALUES ($1, 'ch1', 'Act one', 1, $2::jsonb)`,
    [world.id, JSON.stringify({ flow: "Read then investigate", hostTruth: "Host truth" })]
  );
  const rule = await query(
    `INSERT INTO automation_rules (
       world_id, name, mode, enabled, priority, conditions, actions
     ) VALUES (
       $1, 'Frozen manual rule', 'manual', true, 10,
       '{"all":[]}'::jsonb,
       '[{"type":"timeline_log","message":"frozen action"}]'::jsonb
     ) RETURNING id`,
    [world.id]
  );
  const item = await query(
    `INSERT INTO items (world_id, name, public_text, host_text, metadata)
     VALUES ($1, 'Frozen key', 'Frozen item text', 'Host item text', '{}'::jsonb)
     RETURNING id`,
    [world.id]
  );
  const clue = await query(
    `INSERT INTO clues (world_id, name, public_text, host_text, visibility)
     VALUES ($1, 'Frozen clue', 'Frozen clue text', 'Frozen host clue text', 'role')
     RETURNING id`,
    [world.id]
  );
  const task = await query(
    `INSERT INTO player_tasks (
       world_id, role_slot_id, act_key, body, tips, visibility, sequence, source
     ) VALUES ($1, $2, 'ch1', 'Frozen task', 'Frozen tip', 'public', 1, 'manual')
     RETURNING id`,
    [world.id, role.rows[0].id]
  );
  return {
    worldId: world.id,
    revision: Number(world.content_revision),
    roleSlotId: role.rows[0].id,
    sectionId: section.rows[0].id,
    ruleId: rule.rows[0].id,
    itemId: item.rows[0].id,
    clueId: clue.rows[0].id,
    taskId: task.rows[0].id
  };
}

test("release-bound room keeps authored content frozen across Player, Host and Creator", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const fixture = await createFixture(context);
  const releaseResponse = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixture.worldId}/releases`,
    headers: {
      "x-user-id": hostUserId,
      "if-match": `"${fixture.revision}"`,
      "idempotency-key": `runtime-release-${randomUUID()}`
    },
    payload: { label: "Frozen R1" }
  });
  assert.equal(releaseResponse.statusCode, 201, releaseResponse.body);
  const release = releaseResponse.json();
  const roomResponse = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixture.worldId}/rooms`,
    headers: {
      "x-user-id": hostUserId,
      "idempotency-key": `runtime-room-${randomUUID()}`
    },
    payload: { name: "Frozen room", releaseId: release.id }
  });
  assert.equal(roomResponse.statusCode, 201, roomResponse.body);
  const room = roomResponse.json();
  assert.equal(room.contentBinding.isFrozen, true);

  await query(
    `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id)
     VALUES ($1, $2, 'player', $3)`,
    [room.id, playerUserId, fixture.roleSlotId]
  );
  await query(
    `UPDATE role_slots SET name = 'Mutated draft role' WHERE id = $1`,
    [fixture.roleSlotId]
  );
  await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, 'New draft-only role', 2)`,
    [fixture.worldId]
  );
  await query(
    `UPDATE script_sections SET title = 'Mutated draft section', body = 'Mutated body'
     WHERE id = $1`,
    [fixture.sectionId]
  );
  await query(
    `UPDATE automation_rules SET name = 'Mutated draft rule',
       actions = '[{"type":"timeline_log","message":"mutated action"}]'::jsonb
     WHERE id = $1`,
    [fixture.ruleId]
  );
  await query(
    `UPDATE items SET name = 'Mutated draft item', public_text = 'Mutated item text'
     WHERE id = $1`,
    [fixture.itemId]
  );
  await query(
    `UPDATE clues SET name = 'Mutated draft clue', public_text = 'Mutated clue text'
     WHERE id = $1`,
    [fixture.clueId]
  );
  await query(
    `UPDATE player_tasks SET body = 'Mutated draft task', tips = 'Mutated task tip'
     WHERE id = $1`,
    [fixture.taskId]
  );
  await query(
    `INSERT INTO inventory (room_id, role_slot_id, item_id, quantity)
     VALUES ($1, $2, $3, 1)`,
    [room.id, fixture.roleSlotId, fixture.itemId]
  );
  await query(
    `INSERT INTO clue_ownership (room_id, role_slot_id, clue_id)
     VALUES ($1, $2, $3)`,
    [room.id, fixture.roleSlotId, fixture.clueId]
  );
  await query(
    `UPDATE worlds SET content_revision = content_revision + 1 WHERE id = $1`,
    [fixture.worldId]
  );

  const runtime = await app.inject({
    method: "GET",
    url: `/api/rooms/${room.id}/runtime-content`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(runtime.statusCode, 200, runtime.body);
  assert.equal(runtime.json().contentBinding.isFrozen, true);
  assert.equal(runtime.json().content.roles[0].name, "Frozen detective");
  assert.equal(runtime.json().content.rules[0].name, "Frozen manual rule");

  const rulesPreview = await app.inject({
    method: "GET",
    url: `/api/rooms/${room.id}/rules/preview`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(rulesPreview.statusCode, 200, rulesPreview.body);
  assert.equal(rulesPreview.json().rules[0].name, "Frozen manual rule");

  const playerHome = await app.inject({
    method: "GET",
    url: `/api/rooms/${room.id}/player-home/core`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(playerHome.statusCode, 200, playerHome.body);
  assert.equal(playerHome.json().role.name, "Frozen detective");
  assert.equal(playerHome.json().sections[0].title, "Frozen section");
  assert.equal(playerHome.json().sections[0].body, "Frozen body");
  assert.equal(playerHome.json().room.contentBinding.hasNewerDraft, true);

  const playerSocial = await app.inject({
    method: "GET",
    url: `/api/rooms/${room.id}/player-home/social?currentActKey=ch1`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(playerSocial.statusCode, 200, playerSocial.body);
  assert.equal(playerSocial.json().inventory[0].name, "Frozen key");
  assert.equal(playerSocial.json().inventory[0].public_text, "Frozen item text");
  assert.equal(playerSocial.json().clues[0].name, "Frozen clue");
  assert.equal(playerSocial.json().clues[0].public_text, "Frozen clue text");
  assert.equal(playerSocial.json().tasks[0].body, "Frozen task");
  assert.equal(playerSocial.json().tasks[0].tips, "Frozen tip");
  assert.equal(playerSocial.json().knowledge.contentBinding.isFrozen, true);
  assert.equal(playerSocial.json().currentState.syncState.runtimeSource, "release_snapshot");

  const playerKnowledge = await app.inject({
    method: "GET",
    url: `/api/rooms/${room.id}/knowledge`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(playerKnowledge.statusCode, 200, playerKnowledge.body);
  assert.equal(playerKnowledge.json().audience, "player");
  assert.equal(playerKnowledge.json().sections[0].title, "Frozen section");
  assert.equal(playerKnowledge.json().recentLogs, undefined);
  const deniedHostKnowledge = await app.inject({
    method: "GET",
    url: `/api/rooms/${room.id}/host/players/${fixture.roleSlotId}/knowledge`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(deniedHostKnowledge.statusCode, 403, deniedHostKnowledge.body);

  const hostDetail = await app.inject({
    method: "GET",
    url: `/api/rooms/${room.id}/host/players/${fixture.roleSlotId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(hostDetail.statusCode, 200, hostDetail.body);
  assert.equal(hostDetail.json().knowledge.contentBinding.isFrozen, true);
  assert.equal(hostDetail.json().sections[0].title, "Frozen section");
  const hostPlayers = await app.inject({
    method: "GET",
    url: `/api/rooms/${room.id}/host/players`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(hostPlayers.statusCode, 200, hostPlayers.body);
  assert.deepEqual(
    hostPlayers.json().players.map((player) => player.role_name),
    ["Frozen detective"]
  );
  const hostClueMatrix = await app.inject({
    method: "GET",
    url: `/api/rooms/${room.id}/host/clue-matrix`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(hostClueMatrix.statusCode, 200, hostClueMatrix.body);
  assert.equal(hostClueMatrix.json().clues[0].name, "Frozen clue");

  for (const [url, actor] of [
    [`/api/rooms/${room.id}/current-state`, playerUserId],
    [`/api/rooms/${room.id}/host/current-state`, hostUserId],
    [`/api/worlds/${fixture.worldId}/rooms/${room.id}/current-state`, hostUserId]
  ]) {
    const response = await app.inject({
      method: "GET",
      url,
      headers: { "x-user-id": actor }
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().syncState.runtimeSource, "release_snapshot");
    assert.equal(response.json().syncState.isFrozen, true);
    assert.equal(response.json().metrics.totalRoles, 1);
  }

  const revision = Number((await query(
    `SELECT content_revision FROM worlds WHERE id = $1`,
    [fixture.worldId]
  )).rows[0].content_revision);
  const blockedDelete = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${fixture.worldId}/roles/${fixture.roleSlotId}/sections/${fixture.sectionId}`,
    headers: {
      "x-user-id": hostUserId,
      "if-match": `"${revision}"`
    }
  });
  assert.equal(blockedDelete.statusCode, 409, blockedDelete.body);
  assert.equal(blockedDelete.json().code, "RELEASE_BOUND_CONTENT_IN_USE");
});
