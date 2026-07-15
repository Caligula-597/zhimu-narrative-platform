import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { getObjectStorage } from "../src/storage/index.js";
import { fixtureWorldId, hostUserId } from "./helpers/fixture-ids.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);
process.env.OBJECT_STORAGE_PROVIDER = "memory";

test("asset upload confirms exactly once and advances world revision", async (context) => {
  if (!process.env.DATABASE_URL) {
    context.skip("DATABASE_URL is required for the integration assertion");
    return;
  }
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  let assetId = "";
  context.after(async () => {
    if (assetId) {
      const object = await query(`SELECT object_key FROM asset_files WHERE id = $1`, [assetId]);
      if (object.rows[0]?.object_key) {
        await getObjectStorage().deleteObject({ key: object.rows[0].object_key }).catch(() => {});
      }
      await query(`DELETE FROM asset_versions WHERE asset_file_id = $1`, [assetId]);
      await query(`DELETE FROM upload_sessions WHERE asset_file_id = $1`, [assetId]);
      await query(`DELETE FROM asset_files WHERE id = $1`, [assetId]);
    }
    await app.close();
  });

  const world = await app.inject({
    method: "GET",
    url: `/api/worlds/${fixtureWorldId}`,
    headers: { "x-user-id": hostUserId }
  });
  const revision = Number(world.json().content_revision);
  const prepared = await app.inject({
    method: "POST",
    url: "/api/assets/upload-url",
    headers: { "x-user-id": hostUserId },
    payload: {
      worldId: fixtureWorldId,
      filename: `asset-flow-${Date.now()}.png`,
      contentType: "image/png",
      byteSize: PNG.length,
      visibility: "author"
    }
  });
  assert.equal(prepared.statusCode, 201, prepared.body);
  assetId = prepared.json().assetId;
  const objectKey = decodeURIComponent(new URL(prepared.json().uploadUrl).hostname);
  await getObjectStorage().putObject({ key: objectKey, body: PNG, contentType: "image/png" });

  const confirmed = await app.inject({
    method: "POST",
    url: `/api/assets/${assetId}/confirm`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision}"` }
  });
  assert.equal(confirmed.statusCode, 200, confirmed.body);
  assert.equal(confirmed.json().content_revision, revision + 1);

  const duplicate = await app.inject({
    method: "POST",
    url: `/api/assets/${assetId}/confirm`,
    headers: { "x-user-id": hostUserId, "if-match": `"${revision + 1}"` }
  });
  assert.equal(duplicate.statusCode, 404, duplicate.body);
  assert.equal(duplicate.json().code, "UPLOAD_SESSION_NOT_FOUND");
});
