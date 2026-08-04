import { randomUUID } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { validateFilename } from "./asset-policy.js";
import { query, transaction } from "./db.js";
import { appPublicOrigin } from "./oauth-providers.js";
import { getObjectStorage } from "./storage/index.js";
import { scanUploadedObject } from "./upload-scan.js";

export const PORTALS = Object.freeze(["creator", "host", "player"]);
export const PORTAL_PROFILE_NAME_MAX_LENGTH = 24;
export const PORTAL_PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const PORTAL_PROFILE_NAME_COOLDOWN_DAYS = 30;

const PORTAL_SET = new Set(PORTALS);
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RESERVED_NAMES = new Set([
  "admin",
  "administrator",
  "system",
  "support",
  "postmaster",
  "官方",
  "管理员",
  "系统",
  "客服",
  "织幕",
  "织幕官方"
]);

export function assertPortal(portal) {
  if (!PORTAL_SET.has(portal)) {
    throwErr("PORTAL_PROFILE_INVALID", "不支持的身份端口");
  }
  return portal;
}

export function normalizePortalDisplayName(value) {
  const displayName = String(value ?? "").trim().replace(/\s+/gu, " ");
  if (
    displayName.length < 2
    || displayName.length > PORTAL_PROFILE_NAME_MAX_LENGTH
    || !/^[\p{L}\p{N} _.\-·]+$/u.test(displayName)
    || RESERVED_NAMES.has(displayName.toLocaleLowerCase("zh-CN"))
  ) {
    throwErr(
      "PORTAL_PROFILE_INVALID",
      "昵称需为 2–24 个字符，只能包含文字、数字、空格、下划线、短横线、圆点或间隔号"
    );
  }
  return displayName;
}

function avatarUrlFor(row) {
  if (row.avatar_object_key) {
    const version = row.avatar_updated_at
      ? new Date(row.avatar_updated_at).getTime()
      : Date.now();
    return `${appPublicOrigin()}/api/account/portal-avatars/${row.user_id}/${row.portal}?v=${version}`;
  }
  return row.base_avatar_url || null;
}

function profilePayload(row) {
  const nextNameChangeAt = row.name_changed_at
    ? new Date(new Date(row.name_changed_at).getTime() + PORTAL_PROFILE_NAME_COOLDOWN_DAYS * 86_400_000)
    : null;
  const now = Date.now();
  return {
    portal: row.portal,
    displayName: row.display_name,
    avatarUrl: avatarUrlFor(row),
    hasCustomAvatar: Boolean(row.avatar_object_key),
    nameChangedAt: row.name_changed_at || null,
    nextNameChangeAt: nextNameChangeAt?.toISOString() || null,
    canChangeName: !nextNameChangeAt || nextNameChangeAt.getTime() <= now,
    avatarUpdatedAt: row.avatar_updated_at || null
  };
}

async function profileRows(userId, portal = null, client = null) {
  const run = client ? client.query.bind(client) : query;
  const result = await run(
    `SELECT profile.*, users.avatar_url AS base_avatar_url
     FROM user_portal_profiles profile
     INNER JOIN users ON users.id = profile.user_id
     WHERE profile.user_id = $1
       AND ($2::text IS NULL OR profile.portal = $2)
     ORDER BY CASE profile.portal
       WHEN 'creator' THEN 1
       WHEN 'host' THEN 2
       ELSE 3
     END`,
    [userId, portal]
  );
  return result.rows;
}

export async function getPortalProfiles(userId) {
  return (await profileRows(userId)).map(profilePayload);
}

export async function getPortalProfile(userId, portal) {
  assertPortal(portal);
  const row = (await profileRows(userId, portal))[0];
  if (!row) throwErr("PORTAL_PROFILE_NOT_FOUND");
  return profilePayload(row);
}

export async function checkPortalNameAvailability(userId, portal, value) {
  assertPortal(portal);
  const displayName = normalizePortalDisplayName(value);
  const result = await query(
    `SELECT user_id
     FROM user_portal_profiles
     WHERE portal = $1 AND lower(display_name) = lower($2)
     LIMIT 1`,
    [portal, displayName]
  );
  const ownerId = result.rows[0]?.user_id;
  return {
    displayName,
    available: !ownerId || ownerId === userId,
    currentUserOwnsName: ownerId === userId
  };
}

