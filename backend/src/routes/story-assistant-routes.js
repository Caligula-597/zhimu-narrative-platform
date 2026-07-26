import { sendErr, throwErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole, WORLD_CREATOR_READER_ROLES } from "./route-guards.js";
import { createLlmContextPreHandler } from "./llm-route-hook.js";
import { fetchUserLlmPreferences, resolveLlmRuntime } from "../user-llm.js";
import {
  AI_PLAYTEST_PROMPT_VERSION,
  runMultiAgentPlaytest
} from "../ai-playtest-simulator.js";
import { createWorldQualityReport } from "../content-platform-insight-service.js";
import { buildWorldArchiveSnapshot } from "../world-snapshot-service.js";
import {
  createDeepseekManuscriptSynopsis,
  createDeepseekMysteryPackage,
  createDeepseekRoleMatrix,
  createDeepseekRoleSection,
  createDeepseekStoryEvaluation,
  createDeepseekStoryOutline,
  createDeepseekStoryProposal,
  createDeepseekStorySpec,
  createDeepseekChapterNarrative,
  createDeepseekRolesFromNarrative,
  createDeepseekRolesMetaFromNarrative,
  createDeepseekRoleScriptFromNarrative,
  createDeepseekStructureFromNarrative,
  deepseekConfig,
  normalizeStoryBrief
} from "../deepseek.js";
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
import { runRevisionMutation } from "../world-revision.js";
import {
  importStoryAssistantDrafts,
  loadStoryManuscript,
  saveStoryManuscript,
  syncStoryManuscriptFromGraph,
  syncStoryManuscriptToGraph
} from "../story-manuscript-service.js";
import {
  classifyStoryDraft,
  importDeepseekMysteryPackageWithClient,
  importDeepseekPipelinePackageWithClient,
  importDeepseekProposalWithClient,
  storyDraftEdges,
  storyDraftSuggestions
} from "./world-helpers.js";
import {
  deepseekImportSchema,
  aiPlaytestRunSchema,
  deepseekMysteryImportSchema,
  deepseekMysteryProposeSchema,
  deepseekPipelineEvaluateSchema,
  deepseekPipelineNarrativeChapterSchema,
  deepseekPipelineNarrativeExtractSchema,
  deepseekPipelineNarrativeRolesSchema,
  deepseekPipelineNarrativeRolesMetaSchema,
  deepseekPipelineNarrativeRoleScriptSchema,
  deepseekPipelineImportSchema,
  deepseekPipelineManuscriptSchema,
  deepseekPipelineMatrixCharactersSchema,
  deepseekPipelineMatrixEvaluateSchema,
  deepseekPipelineMatrixHostSchema,
  deepseekPipelineMatrixInfoSchema,
  deepseekPipelineMatrixPlayerScriptSchema,
  deepseekPipelineMatrixSyncPreviewSchema,
  deepseekPipelineMatrixTruthSchema,
  deepseekPipelineOutlineSchema,
  deepseekPipelineRoleMatrixSchema,
  deepseekPipelineSectionSchema,
  deepseekPipelineSpecSchema,
  deepseekPipelineStructureSchema,
  deepseekProposeSchema,
  storyAssistantAnalyzeSchema,
  storyAssistantImportSchema,
  storyManuscriptPutSchema,
  storyManuscriptSyncFromGraphSchema,
  storyManuscriptSyncToGraphSchema
} from "./schemas.js";

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
      platformAvailable: deepseekConfig().configured
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

  app.post("/api/worlds/:worldId/story-assistant/deepseek/propose", { schema: deepseekProposeSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekStoryProposal(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/import", { schema: deepseekImportSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(request, reply, worldId, async (client) => {
      return (await importDeepseekProposalWithClient(client, worldId, request.body?.proposal)).summary;
    }, { sendErr, statusCode: 201 });
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/full-mystery/propose", { schema: deepseekMysteryProposeSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekMysteryPackage(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/full-mystery/import", { schema: deepseekMysteryImportSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const mystery = request.body?.mystery;
    if (!mystery?.proposal || !mystery?.package) return sendErr(reply, "DEEPSEEK_PACKAGE_REQUIRED");
    return runRevisionMutation(request, reply, worldId, async (client) => {
      return importDeepseekMysteryPackageWithClient(client, worldId, mystery);
    }, { sendErr, statusCode: 201 });
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/spec", { schema: deepseekPipelineSpecSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekStorySpec(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/outline", { schema: deepseekPipelineOutlineSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekStoryOutline(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/structure", { schema: deepseekPipelineStructureSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekStoryProposal({ ...(request.body ?? {}), skipOutline: true });
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/role-matrix", { schema: deepseekPipelineRoleMatrixSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekRoleMatrix(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/section", { schema: deepseekPipelineSectionSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekRoleSection(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/manuscript-synopsis", { schema: deepseekPipelineManuscriptSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekManuscriptSynopsis(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/import", { schema: deepseekPipelineImportSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const pipeline = request.body?.pipeline;
    if (!pipeline?.proposal) return sendErr(reply, "DEEPSEEK_PACKAGE_REQUIRED");
    return runRevisionMutation(request, reply, worldId, async (client) => {
      return importDeepseekPipelinePackageWithClient(client, worldId, pipeline);
    }, { sendErr, statusCode: 201 });
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/evaluate", { schema: deepseekPipelineEvaluateSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    if (body.truthBible && body.infoMatrix) {
      return createPipelineMatrixEvaluation(body);
    }
    const narrativeChapters = Array.isArray(body.narrativeChapters) ? body.narrativeChapters : [];
    const hasSections = body.sections && typeof body.sections === "object" && Object.keys(body.sections).length > 0;
    const hasScripts = body.scripts && typeof body.scripts === "object" && Object.keys(body.scripts).length > 0;
    if (!narrativeChapters.length && !hasSections && !hasScripts) {
      throwErr("VALIDATION_ERROR", "评判需要矩阵产物或旧版总剧情/私人本，请先完成上游步骤");
    }
    const firstSection = body.sampleSection || Object.entries(body.sections || {}).flatMap(([roleKey, chapters]) =>
      Object.entries(chapters || {}).map(([chapterKey, section]) => ({ ...section, roleKey, chapterKey }))
    )[0];
    return createDeepseekStoryEvaluation({
      setting: body.setting,
      synopsis: body.synopsis,
      config: body.config,
      brief: normalizeStoryBrief(body),
      evaluationFocus: body.evaluationFocus,
      spec: body.spec || body.config,
      narrativeChapters: body.narrativeChapters,
      proposal: body.proposal,
      roleMatrix: body.roleMatrix || body.rolesMeta,
      rolesMeta: body.rolesMeta,
      sections: body.sections,
      sampleSection: firstSection
    });
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/narrative/chapter", { schema: deepseekPipelineNarrativeChapterSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekChapterNarrative(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/narrative/roles-meta", { schema: deepseekPipelineNarrativeRolesMetaSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekRolesMetaFromNarrative(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/narrative/role-script", { schema: deepseekPipelineNarrativeRoleScriptSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekRoleScriptFromNarrative(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/narrative/roles", { schema: deepseekPipelineNarrativeRolesSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekRolesFromNarrative(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/narrative/extract-structure", { schema: deepseekPipelineNarrativeExtractSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekStructureFromNarrative(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/truth", { schema: deepseekPipelineMatrixTruthSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createPipelineTruthBible(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/characters", { schema: deepseekPipelineMatrixCharactersSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createPipelineCharacterArchives(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/info-matrix", { schema: deepseekPipelineMatrixInfoSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createPipelineInfoMatrix(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/host-runbook", { schema: deepseekPipelineMatrixHostSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    if (body.allActs) return createPipelineHostRunbooksAll(body);
    return createPipelineHostRunbook(body);
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/player-script", { schema: deepseekPipelineMatrixPlayerScriptSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createPipelineMatrixPlayerScript(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/evaluate", { schema: deepseekPipelineMatrixEvaluateSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createPipelineMatrixEvaluation(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/sync-preview", { schema: deepseekPipelineMatrixSyncPreviewSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return buildPipelineImportPackage(request.body ?? {});
  });

  app.get("/api/worlds/:worldId/story-manuscript", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    return loadStoryManuscript(worldId);
  });

  app.put("/api/worlds/:worldId/story-manuscript", { schema: storyManuscriptPutSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = String(request.body?.body ?? "").trim();
    if (!body) return sendErr(reply, "STORY_MANUSCRIPT_REQUIRED");
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => saveStoryManuscript(client, worldId, body, actorId),
      { sendErr }
    );
  });

  app.post("/api/worlds/:worldId/story-manuscript/sync-from-graph", { schema: storyManuscriptSyncFromGraphSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => syncStoryManuscriptFromGraph(client, worldId, actorId),
      { sendErr }
    );
  });

  app.post("/api/worlds/:worldId/story-manuscript/sync-to-graph", { schema: storyManuscriptSyncToGraphSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = String(request.body?.body ?? "").trim();
    if (!body) return sendErr(reply, "STORY_MANUSCRIPT_REQUIRED");
    return runRevisionMutation(
      request,
      reply,
      worldId,
      (client) => syncStoryManuscriptToGraph(client, worldId, body, actorId),
      { sendErr, statusCode: 201 }
    );
  });

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

}
