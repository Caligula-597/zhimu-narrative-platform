import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { requireVerifiedEmail } from "../email-verification-policy.js";
import { requireWorldRole } from "./route-guards.js";
import { buildWorldArchiveSnapshot, buildWorldSnapshot } from "./world-helpers.js";
import { runRevisionMutation } from "../world-revision.js";
import {
  worldIdParams,
  contentPackageEnvelopeSchema,
  createWorldFromPackageSchema
} from "./schemas.js";
import {
  PACKAGE_FORMAT,
  PACKAGE_VERSION,
  normalizeContentPackagePayload,
  validateEnvelope,
  buildImportPreview,
  exportSummaryForWorld,
  importContentPackageData,
  createWorldFromContentPackage
} from "./content-package-helpers.js";
import { CONTENT_PACKAGE_JSON_BODY_LIMIT_BYTES } from "../content-package-limits.js";
import { runContentPackageProcessing } from "../content-package-processing-guard.js";

export async function registerContentPackageRoutes(app) {
  app.get("/api/worlds/:worldId/content-package/summary", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return exportSummaryForWorld(worldId);
  });

  app.get("/api/worlds/:worldId/content-package", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const exportedAt = new Date().toISOString();
    const snapshot = await buildWorldArchiveSnapshot(worldId);
    return {
      format: PACKAGE_FORMAT,
      version: PACKAGE_VERSION,
      exportedAt,
      data: {
        ...snapshot,
        meta: {
          ...(snapshot.meta && typeof snapshot.meta === "object" ? snapshot.meta : {}),
          sourceWorldId: worldId,
          exportedAt,
          importKey: `content-package:${worldId}:${exportedAt}`
        }
      }
    };
  });

  app.post("/api/worlds/:worldId/content-package/preview", {
    schema: { params: worldIdParams, ...contentPackageEnvelopeSchema },
    bodyLimit: CONTENT_PACKAGE_JSON_BODY_LIMIT_BYTES
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    try {
      return await runContentPackageProcessing(async () => {
        validateEnvelope(request.body);
        const payload = normalizeContentPackagePayload(request.body);
        const targetSnapshot = await buildWorldSnapshot(worldId);
        return buildImportPreview(payload, { targetSnapshot, mode: "append" });
      });
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });

  app.post("/api/content-package/preview-new-world", {
    schema: contentPackageEnvelopeSchema,
    bodyLimit: CONTENT_PACKAGE_JSON_BODY_LIMIT_BYTES
  }, async (request, reply) => {
    requireActor(request);
    try {
      return await runContentPackageProcessing(() => {
        validateEnvelope(request.body);
        const payload = normalizeContentPackagePayload(request.body);
        return buildImportPreview(payload, { mode: "new_world" });
      });
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });

  app.post("/api/worlds/:worldId/content-package/import", {
    schema: { params: worldIdParams, ...contentPackageEnvelopeSchema },
    bodyLimit: CONTENT_PACKAGE_JSON_BODY_LIMIT_BYTES
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    try {
      return await runContentPackageProcessing(async () => {
        validateEnvelope(request.body);
        const payload = normalizeContentPackagePayload(request.body);
        return runRevisionMutation(request, reply, worldId, async (client) => {
          const result = await importContentPackageData(client, worldId, payload);
          return { ok: true, mode: "append", ...result };
        }, { sendErr, statusCode: 201 });
      });
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });

  app.post("/api/worlds/from-content-package", {
    schema: createWorldFromPackageSchema,
    bodyLimit: CONTENT_PACKAGE_JSON_BODY_LIMIT_BYTES
  }, async (request, reply) => {
    const actorId = requireActor(request);
    await requireVerifiedEmail(actorId);
    try {
      const result = await runContentPackageProcessing(async () => {
        validateEnvelope(request.body);
        const payload = normalizeContentPackagePayload(request.body?.data ?? request.body);
        return createWorldFromContentPackage(actorId, {
          name: request.body?.name,
          summary: request.body?.summary,
          requestId: request.body?.requestId,
          data: payload
        });
      });
      return reply.code(201).send({ ok: true, mode: "new_world", ...result });
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });
}
