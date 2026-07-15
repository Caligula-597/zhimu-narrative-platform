import { query } from "../db.js";
import { STORY_LAYOUT_TABLES, persistStoryLayoutPositions } from "../studio-layout.js";

const NODE_TABLES = Object.freeze({
  chapter: "chapters",
  scene: "scenes",
  clue: "clues",
  investigation_point: "investigation_points",
  item: "items"
});

const ANCHOR_TABLES = Object.freeze({
  scene: "scenes",
  clue: "clues",
  investigation_point: "investigation_points",
  item: "items"
});

export function supportsStudioNode(nodeType) {
  return Boolean(NODE_TABLES[nodeType]);
}

export function supportsStudioAnchor(nodeType) {
  return Boolean(ANCHOR_TABLES[nodeType]);
}

export function supportsStudioPosition(nodeType) {
  return Boolean(STORY_LAYOUT_TABLES[nodeType]);
}

export async function readStudioNodeReferences(worldId, nodeType, nodeId) {
  const table = NODE_TABLES[nodeType];
  if (!table) return null;
  const result = await query(
    `SELECT
       EXISTS(SELECT 1 FROM ${table} WHERE id = $3 AND world_id = $1) AS exists,
       (SELECT COUNT(*)::int FROM story_graph_edges
        WHERE world_id = $1
          AND ((from_type = $2 AND from_id = $3::uuid) OR (to_type = $2 AND to_id = $3::uuid))) AS edge_count,
       (SELECT COUNT(*)::int FROM automation_rules
        WHERE world_id = $1
          AND (actions::text LIKE '%' || $3 || '%' OR conditions::text LIKE '%' || $3 || '%')) AS rule_reference_count,
       CASE WHEN $2 = 'chapter' THEN
         (SELECT COUNT(*)::int FROM scenes WHERE world_id = $1 AND chapter_id = $3::uuid)
       ELSE 0 END AS scene_count,
       CASE WHEN $2 = 'chapter' THEN
         (SELECT COUNT(*)::int FROM script_sections ss
          INNER JOIN role_slots rs ON rs.id = ss.role_slot_id
          WHERE rs.world_id = $1 AND ss.chapter_id = $3::uuid)
       ELSE 0 END AS section_count,
       CASE WHEN $2 = 'scene' THEN
         (SELECT COUNT(*)::int FROM investigation_points WHERE world_id = $1 AND scene_id = $3::uuid)
       ELSE 0 END AS investigation_point_count,
       CASE WHEN $2 = 'clue' THEN
         (SELECT COUNT(*)::int FROM investigation_points WHERE world_id = $1 AND clue_id = $3::uuid)
       ELSE 0 END AS clue_grant_count,
       CASE WHEN $2 = 'item' THEN
         (SELECT COUNT(*)::int FROM investigation_points WHERE world_id = $1 AND required_item_id = $3::uuid)
       ELSE 0 END AS required_item_count`,
    [worldId, nodeType, nodeId]
  );
  return result.rows[0] ?? null;
}

export async function deleteStoryEdge(client, worldId, edgeId) {
  const result = await client.query(
    `DELETE FROM story_graph_edges WHERE id = $1 AND world_id = $2 RETURNING id`,
    [edgeId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function deleteStudioEntity(client, worldId, nodeType, nodeId) {
  const table = NODE_TABLES[nodeType];
  if (!table || nodeType === "chapter") return null;
  await client.query(
    `DELETE FROM story_graph_edges
     WHERE world_id = $1 AND ((from_type = $2 AND from_id = $3) OR (to_type = $2 AND to_id = $3))`,
    [worldId, nodeType, nodeId]
  );
  const result = await client.query(
    `DELETE FROM ${table} WHERE id = $1 AND world_id = $2 RETURNING id`,
    [nodeId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function updateStudioNodePosition(client, worldId, nodeType, nodeId, position) {
  const table = STORY_LAYOUT_TABLES[nodeType];
  if (!table) return null;
  const result = await client.query(
    `UPDATE ${table}
     SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{graphPosition}', $1::jsonb, true)
     WHERE id = $2 AND world_id = $3 RETURNING id, metadata`,
    [JSON.stringify(position), nodeId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function updateStudioNodeAnchors(client, worldId, nodeType, nodeId, anchors) {
  const table = ANCHOR_TABLES[nodeType];
  if (!table) return null;
  const result = await client.query(
    `UPDATE ${table}
     SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{graphAnchors}', $1::jsonb, true)
     WHERE id = $2 AND world_id = $3 RETURNING id, metadata`,
    [JSON.stringify(anchors), nodeId, worldId]
  );
  return result.rows[0] ?? null;
}

export function saveStudioLayoutPositions(client, worldId, positions) {
  return persistStoryLayoutPositions(client, worldId, positions);
}
