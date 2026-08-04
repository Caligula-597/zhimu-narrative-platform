import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, fixtureWorldId } from "./helpers/fixture-ids.js";

async function createFixtureRelease() {
  const result = await query(
    `INSERT INTO world_releases (
       world_id, release_number, label, source_content_revision,
       snapshot_schema_version, narrative_profile, readiness, content_summary,
       snapshot, content_sha256, snapshot_bytes, created_by_user_id
     )
     SELECT world.id,
            COALESCE(MAX(release.release_number), 0) + 1,
            'Public room listing fixture',
            world.content_revision,
            1,
            '{}'::jsonb,
            '{}'::jsonb,
            '{}'::jsonb,
            '{}'::jsonb,
            repeat('0', 64),
            2,
            $2
     FROM worlds world
     LEFT JOIN world_releases release ON release.world_id = world.id
     WHERE world.id = $1
     GROUP BY world.id, world.content_revision
     RETURNING id`,
    [fixtureWorldId, hostUserId]
  );
  return result.rows[0].id;
}

test("GET /api/platform/public-rooms lists only release-backed public rooms", async (context) => {
  const app = await createApp();
  context.after(() => app.close());
  const releaseId = await createFixtureRelease();
  const room = await query(
    `INSERT INTO rooms (
       world_id, host_user_id, name, invite_code, status, public_listing, release_id
     )
     VALUES ($1, $2, $3, $4, 'testing', true, $5)
     RETURNING id, invite_code`,
    [
      fixtureWorldId,
      hostUserId,
      `公开大厅测试-${Date.now()}`,
      `LOBBY-${Date.now().toString(36).toUpperCase()}`,
      releaseId
    ]
  );
  const roomId = room.rows[0].id;
  try {
    const response = await app.inject({ method: "GET", url: "/api/platform/public-rooms?limit=48" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body.items));
    assert.ok(body.items.some((item) => item.roomId === roomId));
    const listed = body.items.find((item) => item.roomId === roomId);
    assert.equal(listed.inviteCode, room.rows[0].invite_code);
    assert.ok(listed.roleCount >= 1);
    assert.ok("worldCoverUrl" in listed);
  } finally {
    await query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
    await query(`DELETE FROM world_releases WHERE id = $1`, [releaseId]);
  }
});

test("PATCH room listing rejects live draft and toggles a release-backed room", async (context) => {
  const app = await createApp({ allowDemoUserHeader: true });
  context.after(() => app.close());
  const releaseId = await createFixtureRelease();
  const created = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status, public_listing)
     VALUES ($1, $2, $3, $4, 'testing', false)
     RETURNING id`,
    [fixtureWorldId, hostUserId, `切换公开-${Date.now()}`, `PRIV-${Date.now().toString(36).toUpperCase()}`]
  );
  const roomId = created.rows[0].id;
  try {
    const rejected = await app.inject({
      method: "PATCH",
      url: `/api/worlds/${fixtureWorldId}/rooms/${roomId}/listing`,
      headers: { "x-user-id": hostUserId, "content-type": "application/json" },
      payload: { publicListing: true }
    });
    assert.equal(rejected.statusCode, 409);
    assert.equal(rejected.json().code, "ROOM_PUBLIC_LISTING_REQUIRES_RELEASE");

    await query(`UPDATE rooms SET release_id = $2 WHERE id = $1`, [roomId, releaseId]);
    const on = await app.inject({
      method: "PATCH",
      url: `/api/worlds/${fixtureWorldId}/rooms/${roomId}/listing`,
      headers: { "x-user-id": hostUserId, "content-type": "application/json" },
      payload: { publicListing: true }
    });
    assert.equal(on.statusCode, 200);
    assert.equal(on.json().public_listing, true);

    const listed = await app.inject({ method: "GET", url: "/api/platform/public-rooms?limit=48" });
    assert.ok(listed.json().items.some((item) => item.roomId === roomId));

    const off = await app.inject({
      method: "PATCH",
      url: `/api/worlds/${fixtureWorldId}/rooms/${roomId}/listing`,
      headers: { "x-user-id": hostUserId, "content-type": "application/json" },
      payload: { publicListing: false }
    });
    assert.equal(off.statusCode, 200);
    assert.equal(off.json().public_listing, false);
  } finally {
    await query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
    await query(`DELETE FROM world_releases WHERE id = $1`, [releaseId]);
  }
});
