import { query, transaction } from "../db.js";
import { sendErr, throwErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole, requireWorldReader } from "./route-guards.js";
import { createLlmContextPreHandler } from "./llm-route-hook.js";
import { fetchUserLlmPreferences, resolveLlmRuntime } from "../user-llm.js";
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
  buildWorldSnapshot,
  classifyStoryDraft,
  importDeepseekMysteryPackage,
  importDeepseekPipelinePackage,
  importDeepseekProposal,
  renderStoryManuscript,
  storyDraftEdges,
  storyDraftSuggestions,
  syncManuscriptToGraph
} from "./world-helpers.js";
import {
  deepseekImportSchema,
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

  app.post("/api/worlds/:worldId/story-assistant/deepseek/propose", { schema: deepseekProposeSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekStoryProposal(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/import", { schema: deepseekImportSchema, preHandler: llmPreHandler }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await importDeepseekProposal(worldId, request.body?.proposal);
    return reply.code(201).send(result);
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/full-mystery/propose", { schema: deepseekMysteryProposeSchema, preHandler: llmPreHandler }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekMysteryPackage(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/full-mystery/import", { schema: deepseekMysteryImportSchema, preHandler: llmPreHandler }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const mystery = request.body?.mystery;
    if (!mystery?.proposal || !mystery?.package) return sendErr(reply, "DEEPSEEK_PACKAGE_REQUIRED");
    const result = await importDeepseekMysteryPackage(worldId, mystery);
    return reply.code(201).send(result);
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

  app.post("/api/worlds/:worldId/story-assistant/deepseek/pipeline/import", { schema: deepseekPipelineImportSchema, preHandler: llmPreHandler }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const pipeline = request.body?.pipeline;
    if (!pipeline?.proposal) return sendErr(reply, "DEEPSEEK_PACKAGE_REQUIRED");
    const result = await importDeepseekPipelinePackage(worldId, pipeline);
    return reply.code(201).send(result);
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
    await requireWorldReader(actorId, worldId);
    const [manuscript, snapshot] = await Promise.all([
      query(`SELECT body, last_sync_direction, updated_at FROM story_manuscripts WHERE world_id = $1`, [worldId]),
      buildWorldSnapshot(worldId)
    ]);
    const generatedBody = renderStoryManuscript(snapshot);
    return {
      body: manuscript.rows[0]?.body || generatedBody,
      generatedBody,
      lastSyncDirection: manuscript.rows[0]?.last_sync_direction || "graph_to_manuscript",
      updatedAt: manuscript.rows[0]?.updated_at || null
    };
  });

  app.put("/api/worlds/:worldId/story-manuscript", { schema: storyManuscriptPutSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = String(request.body?.body ?? "").trim();
    if (!body) return sendErr(reply, "STORY_MANUSCRIPT_REQUIRED");
    const result = await query(
      `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
       VALUES ($1,$2,'manual',$3)
       ON CONFLICT (world_id) DO UPDATE
       SET body = EXCLUDED.body, last_sync_direction = 'manual',
           updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()
       RETURNING body, last_sync_direction, updated_at`,
      [worldId, body, actorId]
    );
    return result.rows[0];
  });

  app.post("/api/worlds/:worldId/story-manuscript/sync-from-graph", { schema: storyManuscriptSyncFromGraphSchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = renderStoryManuscript(await buildWorldSnapshot(worldId));
    const result = await query(
      `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
       VALUES ($1,$2,'graph_to_manuscript',$3)
       ON CONFLICT (world_id) DO UPDATE
       SET body = EXCLUDED.body, last_sync_direction = 'graph_to_manuscript',
           updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()
       RETURNING body, last_sync_direction, updated_at`,
      [worldId, body, actorId]
    );
    return result.rows[0];
  });

  app.post("/api/worlds/:worldId/story-manuscript/sync-to-graph", { schema: storyManuscriptSyncToGraphSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = String(request.body?.body ?? "").trim();
    if (!body) return sendErr(reply, "STORY_MANUSCRIPT_REQUIRED");
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const synced = await syncManuscriptToGraph(worldId, body, client);
      await client.query(
        `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
         VALUES ($1,$2,'manuscript_to_graph',$3)
         ON CONFLICT (world_id) DO UPDATE
         SET body = EXCLUDED.body, last_sync_direction = 'manuscript_to_graph',
             updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()`,
        [worldId, body, actorId]
      );
      return synced;
    }, { sendErr, statusCode: 201 });
  });

  app.post("/api/worlds/:worldId/story-assistant/import", { schema: storyAssistantImportSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const text = String(request.body?.text ?? "").trim();
    if (!text) return sendErr(reply, "STORY_TEXT_REQUIRED");
    const drafts = classifyStoryDraft(text);
    if (!drafts.length) return sendErr(reply, "STORY_BLOCKS_EMPTY");
    const result = await transaction(async (client) => {
      const nodes = [], ids = new Map();
      let currentSceneId = null;
      for (const draft of drafts) {
        if (draft.type === "scene") {
          const created = await client.query(
            `INSERT INTO scenes (world_id, name, public_text, host_text, metadata)
             VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
            [worldId, draft.name, draft.text, "剧情助手自动分类，等待创作者复核。", JSON.stringify({ source: "story_assistant" })]
          );
          currentSceneId = created.rows[0].id;
          ids.set(draft.key, { type: "scene", id: currentSceneId });
        } else if (draft.type === "clue") {
          const created = await client.query(
            `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
             VALUES ($1, $2, $3, $4, 'role', $5::jsonb) RETURNING id`,
            [worldId, draft.name, draft.text, "剧情助手自动分类，等待创作者复核。", JSON.stringify({ source: "story_assistant" })]
          );
          ids.set(draft.key, { type: "clue", id: created.rows[0].id });
        } else {
          if (!currentSceneId) {
            const fallback = await client.query(
              `INSERT INTO scenes (world_id, name, public_text, host_text, metadata)
               VALUES ($1, '待整理场景', '剧情助手为未归属调查点建立的临时场景。', $2, $3::jsonb) RETURNING id`,
              [worldId, "请在剧情编排中调整归属。", JSON.stringify({ source: "story_assistant", fallback: true })]
            );
            currentSceneId = fallback.rows[0].id;
          }
          const created = await client.query(
            `INSERT INTO investigation_points (world_id, scene_id, name, description, result_text, metadata)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id`,
            [worldId, currentSceneId, draft.name, draft.text, draft.text, JSON.stringify({ source: "story_assistant" })]
          );
          ids.set(draft.key, { type: "investigation_point", id: created.rows[0].id });
        }
        nodes.push({ ...draft, ...ids.get(draft.key) });
      }
      for (let index = 1; index < drafts.length; index += 1) {
        const clue = ids.get(drafts[index].key), point = ids.get(drafts[index - 1].key);
        if (drafts[index].type === "clue" && drafts[index - 1].type === "investigation_point" && clue && point) {
          await client.query(`UPDATE investigation_points SET clue_id = $1 WHERE id = $2 AND world_id = $3`, [clue.id, point.id, worldId]);
        }
      }
      const edges = [];
      for (const edge of storyDraftEdges(drafts)) {
        const from = ids.get(edge.fromKey), to = ids.get(edge.toKey);
        if (!from || !to) continue;
        const created = await client.query(
          `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (world_id, from_type, from_id, to_type, to_id, relation_type) DO NOTHING
           RETURNING id`,
          [worldId, from.type, from.id, to.type, to.id, edge.relationType, edge.label]
        );
        if (created.rowCount) edges.push({ ...edge, id: created.rows[0].id });
      }
      return { nodes, edges, suggestions: storyDraftSuggestions(drafts) };
    });
    return reply.code(201).send(result);
  });

}