export async function updatePortalDisplayName(userId, portal, value) {
  assertPortal(portal);
  const displayName = normalizePortalDisplayName(value);
  try {
    return await transaction(async (client) => {
      const locked = await client.query(
        `SELECT profile.*, users.avatar_url AS base_avatar_url
         FROM user_portal_profiles profile
         INNER JOIN users ON users.id = profile.user_id
         WHERE profile.user_id = $1 AND profile.portal = $2
         FOR UPDATE OF profile`,
        [userId, portal]
      );
      const current = locked.rows[0];
      if (!current) throwErr("PORTAL_PROFILE_NOT_FOUND");
      if (current.display_name.localeCompare(displayName, undefined, { sensitivity: "accent" }) === 0) {
        return profilePayload(current);
      }

      const nextNameChangeAt = current.name_changed_at
        ? new Date(new Date(current.name_changed_at).getTime() + PORTAL_PROFILE_NAME_COOLDOWN_DAYS * 86_400_000)
        : null;
      if (nextNameChangeAt && nextNameChangeAt.getTime() > Date.now()) {
        throwErr(
          "PORTAL_PROFILE_NAME_COOLDOWN",
          "该端昵称每 30 天只能修改一次",
          { nextNameChangeAt: nextNameChangeAt.toISOString() }
        );
      }

      const updated = await client.query(
        `UPDATE user_portal_profiles
         SET display_name = $3, name_changed_at = now(), updated_at = now()
         WHERE user_id = $1 AND portal = $2
         RETURNING *, $4::text AS base_avatar_url`,
        [userId, portal, displayName, current.base_avatar_url]
      );
      return profilePayload(updated.rows[0]);
    });
  } catch (error) {
    if (
      error?.code === "23505"
      && error?.constraint === "user_portal_profiles_portal_display_name_unique"
    ) {
      throwErr("PORTAL_PROFILE_NAME_TAKEN");
    }
    throw error;
  }
}

