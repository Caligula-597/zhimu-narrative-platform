import { query, transaction } from "../db.js";
import { sendErr, throwErr } from "../api-errors.js";
import { randomUUID } from "node:crypto";
import { validateUpload, validateFilename } from "../asset-policy.js";
import { ASSET_KINDS, ASSET_VISIBILITIES, buildAssetListQuery, parseAssetListQuery } from "../asset-list-helpers.js";
import { getObjectStorage } from "../storage/index.js";
import { scanUploadedObject } from "../upload-scan.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole, requireWorldReader } from "./route-guards.js";
import { requireAssetRead, storageUsage } from "./world-helpers.js";
import { assetUploadUrlSchema, confirmAssetSchema, deleteAssetSchema, restoreAssetSchema, worldIdParams } from "./schemas.js";

export async function registerAssetRoutes(app) {
  app.get("/api/storage/usage", async (request) => {
    const actorId = requireActor(request);
    const usage = await storageUsage(actorId);
    return {
      maxBytes: Number(usage.max_bytes),
      maxWorlds: Number(usage.max_worlds),
      maxSingleFileBytes: Number(usage.max_single_file_bytes),
      usedBytes: Number(usage.used_bytes),
      remainingBytes: Number(usage.max_bytes) - Number(usage.used_bytes)
    };
  });

  app.get("/api/worlds/:worldId/assets", { schema: { params: worldIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);

    const filters = parseAssetListQuery(request.query);
    if (filters.kind && !ASSET_KINDS.includes(filters.kind)) {
      return sendErr(reply, "ASSET_KIND_INVALID");
    }
    if (filters.visibility && !ASSET_VISIBILITIES.includes(filters.visibility)) {
      return sendErr(reply, "ASSET_VISIBILITY_INVALID");
    }

    const { listSql, countSql, params, countParams } = buildAssetListQuery(worldId, filters, { actorId });
    const result = await query(listSql, params);

    if (!filters.envelope) {
      return result.rows;
    }

    const totalResult = await query(countSql, countParams);
    return {
      assets: result.rows,
      total: totalResult.rows[0].total,
      limit: filters.limit,
      offset: filters.offset
    };
  });

  app.post("/api/assets/upload-url", { schema: assetUploadUrlSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roomId = null, filename, contentType, byteSize, visibility = "author", roleSlotId = null } = request.body ?? {};
    if (!worldId || !filename || !contentType || !byteSize) {
      return sendErr(reply, "UPLOAD_FIELDS_REQUIRED");
    }
    await requireWorldRole(actorId, worldId);
    validateFilename(filename);
    const policy = validateUpload({ contentType, byteSize });
    const usage = await storageUsage(actorId);
    if (Number(byteSize) > Number(usage.max_single_file_bytes)) {
      return sendErr(reply, "FILE_TOO_LARGE");
    }
    if (Number(usage.used_bytes) + Number(byteSize) > Number(usage.max_bytes)) {
      return sendErr(reply, "STORAGE_QUOTA_EXCEEDED");
    }
    if (!["author", "host", "role", "public"].includes(visibility)) {
      return sendErr(reply, "ASSET_VISIBILITY_INVALID");
    }
    if (visibility === "role" && !roleSlotId) {
      return sendErr(reply, "ASSET_ROLE_REQUIRED");
    }
    if (roomId) {
      const room = await query(`SELECT 1 FROM rooms WHERE id = $1 AND world_id = $2`, [roomId, worldId]);
      if (!room.rowCount) return sendErr(reply, "ASSET_ROOM_WORLD_MISMATCH");
    }
    if (roleSlotId) {
      const role = await query(`SELECT 1 FROM role_slots WHERE id = $1 AND world_id = $2`, [roleSlotId, worldId]);
      if (!role.rowCount) return sendErr(reply, "ASSET_ROLE_WORLD_MISMATCH");
    }

    const objectKey = `users/${actorId}/worlds/${worldId}/assets/${randomUUID()}`;
    const ttl = Number(process.env.SIGNED_UPLOAD_TTL_SECONDS ?? 600);
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const asset = await transaction(async (client) => {
      const file = await client.query(
        `INSERT INTO asset_files
          (owner_user_id, world_id, room_id, asset_kind, visibility, role_slot_id, object_key, original_filename, content_type, byte_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [actorId, worldId, roomId, policy.kind, visibility, roleSlotId, objectKey, filename, contentType, byteSize]
      );
      const session = await client.query(
        `INSERT INTO upload_sessions
          (asset_file_id, owner_user_id, object_key, expected_content_type, expected_byte_size, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [file.rows[0].id, actorId, objectKey, contentType, byteSize, expiresAt]
      );
      return { asset: file.rows[0], uploadSessionId: session.rows[0].id };
    });
    const uploadUrl = await getObjectStorage().createUploadUrl({ key: objectKey, contentType, expiresIn: ttl });
    return reply.code(201).send({
      assetId: asset.asset.id,
      uploadSessionId: asset.uploadSessionId,
      uploadUrl,
      expiresAt,
      requiredHeaders: { "Content-Type": contentType }
    });
  });

  app.post("/api/assets/:assetId/confirm", { schema: confirmAssetSchema }, async (request) => {
    const actorId = requireActor(request);
    const { assetId } = request.params;
    const session = await query(
      `SELECT us.*, a.object_key FROM upload_sessions us
       JOIN asset_files a ON a.id = us.asset_file_id
       WHERE us.asset_file_id = $1 AND us.owner_user_id = $2 AND us.status = 'created' AND us.expires_at > now()`,
      [assetId, actorId]
    );
    if (!session.rowCount) throwErr("UPLOAD_SESSION_NOT_FOUND");
    const stat = await getObjectStorage().statObject({ key: session.rows[0].object_key });
    if (stat.byteSize !== Number(session.rows[0].expected_byte_size)) {
      throwErr("UPLOAD_SIZE_MISMATCH");
    }
    if (stat.contentType !== session.rows[0].expected_content_type) {
      throwErr("UPLOAD_TYPE_MISMATCH");
    }
    try {
      await scanUploadedObject({
        key: session.rows[0].object_key,
        contentType: stat.contentType,
        byteSize: stat.byteSize
      });
    } catch (error) {
      if (error.code === "UPLOAD_SCAN_INFECTED" || error.code === "UPLOAD_SCAN_FAILED") {
        await getObjectStorage().deleteObject({ key: session.rows[0].object_key }).catch(() => {});
        await query(
          `UPDATE asset_files SET status = 'quarantined', updated_at = now(), metadata = metadata || $2::jsonb WHERE id = $1`,
          [assetId, JSON.stringify({ scanError: error.code, quarantinedAt: new Date().toISOString() })]
        );
        await query(`UPDATE upload_sessions SET status = 'cancelled' WHERE id = $1`, [session.rows[0].id]);
      }
      throw error;
    }
    await transaction(async (client) => {
      await client.query(`UPDATE asset_files SET status = 'active', updated_at = now() WHERE id = $1`, [assetId]);
      await client.query(`UPDATE upload_sessions SET status = 'confirmed', confirmed_at = now() WHERE id = $1`, [session.rows[0].id]);
      await client.query(
        `INSERT INTO asset_versions (asset_file_id, version_number, object_key, byte_size)
         VALUES ($1, 1, $2, $3)`,
        [assetId, session.rows[0].object_key, stat.byteSize]
      );
    });
    return { ok: true, assetId };
  });

  app.get("/api/assets/:assetId/download-url", async (request) => {
    const actorId = requireActor(request);
    const asset = await requireAssetRead(actorId, request.params.assetId);
    const ttl = Number(process.env.SIGNED_DOWNLOAD_TTL_SECONDS ?? 300);
    const downloadUrl = await getObjectStorage().createDownloadUrl({ key: asset.object_key, expiresIn: ttl });
    return { downloadUrl, expiresIn: ttl };
  });

  app.delete("/api/assets/:assetId", { schema: deleteAssetSchema }, async (request) => {
    const actorId = requireActor(request);
    const asset = await query(`SELECT id FROM asset_files WHERE id = $1 AND owner_user_id = $2 AND status <> 'deleted'`, [request.params.assetId, actorId]);
    if (!asset.rowCount) throwErr("ASSET_NOT_FOUND");
    const recycleDays = Number(process.env.RECYCLE_BIN_DAYS ?? 14);
    await transaction(async (client) => {
      await client.query(`UPDATE asset_files SET status = 'deleted', deleted_at = now(), updated_at = now() WHERE id = $1`, [request.params.assetId]);
      await client.query(
        `INSERT INTO deleted_assets (asset_file_id, deleted_by_user_id, purge_after)
         VALUES ($1, $2, now() + ($3 || ' days')::interval)
         ON CONFLICT (asset_file_id) DO UPDATE SET purge_after = EXCLUDED.purge_after`,
        [request.params.assetId, actorId, recycleDays]
      );
    });
    return { ok: true, purgeAfterDays: recycleDays };
  });

  app.post("/api/assets/:assetId/restore", { schema: restoreAssetSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { assetId } = request.params;
    const row = await query(
      `SELECT af.id FROM asset_files af
       JOIN deleted_assets da ON da.asset_file_id = af.id
       WHERE af.id = $1 AND af.owner_user_id = $2 AND af.status = 'deleted' AND da.purge_after > now()`,
      [assetId, actorId]
    );
    if (!row.rowCount) return sendErr(reply, "ASSET_NOT_IN_RECYCLE");
    await transaction(async (client) => {
      await client.query(
        `UPDATE asset_files SET status = 'active', deleted_at = NULL, updated_at = now() WHERE id = $1`,
        [assetId]
      );
      await client.query(`DELETE FROM deleted_assets WHERE asset_file_id = $1`, [assetId]);
    });
    return { ok: true, assetId };
  });
}
