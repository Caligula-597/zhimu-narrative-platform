import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { createLlmContextPreHandler } from "./llm-route-hook.js";
import {
  fetchUserLlmPreferences,
  isPlatformLlmUserAccessEnabled,
  resolveLlmRuntime
} from "../user-llm.js";
import {
  AI_PLAYTEST_PROMPT_VERSION,
  runMultiAgentPlaytest
} from "../ai-playtest-simulator.js";
import { createWorldQualityReport } from "../content-platform-insight-service.js";
import { buildWorldArchiveSnapshot } from "../world-snapshot-service.js";
import { deepseekConfig } from "../deepseek-config.js";
import { runRevisionMutation } from "../world-revision.js";
import { importStoryAssistantDrafts } from "../story-manuscript-service.js";
import {
  classifyStoryDraft,
  storyDraftEdges,
  storyDraftSuggestions
} from "./world-story-service.js";
import {
  aiPlaytestRunSchema,
  storyAssistantAnalyzeSchema,
  storyAssistantImportSchema
} from "./schemas.js";
import { registerWorldEngineRoutes } from "./world-engine-routes.js";

const llmPreHandler = createLlmContextPreHandler(sendErr);

export async function registerStoryAssistantRoutes(app) {
  app.post("/api/worlds/:worldId/story-assistant/analyze", { schema: storyAssistantAnalyzeSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const text = String(request.body?.text ?? "").trim();
    if (!text) return sendErr(reply, "STORY_TEXT_REQUIRED");
    const nodes = classifyStoryDraft(text);
    return { nodes, edges: storyDraftEdges(nodes), suggestions: storyDraftSuggestions(nodes) };
  });

  app.get("/api/worlds/:worldId/story-assistant/deepseek/status", { preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const runtime = await resolveLlmRuntime(actorId);
    const prefs = await fetchUserLlmPreferences(actorId);
    return {
      configured: Boolean(runtime.configured && runtime.apiKey),
      source: runtime.source,
      model: runtime.model,
      connectionName: runtime.connectionName || null,
      routingMode: prefs.routingMode,
      platformAvailable: deepseekConfig().configured && isPlatformLlmUserAccessEnabled()
    };
  });

  app.post(
    "/api/worlds/:worldId/story-assistant/ai-playtest/run",
    { schema: aiPlaytestRunSchema, preHandler: llmPreHandler },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldRole(actorId, worldId);
      const snapshot = await buildWorldArchiveSnapshot(worldId);
      const playtest = await runMultiAgentPlaytest(snapshot, request.body ?? {}, {
        requestId: request.id
      });
      return createWorldQualityReport({
        request,
        reply,
        actorId,
        worldId,
        body: {
          source: "playtest",
          promptVersion: AI_PLAYTEST_PROMPT_VERSION,
          report: playtest,
          issueCount: playtest.issues.length,
          score: playtest.score
        }
      });
    }
  );

  app.post("/api/worlds/:worldId/story-assistant/import", { schema: storyAssistantImportSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const text = String(request.body?.text ?? "").trim();
    if (!text) return sendErr(reply, "STORY_TEXT_REQUIRED");
    const drafts = classifyStoryDraft(text);
    if (!drafts.length) return sendErr(reply, "STORY_BLOCKS_EMPTY");
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => importStoryAssistantDrafts(client, worldId, drafts),
      { sendErr, statusCode: 201 }
    );
  });

  await registerWorldEngineRoutes(app);
}
