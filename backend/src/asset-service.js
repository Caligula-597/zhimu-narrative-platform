import { randomUUID } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { validateFilename, validateUpload } from "./asset-policy.js";
import { assertStorageBytesQuota, assertSingleFileQuota } from "./quota-guards.js";
import {
  cancelPendingAssetUpload,
  createPendingAssetUpload,
  findPendingUploadSession,
  quarantineUpload,
  roleBelongsToWorld,
  roomBelongsToWorld
} from "./repositories/asset-repository.js";
import { getObjectStorage } from "./storage/index.js";
import { scanUploadedObject } from "./upload-scan.js";

const ASSET_VISIBILITIES = new Set(["author", "host", "role", "public"]);

export async function prepareAssetUpload(actorId, input) {
  const {
    worldId,
    roomId = null,
    filename,
    contentType,
    byteSize,
    visibility = "author",
    roleSlotId = null
  } = input;
  if (!worldId || !filename || !contentType || !byteSize) throwErr("UPLOAD_FIELDS_REQUIRED");
  validateFilename(filename);
  const policy = validateUpload({ contentType, byteSize });
  await assertSingleFileQuota(actorId, byteSize);
  await assertStorageBytesQuota(actorId, byteSize);
  if (!ASSET_VISIBILITIES.has(visibility)) throwErr("ASSET_VISIBILITY_INVALID");
  if (visibility === "role" && !roleSlotId) throwErr("ASSET_ROLE_REQUIRED");
  if (roomId && !(await roomBelongsToWorld(roomId, worldId))) throwErr("ASSET_ROOM_WORLD_MISMATCH");
  if (roleSlotId && !(await roleBelongsToWorld(roleSlotId, worldId))) throwErr("ASSET_ROLE_WORLD_MISMATCH");

  const objectKey = `users/${actorId}/worlds/${worldId}/assets/${randomUUID()}`;
  const ttl = Number(process.env.SIGNED_UPLOAD_TTL_SECONDS ?? 600);
  const expiresAt = new Date(Date.now() + ttl * 1000);
  const pending = await createPendingAssetUpload({
    actorId,
    worldId,
    roomId,
    assetKind: policy.kind,
    visibility,
    roleSlotId,
    objectKey,
    filename,
    contentType,
    byteSize,
    expiresAt
  });
  let uploadUrl;
  try {
    uploadUrl = await getObjectStorage().createUploadUrl({ key: objectKey, contentType, expiresIn: ttl });
  } catch (error) {
    await cancelPendingAssetUpload(pending.asset.id, pending.uploadSessionId).catch(() => {});
    throw error;
  }
  return {
    assetId: pending.asset.id,
    uploadSessionId: pending.uploadSessionId,
    uploadUrl,
    expiresAt,
    requiredHeaders: { "Content-Type": contentType }
  };
}

export async function inspectAndScanAssetUpload(actorId, assetId) {
  const session = await findPendingUploadSession(assetId, actorId);
  if (!session) throwErr("UPLOAD_SESSION_NOT_FOUND");
  const stat = await getObjectStorage().statObject({ key: session.object_key });
  if (stat.byteSize !== Number(session.expected_byte_size)) throwErr("UPLOAD_SIZE_MISMATCH");
  if (stat.contentType !== session.expected_content_type) throwErr("UPLOAD_TYPE_MISMATCH");
  try {
    await scanUploadedObject({
      key: session.object_key,
      contentType: stat.contentType,
      byteSize: stat.byteSize,
      filename: session.original_filename
    });
  } catch (error) {
    if (["UPLOAD_SCAN_INFECTED", "UPLOAD_SCAN_FAILED", "UPLOAD_SCAN_SPOOFED"].includes(error.code)) {
      await getObjectStorage().deleteObject({ key: session.object_key }).catch(() => {});
      await quarantineUpload(assetId, session.id, error.code);
    }
    throw error;
  }
  return { session, stat };
}
