import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, fixtureWorldId } from "./helpers/fixture-ids.js";
import { worldCoverApiPath } from "../src/world-cover.js";

test("public room listing includes worldCoverUrl when image asset exists", async () => {
  const app = await createApp();
  const asset = await query(
    `INSERT INTO asset_files
       (owner_user_id, world_id, asset_kind, visibility, object_key, original_filename, content_type, byte_size, status)
     VALUES ($1, $2, 'image', 'author', $3, 'cover.png', 'image/png', 1024, 'active')
     RETURNING id`,
    [hostUserId, fixtureWorldId, `test/cover-${Date.now()}.png`]
  );
  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status, public_listing)
     VALUES ($1, $2, $3, $4, 'testing', true)
     RETURNING id`,
    [fixtureWorldId, hostUserId, `封面测试-${Date.now()}`, `COV-${Date.now().toString(36).toUpperCase()}`]
  );
  const roomId = room.rows[0].id;
  try {
    const response = await app.inject({ method: "GET", url: "/api/platform/public-rooms?limit=48" });
    assert.equal(response.statusCode, 200);
    const listed = response.json().items.find((item) => item.roomId === roomId);
    assert.ok(listed);
    assert.equal(listed.worldCoverUrl, worldCoverApiPath(fixtureWorldId));
  } finally {
    await query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
    await query(`DELETE FROM asset_files WHERE id = $1`, [asset.rows[0].id]);
  }
});

test("GET world cover returns 404 for non-public world", async () => {
  const app = await createApp();
  const privateWorld = await query(
    `INSERT INTO worlds (owner_user_id, name, status, catalog_public)
     VALUES ($1, $2, 'draft', false)
     RETURNING id`,
    [hostUserId, `私有封面-${Date.now()}`]
  );
  const worldId = privateWorld.rows[0].id;
  try {
    const response = await app.inject({
      method: "GET",
      url: `/api/platform/worlds/${worldId}/cover`
    });
    assert.equal(response.statusCode, 404);
  } finally {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  }
});
