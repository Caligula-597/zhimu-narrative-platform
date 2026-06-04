import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, fogRoomId } from "./helpers/fixture-ids.js";

async function fogWorldId() {
  const result = await query(`SELECT world_id FROM rooms WHERE id = $1`, [fogRoomId]);
  return result.rows[0].world_id;
}

async function insertActiveAsset(worldId) {
  const id = randomUUID();
  const result = await query(
    `INSERT INTO asset_files
      (owner_user_id, world_id, asset_kind, visibility, object_key, original_filename, content_type, byte_size, status)
     VALUES ($1, $2, 'image', 'author', $3, $4, 'image/png', 1024, 'active')
     RETURNING id`,
    [hostUserId, worldId, `test/${id}`, `recycle-${id.slice(0, 8)}.png`]
  );
  return result.rows[0].id;
}

test("GET assets recycled=1 lists deleted assets with purge_after", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const worldId = await fogWorldId();
  const assetId = await insertActiveAsset(worldId);
  context.after(async () => {
    await query(`DELETE FROM deleted_assets WHERE asset_file_id = $1`, [assetId]);
    await query(`DELETE FROM asset_files WHERE id = $1`, [assetId]);
  });

  const del = await app.inject({
    method: "DELETE",
    url: `/api/assets/${assetId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(del.statusCode, 200);

  const list = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/assets?recycled=1`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(list.statusCode, 200);
  const body = list.json();
  assert.ok(Array.isArray(body.assets));
  assert.ok(body.assets.some((row) => row.id === assetId));
  assert.ok(body.assets.find((row) => row.id === assetId).purge_after);
});

test("POST assets restore moves file back to active list", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const worldId = await fogWorldId();
  const assetId = await insertActiveAsset(worldId);
  context.after(async () => {
    await query(`DELETE FROM deleted_assets WHERE asset_file_id = $1`, [assetId]);
    await query(`DELETE FROM asset_files WHERE id = $1`, [assetId]);
  });

  await app.inject({
    method: "DELETE",
    url: `/api/assets/${assetId}`,
    headers: { "x-user-id": hostUserId }
  });

  const restore = await app.inject({
    method: "POST",
    url: `/api/assets/${assetId}/restore`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(restore.statusCode, 200);
  assert.equal(restore.json().ok, true);

  const active = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/assets`,
    headers: { "x-user-id": hostUserId }
  });
  assert.ok(active.json().some((row) => row.id === assetId));

  const recycled = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/assets?recycled=1`,
    headers: { "x-user-id": hostUserId }
  });
  assert.ok(!recycled.json().assets.some((row) => row.id === assetId));
});

test("POST assets restore rejects non-deleted asset", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const worldId = await fogWorldId();
  const assetId = await insertActiveAsset(worldId);
  context.after(async () => {
    await query(`DELETE FROM asset_files WHERE id = $1`, [assetId]);
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/assets/${assetId}/restore`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "ASSET_NOT_IN_RECYCLE");
});
