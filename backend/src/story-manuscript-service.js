import { query } from "./db.js";
import { resolveClueKind } from "./clue-kind.js";
import {
  buildWorldSnapshot,
  renderStoryManuscript,
  storyDraftEdges,
  storyDraftSuggestions,
  syncManuscriptToGraph
} from "./routes/world-helpers.js";

export async function loadStoryManuscript(worldId) {
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
}

export async function saveStoryManuscript(client, worldId, body, actorId) {
  const result = await client.query(
    `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
     VALUES ($1,$2,'manual',$3)
     ON CONFLICT (world_id) DO UPDATE
     SET body = EXCLUDED.body, last_sync_direction = 'manual',
         updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()
     RETURNING body, last_sync_direction, updated_at`,
    [worldId, body, actorId]
  );
  return result.rows[0];
}

export async function syncStoryManuscriptFromGraph(client, worldId, actorId) {
  const body = renderStoryManuscript(await buildWorldSnapshot(worldId, client));
  const result = await client.query(
    `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
     VALUES ($1,$2,'graph_to_manuscript',$3)
     ON CONFLICT (world_id) DO UPDATE
     SET body = EXCLUDED.body, last_sync_direction = 'graph_to_manuscript',
         updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()
     RETURNING body, last_sync_direction, updated_at`,
    [worldId, body, actorId]
  );
  return result.rows[0];
}

export async function syncStoryManuscriptToGraph(client, worldId, body, actorId) {
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
}

export async function importStoryAssistantDrafts(client, worldId, drafts) {
  const nodes = [];
  const ids = new Map();
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
        `INSERT INTO clues (world_id, name, public_text, host_text, visibility, clue_kind, metadata)
         VALUES ($1, $2, $3, $4, 'role', $5, $6::jsonb) RETURNING id`,
        [
          worldId,
          draft.name,
          draft.text,
          "剧情助手自动分类，等待创作者复核。",
          resolveClueKind({
            draftType: draft.type,
            name: draft.name,
            text: draft.text,
            metadata: { source: "story_assistant" }
          }),
          JSON.stringify({ source: "story_assistant" })
        ]
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
    const clue = ids.get(drafts[index].key);
    const point = ids.get(drafts[index - 1].key);
    if (drafts[index].type === "clue" && drafts[index - 1].type === "investigation_point" && clue && point) {
      await client.query(
        `UPDATE investigation_points SET clue_id = $1 WHERE id = $2 AND world_id = $3`,
        [clue.id, point.id, worldId]
      );
    }
  }

  const edges = [];
  for (const edge of storyDraftEdges(drafts)) {
    const from = ids.get(edge.fromKey);
    const to = ids.get(edge.toKey);
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
}
