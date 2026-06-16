import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { requireVerifiedEmail } from "../email-verification-policy.js";
import { requireWorldRole } from "./route-guards.js";
import {
  analyzeScriptBundle,
  createWorldFromScriptBundle,
  importScriptBundleToWorld
} from "../script-bundle-import.js";
import {
  scriptBundleAnalyzeSchema,
  scriptBundleImportSchema,
  scriptBundleNewWorldSchema,
  worldIdParams
} from "./schemas.js";

export async function registerScriptBundleRoutes(app) {
  app.post("/api/worlds/:worldId/script-bundle/analyze", { schema: scriptBundleAnalyzeSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    await requireWorldRole(actorId, request.params.worldId);
    try {
      return analyzeScriptBundle(request.body ?? {});
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });

  app.post("/api/worlds/:worldId/script-bundle/import", { schema: scriptBundleImportSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    try {
      const result = await importScriptBundleToWorld(worldId, actorId, request.body ?? {}, request.body ?? {});
      return reply.code(201).send(result);
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });

  app.post("/api/script-bundle/preview-new-world", { schema: scriptBundleNewWorldSchema }, async (request, reply) => {
    requireActor(request);
    try {
      const analysis = analyzeScriptBundle(request.body ?? {});
      return { mode: "new_world", ...analysis };
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });

  app.post("/api/worlds/from-script-bundle", { schema: scriptBundleNewWorldSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    await requireVerifiedEmail(actorId);
    try {
      const result = await createWorldFromScriptBundle(actorId, request.body ?? {}, request.body ?? {});
      return reply.code(201).send(result);
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });
}
