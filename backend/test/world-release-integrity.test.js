import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { waitForScheduledEventOutbox } from "../src/event-outbox-dispatcher.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";

async function createReleaseReadyWorld(context) {
  const marker = randomUUID();
  const worldResult = await query(
    `INSERT INTO worlds (owner_user_id, name, settings)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id, content_revision`,
    [hostUserId, `release-${marker}`, JSON.stringify({ worldMode: "scripted" })]
  );
  const world = worldResult.rows[0];
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [world.id]));
  await query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [world.id, hostUserId]
  );
  const chapter = await query(
    `INSERT INTO chapters (world_id, title, summary, sequence, publication_status, metadata)
     VALUES ($1, '第一章', '', 1, 'testing', '{"chapterKey":"ch1"}'::jsonb)
     RETURNING id`,
    [world.id]
  );
  const role = await query(
    `INSERT INTO role_slots (world_id, name, sequence) VALUES ($1, '角色一', 1) RETURNING id`,
    [world.id]
  );
  const script = await query(
    `INSERT INTO character_scripts (role_slot_id, title) VALUES ($1, '角色一剧本') RETURNING id`,
    [role.rows[0].id]
  );
  const section = await query(
    `INSERT INTO script_sections (
       character_script_id, role_slot_id, chapter_id, title, body,
       sequence, metadata, publication_status
     ) VALUES ($1, $2, $3, '第一幕', '冻结前正文', 1, '{"segmentKey":"ch1"}'::jsonb, 'testing')
     RETURNING id`,
    [script.rows[0].id, role.rows[0].id, chapter.rows[0].id]
  );
  await query(
    `INSERT INTO world_segments (world_id, segment_key, title, sequence, operations)
     VALUES ($1, 'ch1', '第一章', 1, $2::jsonb)`,
    [world.id, JSON.stringify({ flow: "依次推进", hostTruth: "主持人真相" })]
  );
  return {
    worldId: world.id,
    revision: Number(world.content_revision),
    sectionId: section.rows[0].id
  };
}

