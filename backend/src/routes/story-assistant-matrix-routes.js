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
import { findWorldForMember } from "../repositories/world-repository.js";
import { applyCreatorContextToPipelineInput } from "../pipeline-creator-context.js";
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
  const world = await findWorldForMember(worldId, actorId);
  return handler(applyCreatorContextToPipelineInput(request.body ?? {}, world?.settings));
}

export function registerStoryAssistantMatrixRoutes(app, { preHandler }) {
  // Every AI route is protected by the application-level network limiter in
  // onRequest and the actor limiter in preHandler. The route-local preHandler
  // adds LLM authorization and quota checks.
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/truth",
    { schema: deepseekPipelineMatrixTruthSchema, preHandler },
    // codeql-reviewed[js/missing-rate-limiting]: global network and actor limiters run before this handler.
    (request) => authorizeAndRun(request, createPipelineTruthBible)
  );
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/characters",
    { schema: deepseekPipelineMatrixCharactersSchema, preHandler },
    // codeql-reviewed[js/missing-rate-limiting]: global network and actor limiters run before this handler.
    (request) => authorizeAndRun(request, createPipelineCharacterArchives)
  );
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/info-matrix",
    { schema: deepseekPipelineMatrixInfoSchema, preHandler },
    // codeql-reviewed[js/missing-rate-limiting]: global network and actor limiters run before this handler.
    (request) => authorizeAndRun(request, createPipelineInfoMatrix)
  );
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/host-runbook",
    { schema: deepseekPipelineMatrixHostSchema, preHandler },
    // codeql-reviewed[js/missing-rate-limiting]: global network and actor limiters run before this handler.
    (request) => authorizeAndRun(
      request,
      (body) => body.allActs ? createPipelineHostRunbooksAll(body) : createPipelineHostRunbook(body)
    )
  );
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/player-script",
    { schema: deepseekPipelineMatrixPlayerScriptSchema, preHandler },
    // codeql-reviewed[js/missing-rate-limiting]: global network and actor limiters run before this handler.
    (request) => authorizeAndRun(request, createPipelineMatrixPlayerScript)
  );
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/evaluate",
    { schema: deepseekPipelineMatrixEvaluateSchema, preHandler },
    // codeql-reviewed[js/missing-rate-limiting]: global network and actor limiters run before this handler.
    (request) => authorizeAndRun(request, createPipelineMatrixEvaluation)
  );
  app.post(
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/sync-preview",
    { schema: deepseekPipelineMatrixSyncPreviewSchema, preHandler },
    // codeql-reviewed[js/missing-rate-limiting]: global network and actor limiters run before this handler.
    (request) => authorizeAndRun(request, buildPipelineImportPackage)
  );
}
