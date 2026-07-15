import { sendErr, throwErr } from "../api-errors.js";
import { ASSET_KINDS, ASSET_VISIBILITIES, buildAssetListQuery, parseAssetListQuery } from "../asset-list-helpers.js";
import { inspectAndScanAssetUpload, prepareAssetUpload } from "../asset-service.js";
import { assertCapability } from "../capabilities.js";
import { buildUsagePayload } from "../plans.js";
import {
  confirmUploadedAsset,
  countAssets,
  findOwnedActiveAsset,
  findRestorableAsset,
  listAssets,
  markAssetDeleted,
  restoreDeletedAsset
} from "../repositories/asset-repository.js";
import { requireActor } from "../request-actor.js";
import { getObjectStorage } from "../storage/index.js";
import { runRevisionMutation } from "../world-revision.js";
import { assetUploadUrlSchema, confirmAssetSchema, deleteAssetSchema, restoreAssetSchema, worldIdParams } from "./schemas.js";
import { requireWorldRole, requireWorldReader } from "./route-guards.js";
import { requireAssetRead, storageUsage } from "./world-helpers.js";

export async function registerAssetRoutes(app) {
  app.get("/api/storage/usage", async (request) => {
    const actorId = requireActor(request);
    const usage = await storageUsage(actorId);
    return buildUsagePayload(
      {
        planCode: usage.plan_code,
        max_bytes: usage.max_bytes,
        max_worlds: usage.max_worlds,
        max_single_file_bytes: usage.max_single_file_bytes
      },
      { usedBytes: Number(usage.used_bytes), usedWorlds: Number(usage.used_worlds) }
    );
  });

  app.get("/api/worlds/:worldId/assets", { schema: { params: worldIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    const filters = parseAssetListQuery(request.query);
    if (filters.kind && !ASSET_KINDS.includes(filters.kind)) return sendErr(reply, "ASSET_KIND_INVALID");
    if (filters.visibility && !ASSET_VISIBILITIES.includes(filters.visibility)) {
      return sendErr(reply, "ASSET_VISIBILITY_INVALID");
    }

    const { listSql, countSql, params, countParams } = buildAssetListQuery(worldId, filters, { actorId });
    const assets = await listAssets(listSql, params);
    if (!filters.envelope) return assets;
    return {
      assets,
      total: await countAssets(countSql, countParams),
      limit: filters.limit,
      offset: filters.offset
    };
  });

  app.post("/api/assets/upload-url", { schema: assetUploadUrlSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    await assertCapability(actorId, "asset.upload");
    const input = request.body ?? {};
    if (!input.worldId || !input.filename || !input.contentType || !input.byteSize) {
      return sendErr(reply, "UPLOAD_FIELDS_REQUIRED");
    }
    await requireWorldRole(actorId, input.worldId);
    const payload = await prepareAssetUpload(actorId, input);
    return reply.code(201).send(payload);
  });

  app.post("/api/assets/:assetId/confirm", { schema: confirmAssetSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { assetId } = request.params;
    const { session, stat } = await inspectAndScanAssetUpload(actorId, assetId);
    return runRevisionMutation(
      request,
      reply,
      session.world_id,
      (client) => confirmUploadedAsset(client, {
        assetId,
        uploadSessionId: session.id,
        objectKey: session.object_key,
        byteSize: stat.byteSize
      }),
      { sendErr }
    );
  });

  app.get("/api/assets/:assetId/download-url", async (request) => {
    const actorId = requireActor(request);
    const asset = await requireAssetRead(actorId, request.params.assetId);
    const ttl = Number(process.env.SIGNED_DOWNLOAD_TTL_SECONDS ?? 300);
    const downloadUrl = await getObjectStorage().createDownloadUrl({ key: asset.object_key, expiresIn: ttl });
    return { downloadUrl, expiresIn: ttl };
  });

  app.delete("/api/assets/:assetId", { schema: deleteAssetSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { assetId } = request.params;
    const asset = await findOwnedActiveAsset(assetId, actorId);
    if (!asset) throwErr("ASSET_NOT_FOUND");
    const recycleDays = Number(process.env.RECYCLE_BIN_DAYS ?? 14);
    return runRevisionMutation(
      request,
      reply,
      asset.world_id,
      (client) => markAssetDeleted(client, { assetId, actorId, recycleDays }),
      { sendErr }
    );
  });

  app.post("/api/assets/:assetId/restore", { schema: restoreAssetSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { assetId } = request.params;
    const asset = await findRestorableAsset(assetId, actorId);
    if (!asset) return sendErr(reply, "ASSET_NOT_IN_RECYCLE");
    return runRevisionMutation(
      request,
      reply,
      asset.world_id,
      (client) => restoreDeletedAsset(client, assetId),
      { sendErr }
    );
  });
}
