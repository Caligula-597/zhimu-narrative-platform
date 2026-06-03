import { query, transaction } from "../db.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { createDeepseekMysteryPackage, createDeepseekStoryProposal, deepseekConfig } from "../deepseek.js";
import {
  buildWorldSnapshot,
  classifyStoryDraft,
  importDeepseekMysteryPackage,
  importDeepseekProposal,
  renderStoryManuscript,
  storyDraftEdges,
  storyDraftSuggestions,
  syncManuscriptToGraph
} from "./world-helpers.js";

export async function registerStoryAssistantRoutes(app) {
  app.post("/api/worlds/:worldId/story-assistant/analyze", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const text = String(request.body?.text ?? "").trim();
    if (!text) return reply.code(400).send({ error: "Story draft text is required" });
    const nodes = classifyStoryDraft(text);
    return { nodes, edges: storyDraftEdges(nodes), suggestions: storyDraftSuggestions(nodes) };
  });

  app.get("/api/worlds/:worldId/story-assistant/deepseek/status", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const config = deepseekConfig();
    return { configured: config.configured, model: config.model };
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/propose", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekStoryProposal(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/import", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await importDeepseekProposal(worldId, request.body?.proposal);
    return reply.code(201).send(result);
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/full-mystery/propose", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekMysteryPackage(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/full-mystery/import", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const mystery = request.body?.mystery;
    if (!mystery?.proposal || !mystery?.package) return reply.code(400).send({ error: "DeepSeek mystery package is required" });
    const result = await importDeepseekMysteryPackage(worldId, mystery);
    return reply.code(201).send(result);
  });

  app.get("/api/worlds/:worldId/story-manuscript", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
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

  app.put("/api/worlds/:worldId/story-manuscript", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = String(request.body?.body ?? "").trim();
    if (!body) return reply.code(400).send({ error: "Story manuscript body is required" });
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

  app.post("/api/worlds/:worldId/story-manuscript/sync-from-graph", async (request) => {
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

  app.post("/api/worlds/:worldId/story-manuscript/sync-to-graph", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = String(request.body?.body ?? "").trim();
    if (!body) return reply.code(400).send({ error: "Story manuscript body is required" });
    const synced = await syncManuscriptToGraph(worldId, body);
    await query(
      `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
       VALUES ($1,$2,'manuscript_to_graph',$3)
       ON CONFLICT (world_id) DO UPDATE
       SET body = EXCLUDED.body, last_sync_direction = 'manuscript_to_graph',
           updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()`,
      [worldId, body, actorId]
    );
    return reply.code(201).send(synced);
  });

  app.post("/api/worlds/:worldId/story-assistant/import", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const text = String(request.body?.text ?? "").trim();
    if (!text) return reply.code(400).send({ error: "Story draft text is required" });
    const drafts = classifyStoryDraft(text);
    if (!drafts.length) return reply.code(400).send({ error: "No story blocks detected" });
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
