import { query, transaction } from "../db.js";
import { randomUUID } from "node:crypto";
import { validateUpload } from "../asset-policy.js";
import { getObjectStorage } from "../storage/index.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { requireAssetRead, storageUsage } from "./world-helpers.js";

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

  app.get("/api/worlds/:worldId/assets", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(
      `SELECT id, asset_kind, original_filename, content_type, byte_size, visibility, status, created_at
       FROM asset_files
       WHERE world_id = $1 AND status = 'active'
       ORDER BY created_at DESC`,
      [worldId]
    );
    return result.rows;
  });

  app.post("/api/assets/upload-url", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roomId = null, filename, contentType, byteSize, visibility = "author", roleSlotId = null } = request.body ?? {};
    if (!worldId || !filename || !contentType || !byteSize) {
      return reply.code(400).send({ error: "worldId, filename, contentType and byteSize are required" });
    }
    await requireWorldRole(actorId, worldId);
    const policy = validateUpload({ contentType, byteSize });
    const usage = await storageUsage(actorId);
    if (Number(byteSize) > Number(usage.max_single_file_bytes)) {
      return reply.code(413).send({ error: "File exceeds account single-file limit" });
    }
    if (Number(usage.used_bytes) + Number(byteSize) > Number(usage.max_bytes)) {
      return reply.code(413).send({ error: "Storage quota exceeded" });
    }
    if (!["author", "host", "role", "public"].includes(visibility)) {
      return reply.code(400).send({ error: "Unsupported visibility" });
    }
    if (visibility === "role" && !roleSlotId) {
      return reply.code(400).send({ error: "roleSlotId is required for role visibility" });
    }
    if (roomId) {
      const room = await query(`SELECT 1 FROM rooms WHERE id = $1 AND world_id = $2`, [roomId, worldId]);
      if (!room.rowCount) return reply.code(400).send({ error: "roomId does not belong to worldId" });
    }
    if (roleSlotId) {
      const role = await query(`SELECT 1 FROM role_slots WHERE id = $1 AND world_id = $2`, [roleSlotId, worldId]);
      if (!role.rowCount) return reply.code(400).send({ error: "roleSlotId does not belong to worldId" });
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

  app.post("/api/assets/:assetId/confirm", async (request) => {
    const actorId = requireActor(request);
    const { assetId } = request.params;
    const session = await query(
      `SELECT us.*, a.object_key FROM upload_sessions us
       JOIN asset_files a ON a.id = us.asset_file_id
       WHERE us.asset_file_id = $1 AND us.owner_user_id = $2 AND us.status = 'created' AND us.expires_at > now()`,
      [assetId, actorId]
    );
    if (!session.rowCount) throw Object.assign(new Error("Active upload session not found"), { statusCode: 404 });
    const stat = await getObjectStorage().statObject({ key: session.rows[0].object_key });
    if (stat.byteSize !== Number(session.rows[0].expected_byte_size)) {
      throw Object.assign(new Error("Uploaded file size does not match upload request"), { statusCode: 409 });
    }
    if (stat.contentType !== session.rows[0].expected_content_type) {
      throw Object.assign(new Error("Uploaded content type does not match upload request"), { statusCode: 409 });
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

  app.delete("/api/assets/:assetId", async (request) => {
    const actorId = requireActor(request);
    const asset = await query(`SELECT id FROM asset_files WHERE id = $1 AND owner_user_id = $2 AND status <> 'deleted'`, [request.params.assetId, actorId]);
    if (!asset.rowCount) throw Object.assign(new Error("Asset not found"), { statusCode: 404 });
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
}
