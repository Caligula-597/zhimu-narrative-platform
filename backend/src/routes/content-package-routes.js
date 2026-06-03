import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { buildWorldSnapshot } from "./world-helpers.js";
import {
  PACKAGE_FORMAT,
  PACKAGE_VERSION,
  normalizeContentPackagePayload,
  validateEnvelope,
  buildImportPreview,
  exportSummaryForWorld,
  importContentPackage,
  createWorldFromContentPackage
} from "./content-package-helpers.js";

export async function registerContentPackageRoutes(app) {
  app.get("/api/worlds/:worldId/content-package/summary", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return exportSummaryForWorld(worldId);
  });

  app.get("/api/worlds/:worldId/content-package", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return {
      format: PACKAGE_FORMAT,
      version: PACKAGE_VERSION,
      exportedAt: new Date().toISOString(),
      data: await buildWorldSnapshot(worldId)
    };
  });

  app.post("/api/worlds/:worldId/content-package/preview", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    try {
      validateEnvelope(request.body);
      const payload = normalizeContentPackagePayload(request.body);
      const targetSnapshot = await buildWorldSnapshot(worldId);
      return buildImportPreview(payload, { targetSnapshot, mode: "append" });
    } catch (error) {
      return reply.code(error.statusCode ?? 400).send({ error: error.message });
    }
  });

  app.post("/api/content-package/preview-new-world", async (request, reply) => {
    requireActor(request);
    try {
      validateEnvelope(request.body);
      const payload = normalizeContentPackagePayload(request.body);
      return buildImportPreview(payload, { mode: "new_world" });
    } catch (error) {
      return reply.code(error.statusCode ?? 400).send({ error: error.message });
    }
  });

  app.post("/api/worlds/:worldId/content-package/import", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    try {
      validateEnvelope(request.body);
      const payload = normalizeContentPackagePayload(request.body);
      const result = await importContentPackage(worldId, payload);
      return reply.code(201).send({ ok: true, mode: "append", ...result });
    } catch (error) {
      return reply.code(error.statusCode ?? 400).send({ error: error.message });
    }
  });

  app.post("/api/worlds/from-content-package", async (request, reply) => {
    const actorId = requireActor(request);
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
      return reply.code(error.statusCode ?? 400).send({ error: error.message });
    }
  });
}
