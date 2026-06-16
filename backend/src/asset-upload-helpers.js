import { randomUUID } from "node:crypto";
import { getObjectStorage } from "./storage/index.js";
import { scanUploadedObject } from "./upload-scan.js";
import { throwErr } from "./api-errors.js";

/**
 * Server-side upload (import pipeline) — bypasses presigned client PUT.
 */
export async function uploadWorldAssetFromBuffer(
  client,
  {
    actorId,
    worldId,
    roleSlotId = null,
    roomId = null,
    filename,
    buffer,
    contentType,
    visibility = "role",
    assetKind = "image"
  }
) {
  if (!buffer?.length) throwErr("UPLOAD_FIELDS_REQUIRED");
  const objectKey = `users/${actorId}/worlds/${worldId}/assets/${randomUUID()}`;
  const storage = getObjectStorage();
  await storage.putObject({ key: objectKey, body: buffer, contentType });
  const stat = await storage.statObject({ key: objectKey });
  try {
    await scanUploadedObject({
      key: objectKey,
      contentType: stat.contentType,
      byteSize: stat.byteSize,
      filename
    });
  } catch (error) {
    await storage.deleteObject({ key: objectKey }).catch(() => {});
    throw error;
  }

  const file = await client.query(
    `INSERT INTO asset_files
      (owner_user_id, world_id, room_id, asset_kind, visibility, role_slot_id, object_key, original_filename, content_type, byte_size, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
     RETURNING id, object_key, original_filename`,
    [actorId, worldId, roomId, assetKind, visibility, roleSlotId, objectKey, filename, contentType, stat.byteSize]
  );
  const assetId = file.rows[0].id;
  await client.query(
    `INSERT INTO asset_versions (asset_file_id, version_number, object_key, byte_size)
     VALUES ($1, 1, $2, $3)`,
    [assetId, objectKey, stat.byteSize]
  );
  return { assetId, byteSize: stat.byteSize, objectKey };
}

export async function fetchActiveAssetsByIds(client, assetIds) {
  if (!assetIds?.length) return [];
  const result = await client.query(
    `SELECT id, object_key, original_filename, content_type, byte_size, visibility, role_slot_id
     FROM asset_files
     WHERE id = ANY($1::uuid[]) AND status = 'active'
     ORDER BY array_position($1::uuid[], id)`,
    [assetIds]
  );
  return result.rows;
}

export async function signedUrlsForAssetRows(assetRows, options = {}) {
  const ttl = options.expiresIn ?? Number(process.env.SIGNED_DOWNLOAD_TTL_SECONDS ?? 300);
  const storage = getObjectStorage();
  const urls = [];
  for (const row of assetRows) {
    const downloadUrl = await storage.createDownloadUrl({ key: row.object_key, expiresIn: ttl });
    urls.push({
      assetId: row.id,
      url: downloadUrl,
      filename: row.original_filename,
      contentType: row.content_type,
      expiresIn: ttl
    });
  }
  return urls;
}
