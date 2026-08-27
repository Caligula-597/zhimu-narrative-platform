import { throwErr } from "./api-errors.js";

export async function loadClueEditImpact(worldId, clueId) {
  const clue = await query(
    `SELECT id, name, metadata FROM clues WHERE world_id = $1 AND id = $2`,
    [worldId, clueId]
  );
  if (!clue.rowCount) throwErr("CLUE_NOT_FOUND");

  const [points, edges, foreshadow] = await Promise.all([
    query(
      `SELECT ip.id, ip.name, ip.scene_id, s.name AS scene_name
       FROM investigation_points ip
       LEFT JOIN scenes s ON s.id = ip.scene_id
       WHERE ip.world_id = $1 AND ip.clue_id = $2
       ORDER BY ip.sequence NULLS LAST, ip.created_at
       LIMIT 40`,
      [worldId, clueId]
    ),
    query(
      `SELECT id, from_type, from_id, to_type, to_id, relation_type, label
       FROM story_graph_edges
       WHERE world_id = $1
         AND (
           (from_type = 'clue' AND from_id = $2::uuid)
           OR (to_type = 'clue' AND to_id = $2::uuid)
         )
       ORDER BY created_at
       LIMIT 40`,
      [worldId, clueId]
    ),
    query(
      `SELECT id, title, plant_summary, payoff_summary
       FROM world_foreshadow_beats
       WHERE world_id = $1 AND clue_id = $2
       ORDER BY sequence, created_at
       LIMIT 20`,
      [worldId, clueId]
    )
  ]);

  const segmentKey = clue.rows[0].metadata?.segmentKey || clue.rows[0].metadata?.segment_key || null;
  let segment = null;
  if (segmentKey) {
    const seg = await query(
      `SELECT id, segment_key, title FROM world_segments WHERE world_id = $1 AND segment_key = $2 LIMIT 1`,
      [worldId, segmentKey]
    );
    segment = seg.rows[0] ?? null;
  }

  return {
    clueId,
    clueName: clue.rows[0].name,
    investigationPoints: points.rows,
    graphEdges: edges.rows,
    foreshadowBeats: foreshadow.rows,
    segment: segment
      ? { id: segment.id, segmentKey: segment.segment_key, title: segment.title }
      : segmentKey
        ? { segmentKey, title: null }
        : null,
    cascadeHints: [
      points.rowCount ? "调查点挂靠的触发说明可能需同步" : null,
      foreshadow.rowCount ? "关联伏笔卡的回收口径可能需核对" : null,
      segmentKey ? "剧情段应发线索列表可能受影响" : null
    ].filter(Boolean)
  };
}

export async function loadSceneEditImpact(worldId, sceneId) {
  const scene = await query(
    `SELECT id, name FROM scenes WHERE world_id = $1 AND id = $2`,
    [worldId, sceneId]
  );
  if (!scene.rowCount) throwErr("SCENE_NOT_FOUND");

  const [points, edges] = await Promise.all([
    query(
      `SELECT ip.id, ip.name, ip.clue_id, c.name AS clue_name
       FROM investigation_points ip
       LEFT JOIN clues c ON c.id = ip.clue_id
       WHERE ip.world_id = $1 AND ip.scene_id = $2
       ORDER BY ip.sequence NULLS LAST
       LIMIT 40`,
      [worldId, sceneId]
    ),
    query(
      `SELECT id, from_type, from_id, to_type, to_id, relation_type, label
       FROM story_graph_edges
       WHERE world_id = $1
         AND (
           (from_type = 'scene' AND from_id = $2::uuid)
           OR (to_type = 'scene' AND to_id = $2::uuid)
         )
       ORDER BY created_at
       LIMIT 40`,
      [worldId, sceneId]
    )
  ]);

  return {
    sceneId,
    sceneName: scene.rows[0].name,
    investigationPoints: points.rows,
    graphEdges: edges.rows,
    cascadeHints: [
      points.rowCount ? "场景内调查点与线索配对可能需同步" : null
    ].filter(Boolean)
  };
}
