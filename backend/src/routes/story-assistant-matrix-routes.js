import { requireActor } from "../request-actor.js";
import {
  buildPipelineImportPackage,
  createPipelineCharacterArchives,
  createPipelineHostRunbook,
  createPipelineHostRunbooksAll,
  createPipelineInfoMatrix,
  createPipelineMatrixEvaluation,
  createPipelineMatrixPlayerScript,
  createPipelineTruthBible
} from "../pipeline-matrix-deepseek.js";
import { requireWorldRole } from "./route-guards.js";
import {
  deepseekPipelineMatrixCharactersSchema,
  deepseekPipelineMatrixEvaluateSchema,
  deepseekPipelineMatrixHostSchema,
  deepseekPipelineMatrixInfoSchema,
  deepseekPipelineMatrixPlayerScriptSchema,
  deepseekPipelineMatrixSyncPreviewSchema,
  deepseekPipelineMatrixTruthSchema
} from "./schemas.js";

async function authorizeAndRun(request, handler) {
  const actorId = requireActor(request);
  const { worldId } = request.params;
  await requireWorldRole(actorId, worldId);
  return handler(request.body ?? {});
}

export function registerStoryAssistantMatrixRoutes(app, { preHandler }) {
  // Every AI route is protected by the application-level network limiter in
  // onRequest and the actor limiter in preHandler. The route-local preHandler
  // adds LLM authorization and quota checks.
  // lgtm[js/missing-rate-limiting]
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/truth",
    { schema: deepseekPipelineMatrixTruthSchema, preHandler },
    (request) => authorizeAndRun(request, createPipelineTruthBible)
  );
  // lgtm[js/missing-rate-limiting]
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/characters",
    { schema: deepseekPipelineMatrixCharactersSchema, preHandler },
    (request) => authorizeAndRun(request, createPipelineCharacterArchives)
  );
  // lgtm[js/missing-rate-limiting]
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/info-matrix",
    { schema: deepseekPipelineMatrixInfoSchema, preHandler },
    (request) => authorizeAndRun(request, createPipelineInfoMatrix)
  );
  // lgtm[js/missing-rate-limiting]
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/host-runbook",
    { schema: deepseekPipelineMatrixHostSchema, preHandler },
    (request) => authorizeAndRun(
      request,
      (body) => body.allActs ? createPipelineHostRunbooksAll(body) : createPipelineHostRunbook(body)
    )
  );
  // lgtm[js/missing-rate-limiting]
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/player-script",
    { schema: deepseekPipelineMatrixPlayerScriptSchema, preHandler },
    (request) => authorizeAndRun(request, createPipelineMatrixPlayerScript)
  );
  // lgtm[js/missing-rate-limiting]
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/evaluate",
    { schema: deepseekPipelineMatrixEvaluateSchema, preHandler },
    (request) => authorizeAndRun(request, createPipelineMatrixEvaluation)
  );
  // lgtm[js/missing-rate-limiting]
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/sync-preview",
    { schema: deepseekPipelineMatrixSyncPreviewSchema, preHandler },
    (request) => authorizeAndRun(request, buildPipelineImportPackage)
  );
}