test("world release creation is idempotent, private and update-immutable", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const fixture = await createReleaseReadyWorld(context);
  const headers = {
    "x-user-id": hostUserId,
    "if-match": `"${fixture.revision}"`,
    "idempotency-key": `release-${randomUUID()}`
  };

  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixture.worldId}/releases`,
    headers,
    payload: { label: "内测冻结版" }
  });
  assert.equal(created.statusCode, 201, created.body);
  const release = created.json();
  assert.equal(release.releaseNumber, 1);
  assert.equal(release.sourceRevision, fixture.revision);
  assert.equal(release.snapshot, undefined);
  assert.match(release.contentSha256, /^[0-9a-f]{64}$/);

  await query(
    `UPDATE worlds SET content_revision = content_revision + 1 WHERE id = $1`,
    [fixture.worldId]
  );
  const replay = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixture.worldId}/releases`,
    headers,
    payload: { label: "内测冻结版" }
  });
  assert.equal(replay.statusCode, 201, replay.body);
  assert.equal(replay.json().id, release.id);
  assert.equal(replay.json().replayed, true);
  assert.equal(replay.json().sourceRevision, fixture.revision);
  assert.equal(replay.json().content_revision, fixture.revision + 1);

  const mismatch = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixture.worldId}/releases`,
    headers,
    payload: { label: "另一个版本" }
  });
  assert.equal(mismatch.statusCode, 409, mismatch.body);
  assert.equal(mismatch.json().code, "IDEMPOTENCY_PAYLOAD_MISMATCH");

  const listed = await app.inject({
    method: "GET",
    url: `/api/worlds/${fixture.worldId}/releases`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(listed.statusCode, 200, listed.body);
  assert.equal(listed.json().length, 1);
  assert.equal(listed.json()[0].snapshot, undefined);

  const roomCreated = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixture.worldId}/rooms`,
    headers: { "x-user-id": hostUserId },
    payload: { name: "版本切换验收房", releaseId: null }
  });
  assert.equal(roomCreated.statusCode, 201, roomCreated.body);
  const room = roomCreated.json();
  assert.equal(room.contentBinding.mode, "live_draft");

  const impactResponse = await app.inject({
    method: "GET",
    url: `/api/worlds/${fixture.worldId}/rooms/${room.id}/release-impact?releaseId=${release.id}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(impactResponse.statusCode, 200, impactResponse.body);
  const impact = impactResponse.json();
  assert.equal(impact.allowed, true);
  assert.equal(impact.direction, "bind");

  const applied = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${fixture.worldId}/rooms/${room.id}/content-release`,
    headers: { "x-user-id": hostUserId },
    payload: {
      releaseId: release.id,
      expectedCurrentReleaseId: null,
      targetContentSha256: release.contentSha256,
      impactFingerprint: impact.fingerprint
    }
  });
  assert.equal(applied.statusCode, 200, applied.body);
  assert.equal(applied.json().contentBinding.release.id, release.id);
  assert.equal(applied.json().contentBinding.isFrozen, true);

  const listedRoom = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${fixture.worldId}/rooms/${room.id}/listing`,
    headers: { "x-user-id": hostUserId },
    payload: { publicListing: true }
  });
  assert.equal(listedRoom.statusCode, 200, listedRoom.body);
  assert.equal(listedRoom.json().public_listing, true);

  const denied = await app.inject({
    method: "GET",
    url: `/api/worlds/${fixture.worldId}/releases`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(denied.statusCode, 403, denied.body);

  await query(`UPDATE script_sections SET body = '草稿已修改' WHERE id = $1`, [fixture.sectionId]);
  const currentRevisionResult = await query(
    `SELECT content_revision FROM worlds WHERE id = $1`,
    [fixture.worldId]
  );
  const currentRevision = Number(currentRevisionResult.rows[0].content_revision);
  const upgradedReleaseResponse = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixture.worldId}/releases`,
    headers: {
      "x-user-id": hostUserId,
      "if-match": `"${currentRevision}"`,
      "idempotency-key": `release-upgrade-${randomUUID()}`
    },
    payload: { label: "草稿修改后的第二版" }
  });
  assert.equal(upgradedReleaseResponse.statusCode, 201, upgradedReleaseResponse.body);
  const upgradedRelease = upgradedReleaseResponse.json();
  assert.equal(upgradedRelease.releaseNumber, 2);

  const upgradeImpactResponse = await app.inject({
    method: "GET",
    url: `/api/worlds/${fixture.worldId}/rooms/${room.id}/release-impact?releaseId=${upgradedRelease.id}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(upgradeImpactResponse.statusCode, 200, upgradeImpactResponse.body);
  const upgradeImpact = upgradeImpactResponse.json();
  assert.equal(upgradeImpact.direction, "upgrade");
  assert.equal(upgradeImpact.allowed, true);
  assert.ok(
    Number(upgradeImpact.comparison.summary.changed) > 0,
    "upgrade preview must expose the authored content change"
  );

  const upgradedRoomResponse = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${fixture.worldId}/rooms/${room.id}/content-release`,
    headers: { "x-user-id": hostUserId },
    payload: {
      releaseId: upgradedRelease.id,
      expectedCurrentReleaseId: release.id,
      targetContentSha256: upgradedRelease.contentSha256,
      impactFingerprint: upgradeImpact.fingerprint
    }
  });
  assert.equal(upgradedRoomResponse.statusCode, 200, upgradedRoomResponse.body);
  assert.equal(upgradedRoomResponse.json().contentBinding.release.id, upgradedRelease.id);

  await waitForScheduledEventOutbox();
  const releaseEvent = await query(
    `SELECT payload
     FROM room_event_journal
     WHERE room_id = $1 AND event_type = 'room.content_release_changed'
     ORDER BY id DESC
     LIMIT 1`,
    [room.id]
  );
  assert.equal(releaseEvent.rows[0]?.payload?.releaseId, upgradedRelease.id);
  assert.equal(releaseEvent.rows[0]?.payload?.releaseNumber, 2);
  assert.equal(releaseEvent.rows[0]?.payload?.direction, "upgrade");

  const stored = await query(
    `SELECT snapshot FROM world_releases WHERE id = $1`,
    [release.id]
  );
  assert.equal(stored.rows[0].snapshot.sections[0].body, "冻结前正文");

  await assert.rejects(
    query(`UPDATE world_releases SET label = '禁止覆盖' WHERE id = $1`, [release.id]),
    (error) => error.code === "55000"
  );
});
