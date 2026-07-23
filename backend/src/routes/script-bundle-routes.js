import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { requireVerifiedEmail } from "../email-verification-policy.js";
import { requireWorldRole } from "./route-guards.js";
import { analyzeScriptBundle, cleanupPreparedScriptBundle, createWorldFromScriptBundle, importScriptBundleToWorldWithClient, prepareScriptBundleImport } from "../script-bundle-import.js";
import { runRevisionMutation } from "../world-revision.js";
import { scriptBundleAnalyzeSchema, scriptBundleImportSchema, scriptBundleNewWorldSchema, worldIdParams } from "./schemas.js";
import { SCRIPT_BUNDLE_JSON_BODY_LIMIT_BYTES } from "../script-bundle-limits.js";
import { runScriptBundleProcessing } from "../script-bundle-processing-guard.js";

export async function registerScriptBundleRoutes(app) {
  app.post("/api/worlds/:worldId/script-bundle/analyze", {
    schema: scriptBundleAnalyzeSchema,
    bodyLimit: SCRIPT_BUNDLE_JSON_BODY_LIMIT_BYTES
  }, async (request, reply) => {
    const actorId = requireActor(request);
    await requireWorldRole(actorId, request.params.worldId);
    try {
      return await runScriptBundleProcessing(() => analyzeScriptBundle(request.body ?? {}));
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });

  app.post("/api/worlds/:worldId/script-bundle/import", {
    schema: scriptBundleImportSchema,
    bodyLimit: SCRIPT_BUNDLE_JSON_BODY_LIMIT_BYTES
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    try {
      return await runScriptBundleProcessing(async () => {
        const body = request.body ?? {};
        const preparedImport = await prepareScriptBundleImport(worldId, actorId, body, body);
        try {
          const response = await runRevisionMutation(
            request,
            reply,
            worldId,
            async (client) => {
              return importScriptBundleToWorldWithClient(client, worldId, actorId, body, body, preparedImport);
            },
            {
              sendErr,
              statusCode: 201,
              onRollback: () => cleanupPreparedScriptBundle(preparedImport)
            }
          );
          await cleanupPreparedScriptBundle(preparedImport, { unusedOnly: true });
          return response;
        } catch (error) {
          await cleanupPreparedScriptBundle(preparedImport);
          throw error;
        }
      });
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });

  app.post("/api/script-bundle/preview-new-world", {
    schema: scriptBundleNewWorldSchema,
    bodyLimit: SCRIPT_BUNDLE_JSON_BODY_LIMIT_BYTES
  }, async (request, reply) => {
    requireActor(request);
    try {
      const analysis = await runScriptBundleProcessing(() => analyzeScriptBundle(request.body ?? {}));
      return { mode: "new_world", ...analysis };
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });

  app.post("/api/worlds/from-script-bundle", {
    schema: scriptBundleNewWorldSchema,
    bodyLimit: SCRIPT_BUNDLE_JSON_BODY_LIMIT_BYTES
  }, async (request, reply) => {
    const actorId = requireActor(request);
    await requireVerifiedEmail(actorId);
    try {
      const result = await runScriptBundleProcessing(() => (
        createWorldFromScriptBundle(actorId, request.body ?? {}, request.body ?? {})
      ));
      return reply.code(201).send(result);
    } catch (error) {
      return sendErr(reply, error.code ?? "BAD_REQUEST", error.message);
    }
  });
}
