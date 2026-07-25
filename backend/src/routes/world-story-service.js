import { transaction } from "../db.js";
import { throwErr } from "../api-errors.js";
import { assertNoFrozenRuntimeRooms } from "../runtime-release-guard.js";
export function classifyStoryDraft(text) {
  const blocks = String(text ?? "").split(/\n\s*\n|\r?\n(?=(?:场景|线索|调查点|地点|证据|搜证|scene|clue|point|investigation)\s*[：:])/i).map((item) => item.trim()).filter(Boolean);
  let sceneIndex = 0;
  return blocks.slice(0, 80).map((block, index) => {
    const [prefix = "", ...rest] = block.split(/[：:]/);
    const body = rest.length ? rest.join("：").trim() : block;
    const normalized = prefix.trim();
    let type = "scene";
    if (/^(线索|证据|clue)$/i.test(normalized) || /线索|证据|信件|记录|残页|照片|钥匙/.test(block)) type = "clue";
    if (/^(调查点|搜证|point|investigation)$/i.test(normalized) || /调查点|搜查|检查|翻找|调查/.test(block)) type = "investigation_point";
    if (/^(场景|地点|scene)$/i.test(normalized)) type = "scene";
    if (type === "scene") sceneIndex += 1;
    const name = body.split(/[。；;，,\n]/)[0].trim().slice(0, 42) || `${type}-${index + 1}`;
    return { key: `draft-${index + 1}`, type, name, text: body, sceneIndex };
  });
}

export function storyDraftEdges(nodes) {
  return nodes.slice(1).map((node, index) => {
    const previous = nodes[index];
    return {
      fromKey: previous.key,
      toKey: node.key,
      relationType: node.type === "scene" && previous.type === "scene" ? "mainline" : "extension",
      label: node.type === "scene" && previous.type === "scene" ? "助手生成 · 剧情推进" : "助手生成 · 内容关联"
    };
  });
}

export function storyDraftSuggestions(nodes) {
  const suggestions = [];
  if (!nodes.some((node) => node.type === "scene")) suggestions.push("至少补充一个场景，让玩家知道剧情发生在哪里。");
  if (!nodes.some((node) => node.type === "investigation_point")) suggestions.push("建议补充调查点，明确玩家可以主动搜查什么。");
  if (!nodes.some((node) => node.type === "clue")) suggestions.push("建议补充至少一条线索，形成可被玩家获得的信息。");
  if (nodes.length < 3) suggestions.push("当前剧情片段较少，可以继续补充后续变化或新的可探索地点。");
  if (!suggestions.length) suggestions.push("结构已经包含场景、调查点和线索，可以写入剧情编排后继续调整关系。");
  return suggestions;
}

export function renderStoryManuscript(snapshot) {
  const lines = ["# 完整剧情文稿", "", "这份母稿由剧情编排生成。可以继续编辑，再同步回剧情编排。", ""];
  for (const scene of snapshot.scenes) {
    lines.push(`场景：${scene.name}`, scene.public_text || scene.host_text || "待补充场景说明", "");
    for (const point of snapshot.investigationPoints.filter((item) => item.scene_id === scene.id)) {
      lines.push(`调查点：${point.name}`, point.description || point.result_text || "待补充调查结果", "");
      const clue = snapshot.clues.find((item) => item.id === point.clue_id);
      if (clue) lines.push(`线索：${clue.name}`, clue.public_text || clue.host_text || "待补充线索内容", "");
    }
  }
  const linkedClueIds = new Set(snapshot.investigationPoints.map((item) => item.clue_id).filter(Boolean));
  for (const clue of snapshot.clues.filter((item) => !linkedClueIds.has(item.id))) {
    lines.push(`线索：${clue.name}`, clue.public_text || clue.host_text || "待补充线索内容", "");
  }
  return lines.join("\n").trim();
}