export async function preparePortalAvatarUpload(userId, portal, input) {
  assertPortal(portal);
  const filename = validateFilename(input.filename);
  const contentType = String(input.contentType || "").toLowerCase();
  const byteSize = Number(input.byteSize);
  if (!AVATAR_TYPES.has(contentType)) {
    throwErr("UNSUPPORTED_MEDIA_TYPE", "头像仅支持 JPEG、PNG 或 WebP");
  }
  if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > PORTAL_PROFILE_AVATAR_MAX_BYTES) {
    throwErr("PAYLOAD_TOO_LARGE", "头像文件不能超过 2 MB");
  }

  const uploadId = randomUUID();
  const objectKey = `users/${userId}/profiles/${portal}/${randomUUID()}`;
  const ttl = Math.min(Math.max(Number(process.env.SIGNED_UPLOAD_TTL_SECONDS ?? 600), 60), 3600);
  const expiresAt = new Date(Date.now() + ttl * 1000);
  await query(
    `INSERT INTO portal_profile_avatar_uploads (
       id, user_id, portal, object_key, expected_content_type,
       expected_byte_size, original_filename, expires_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [uploadId, userId, portal, objectKey, contentType, byteSize, filename, expiresAt]
  );

  let uploadUrl;
  try {
    uploadUrl = await getObjectStorage().createUploadUrl({
      key: objectKey,
      contentType,
      expiresIn: ttl
    });
  } catch (error) {
    await query(
      `UPDATE portal_profile_avatar_uploads SET status = 'cancelled' WHERE id = $1`,
      [uploadId]
    ).catch(() => {});
    throw error;
  }

  return {
    uploadId,
    uploadUrl,
    expiresAt: expiresAt.toISOString(),
    maxByteSize: PORTAL_PROFILE_AVATAR_MAX_BYTES,
    requiredHeaders: { "Content-Type": contentType }
  };
}

export async function confirmPortalAvatarUpload(userId, portal, uploadId) {
  assertPortal(portal);
  const pending = await query(
    `SELECT *
     FROM portal_profile_avatar_uploads
     WHERE id = $1 AND user_id = $2 AND portal = $3
       AND status = 'created' AND expires_at > now()`,
    [uploadId, userId, portal]
  );
  const upload = pending.rows[0];
  if (!upload) throwErr("UPLOAD_SESSION_NOT_FOUND");

  let stat;
  try {
    stat = await getObjectStorage().statObject({ key: upload.object_key });
    if (stat.byteSize !== Number(upload.expected_byte_size)) throwErr("UPLOAD_SIZE_MISMATCH");
    if (String(stat.contentType).toLowerCase() !== upload.expected_content_type) {
      throwErr("UPLOAD_TYPE_MISMATCH");
    }
    await scanUploadedObject({
      key: upload.object_key,
      contentType: stat.contentType,
      byteSize: stat.byteSize,
      filename: upload.original_filename
    });
  } catch (error) {
    if (error.code?.startsWith("UPLOAD_")) {
      await getObjectStorage().deleteObject({ key: upload.object_key }).catch(() => {});
      await query(
        `UPDATE portal_profile_avatar_uploads SET status = 'cancelled'
         WHERE id = $1 AND status = 'created'`,
        [uploadId]
      ).catch(() => {});
    }
    throw error;
  }

  let oldObjectKey = null;
  const profile = await transaction(async (client) => {
    const lockedUpload = await client.query(
      `SELECT *
       FROM portal_profile_avatar_uploads
       WHERE id = $1 AND user_id = $2 AND portal = $3
         AND status = 'created' AND expires_at > now()
       FOR UPDATE`,
      [uploadId, userId, portal]
    );
    if (!lockedUpload.rows[0]) throwErr("UPLOAD_SESSION_NOT_FOUND");
    const lockedProfile = await client.query(
      `SELECT avatar_object_key
       FROM user_portal_profiles
       WHERE user_id = $1 AND portal = $2
       FOR UPDATE`,
      [userId, portal]
    );
    if (!lockedProfile.rows[0]) throwErr("PORTAL_PROFILE_NOT_FOUND");
    oldObjectKey = lockedProfile.rows[0].avatar_object_key;
    await client.query(
      `UPDATE user_portal_profiles
       SET avatar_object_key = $3, avatar_content_type = $4,
           avatar_updated_at = now(), updated_at = now()
       WHERE user_id = $1 AND portal = $2`,
      [userId, portal, upload.object_key, upload.expected_content_type]
    );
    await client.query(
      `UPDATE portal_profile_avatar_uploads
       SET status = 'confirmed', confirmed_at = now()
       WHERE id = $1`,
      [uploadId]
    );
    return getPortalProfileWithClient(client, userId, portal);
  });

  if (oldObjectKey && oldObjectKey !== upload.object_key) {
    await getObjectStorage().deleteObject({ key: oldObjectKey }).catch(() => {});
  }
  return profile;
}

async function getPortalProfileWithClient(client, userId, portal) {
  const row = (await profileRows(userId, portal, client))[0];
  if (!row) throwErr("PORTAL_PROFILE_NOT_FOUND");
  return profilePayload(row);
}

export async function removePortalAvatar(userId, portal) {
  assertPortal(portal);
  let oldObjectKey = null;
  const profile = await transaction(async (client) => {
    const locked = await client.query(
      `SELECT avatar_object_key
       FROM user_portal_profiles
       WHERE user_id = $1 AND portal = $2
       FOR UPDATE`,
      [userId, portal]
    );
    if (!locked.rows[0]) throwErr("PORTAL_PROFILE_NOT_FOUND");
    oldObjectKey = locked.rows[0].avatar_object_key;
    await client.query(
      `UPDATE user_portal_profiles
       SET avatar_object_key = NULL, avatar_content_type = NULL,
           avatar_updated_at = now(), updated_at = now()
       WHERE user_id = $1 AND portal = $2`,
      [userId, portal]
    );
    return getPortalProfileWithClient(client, userId, portal);
  });
  if (oldObjectKey) {
    await getObjectStorage().deleteObject({ key: oldObjectKey }).catch(() => {});
  }
  return profile;
}

export async function findPublicPortalAvatar(userId, portal) {
  assertPortal(portal);
  const result = await query(
    `SELECT avatar_object_key, avatar_content_type
     FROM user_portal_profiles
     WHERE user_id = $1 AND portal = $2`,
    [userId, portal]
  );
  const row = result.rows[0];
  if (!row?.avatar_object_key) throwErr("NOT_FOUND", "头像不存在");
  return {
    objectKey: row.avatar_object_key,
    contentType: row.avatar_content_type
  };
}
