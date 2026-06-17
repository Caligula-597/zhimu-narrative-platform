import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, fixtureRoomId, fixtureWorldId } from "./helpers/fixture-ids.js";

async function insertAsset(worldId, { kind, filename, visibility = "author" }) {
  const result = await query(
    `INSERT INTO asset_files
      (owner_user_id, world_id, asset_kind, visibility, object_key, original_filename, content_type, byte_size, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'image/png', 1024, 'active')
     RETURNING id, original_filename, asset_kind`,
    [hostUserId, worldId, kind, visibility, `test/${randomUUID()}`, filename]
  );
  return result.rows[0];
}

test("GET assets without query returns array for backward compatibility", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const worldId = fixtureWorldId;
  const response = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/assets`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.json()));
});

test("GET assets supports kind and filename search with envelope", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const worldId = fixtureWorldId;
  const suffix = `${Date.now()}`;
  const image = await insertAsset(worldId, { kind: "image", filename: `线索图-${suffix}.png` });
  const audio = await insertAsset(worldId, { kind: "audio", filename: `旁白-${suffix}.mp3` });
  context.after(async () => {
    await query(`DELETE FROM asset_files WHERE id = ANY($1::uuid[])`, [[image.id, audio.id]]);
  });

  const byKind = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/assets?kind=audio&q=${encodeURIComponent(suffix)}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(byKind.statusCode, 200);
  const body = byKind.json();
  assert.ok(Array.isArray(body.assets));
  assert.equal(body.total, 1);
  assert.equal(body.assets[0].id, audio.id);

  const invalidKind = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/assets?kind=unknown`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(invalidKind.statusCode, 400);
  assert.equal(invalidKind.json().code, "ASSET_KIND_INVALID");
});
