import { randomUUID } from "node:crypto";
import { validateFilename, validateUpload } from "./asset-policy.js";
import { getObjectStorage } from "./storage/index.js";
import { scanUploadedObject } from "./upload-scan.js";
import { throwErr } from "./api-errors.js";
import { resolveSignedDownloadTtlSeconds } from "./asset-lifetime-policy.js";
import {
  assertAssetUploadQuota,
  createStorageQuotaReservation,
  lockAssetQuotaAdmission
} from "./quota-guards.js";

const ASSET_VISIBILITIES = new Set(["author", "host", "role", "public"]);

export function validateBufferedWorldAssetInput({
  filename,
  buffer,
  contentType,
  visibility = "role",
  assetKind = null
}) {
  if (!buffer?.length) throwErr("UPLOAD_FIELDS_REQUIRED");
  const safeFilename = validateFilename(filename);
  const policy = validateUpload({ contentType, byteSize: buffer.length });
  if (!ASSET_VISIBILITIES.has(visibility)) throwErr("ASSET_VISIBILITY_INVALID");
  if (assetKind && assetKind !== policy.kind) throwErr("UPLOAD_TYPE_MISMATCH");
  return {
    filename: safeFilename,
    byteSize: buffer.length,
    assetKind: policy.kind
  };
}

export async function cleanupStoredObjects(objectKeys = []) {
  if (!objectKeys.length) return;
  const storage = getObjectStorage();
  await Promise.allSettled([...new Set(objectKeys)].map((key) => storage.deleteObject({ key })));
}

export async function prepareWorldAssetUpload({
  actorId,
  worldId,
  roleSlotId = null,
  roomId = null,
  filename,
  buffer,
  contentType,
  visibility = "role",
  assetKind = "image",
  quotaReservation = null
}) {
  const admitted = validateBufferedWorldAssetInput({
    filename,
    buffer,
    contentType,
    visibility,
    assetKind
  });
  const reservation = quotaReservation ?? await createStorageQuotaReservation(actorId);
  const releaseReservation = reservation.reserve(admitted.byteSize);
  const objectKey = `users/${actorId}/worlds/${worldId}/assets/${randomUUID()}`;
  const storage = getObjectStorage();
  try {
    await storage.putObject({ key: objectKey, body: buffer, contentType });
    const stat = await storage.statObject({ key: objectKey });
    if (Number(stat.byteSize) !== admitted.byteSize) throwErr("UPLOAD_SIZE_MISMATCH");
    if (stat.contentType !== contentType) throwErr("UPLOAD_TYPE_MISMATCH");
    await scanUploadedObject({
      key: objectKey,
      contentType: stat.contentType,
      byteSize: stat.byteSize,
      filename: admitted.filename
    });
    return {
      actorId,
      worldId,
      roleSlotId,
      roomId,
      filename: admitted.filename,
      contentType: stat.contentType,
      visibility,
      assetKind: admitted.assetKind,
      objectKey,
      byteSize: stat.byteSize
    };
  } catch (error) {
    releaseReservation();
    await storage.deleteObject({ key: objectKey }).catch(() => {});
    throw error;
  }
}

export async function registerPreparedWorldAsset(client, prepared) {
  await lockAssetQuotaAdmission(client, prepared.actorId);
  await assertAssetUploadQuota(prepared.actorId, prepared.byteSize, { client });
  const file = await client.query(
    `INSERT INTO asset_files
      (owner_user_id, world_id, room_id, asset_kind, visibility, role_slot_id, object_key, original_filename, content_type, byte_size, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
     RETURNING id, object_key, original_filename`,
    [
      prepared.actorId,
      prepared.worldId,
      prepared.roomId,
      prepared.assetKind,
      prepared.visibility,
      prepared.roleSlotId,
      prepared.objectKey,
      prepared.filename,
      prepared.contentType,
      prepared.byteSize
    ]
  );
  const assetId = file.rows[0].id;
  await client.query(
    `INSERT INTO asset_versions (asset_file_id, version_number, object_key, byte_size)
     VALUES ($1, 1, $2, $3)`,
    [assetId, prepared.objectKey, prepared.byteSize]
  );
  return { assetId, byteSize: prepared.byteSize, objectKey: prepared.objectKey };
}

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
  const prepared = await prepareWorldAssetUpload({
    actorId,
    worldId,
    roleSlotId,
    roomId,
    filename,
    buffer,
    contentType,
    visibility,
    assetKind
  });
  try {
    return await registerPreparedWorldAsset(client, prepared);
  } catch (error) {
    await cleanupStoredObjects([prepared.objectKey]);
    throw error;
  }
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
  const ttl = resolveSignedDownloadTtlSeconds(options.expiresIn);
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