export async function syncManuscriptToGraph(worldId, text, existingClient = null) {
  const drafts = classifyStoryDraft(text);
  if (!drafts.length) throwErr("STORY_BLOCKS_EMPTY");
  const work = async (client) => {
    await assertNoFrozenRuntimeRooms(client, worldId);
    const ids = new Map();
    let currentSceneId = null;
    await client.query(`DELETE FROM story_graph_edges WHERE world_id = $1 AND label LIKE '完整剧情同步%'`, [worldId]);
    await client.query(
      `DELETE FROM story_graph_edges
       WHERE world_id = $1 AND (
         (from_type = 'scene' AND from_id IN (SELECT id FROM scenes WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'))
         OR (to_type = 'scene' AND to_id IN (SELECT id FROM scenes WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'))
         OR (from_type = 'clue' AND from_id IN (SELECT id FROM clues WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'))
         OR (to_type = 'clue' AND to_id IN (SELECT id FROM clues WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'))
         OR (from_type = 'investigation_point' AND from_id IN (SELECT id FROM investigation_points WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'))
         OR (to_type = 'investigation_point' AND to_id IN (SELECT id FROM investigation_points WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'))
       )`,
      [worldId]
    );
    await client.query(`DELETE FROM investigation_points WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'`, [worldId]);
    await client.query(`DELETE FROM clues WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'`, [worldId]);
    await client.query(`DELETE FROM scenes WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'`, [worldId]);
    for (const draft of drafts) {
      const metadata = JSON.stringify({ source: "story_manuscript", manuscriptKey: draft.key });
      let created;
      if (draft.type === "scene") {
        created = await client.query(
          `INSERT INTO scenes (world_id, name, public_text, host_text, metadata)
           VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id`,
          [worldId, draft.name, draft.text, "完整剧情母稿同步，等待创作者复核。", metadata]
        );
        currentSceneId = created.rows[0].id;
      } else if (draft.type === "clue") {
        created = await client.query(
          `INSERT INTO clues (world_id, name, public_text, host_text, visibility, clue_kind, metadata)
           VALUES ($1,$2,$3,$4,'role',$5,$6::jsonb) RETURNING id`,
          [
            worldId,
            draft.name,
            draft.text,
            "完整剧情母稿同步，等待创作者复核。",
            resolveClueKind({
              draftType: draft.type,
              name: draft.name,
              text: draft.text,
              metadata: { source: "story_manuscript" }
            }),
            metadata
          ]
        );
      } else {
        if (!currentSceneId) {
          const fallback = await client.query(
            `INSERT INTO scenes (world_id, name, public_text, host_text, metadata)
             VALUES ($1,'待整理场景','完整剧情母稿为未归属调查点建立的临时场景。',$2,$3::jsonb) RETURNING id`,
            [worldId, "请在剧情编排中调整归属。", JSON.stringify({ source: "story_manuscript", fallback: true })]
          );
          currentSceneId = fallback.rows[0].id;
        }
        created = await client.query(
          `INSERT INTO investigation_points (world_id, scene_id, name, description, result_text, metadata)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
          [worldId, currentSceneId, draft.name, draft.text, draft.text, metadata]
        );
      }
      ids.set(draft.key, { type: draft.type, id: created.rows[0].id });
    }
    for (let index = 1; index < drafts.length; index += 1) {
      const clue = ids.get(drafts[index].key), point = ids.get(drafts[index - 1].key);
      if (drafts[index].type === "clue" && drafts[index - 1].type === "investigation_point") {
        await client.query(`UPDATE investigation_points SET clue_id = $1 WHERE id = $2 AND world_id = $3`, [clue.id, point.id, worldId]);
      }
    }
    const edges = [];
    for (const edge of storyDraftEdges(drafts)) {
      const from = ids.get(edge.fromKey), to = ids.get(edge.toKey);
      if (!from || !to) continue;
      const created = await client.query(
        `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [worldId, from.type, from.id, to.type, to.id, edge.relationType, `完整剧情同步 · ${edge.label}`]
      );
      edges.push(created.rows[0]);
    }
    return { nodes: drafts.length, edges: edges.length, suggestions: storyDraftSuggestions(drafts) };
  };
  if (existingClient) return work(existingClient);
  return transaction(work);
}
