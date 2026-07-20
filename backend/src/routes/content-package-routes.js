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
    return {
      format: PACKAGE_FORMAT,
      version: PACKAGE_VERSION,
      exportedAt: new Date().toISOString(),
      data: await buildWorldArchiveSnapshot(worldId)
    };
  });

  app.post("/api/worlds/:worldId/content-package/preview", { schema: { params: worldIdParams, ...contentPackageEnvelopeSchema } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    try {
      validateEnvelope(request.body);
      const payload = normalizeContentPackagePayload(request.body);
      const targetSnapshot = await buildWorldSnapshot(worldId);
      return buildImportPreview(payload, { targetSnapshot, mode: "append" });
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });

  app.post("/api/content-package/preview-new-world", { schema: contentPackageEnvelopeSchema }, async (request, reply) => {
    requireActor(request);
    try {
      validateEnvelope(request.body);
      const payload = normalizeContentPackagePayload(request.body);
      return buildImportPreview(payload, { mode: "new_world" });
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });

  app.post("/api/worlds/:worldId/content-package/import", { schema: { params: worldIdParams, ...contentPackageEnvelopeSchema } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    try {
      validateEnvelope(request.body);
      const payload = normalizeContentPackagePayload(request.body);
      return runRevisionMutation(request, reply, worldId, async (client) => {
        const result = await importContentPackageData(client, worldId, payload);
        return { ok: true, mode: "append", ...result };
      }, { sendErr, statusCode: 201 });
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });

  app.post("/api/worlds/from-content-package", { schema: createWorldFromPackageSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    await requireVerifiedEmail(actorId);
    try {
      validateEnvelope(request.body);
      const payload = normalizeContentPackagePayload(request.body?.data ?? request.body);
      const result = await createWorldFromContentPackage(actorId, {
        name: request.body?.name,
        summary: request.body?.summary,
        data: payload
      });
      return reply.code(201).send({ ok: true, mode: "new_world", ...result });
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });
}
