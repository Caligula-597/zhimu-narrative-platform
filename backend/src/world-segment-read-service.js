import { query } from "./db.js";
import { normalizeSegmentOperations } from "./segment-contract.js";

function run(client) {
  return client?.query ? client.query.bind(client) : query;
}

export function toSegmentDto(row) {
  return {
    id: row.id,
    worldId: row.world_id,
    segmentKey: row.segment_key,
    title: row.title,
    sequence: row.sequence,
    chapterId: row.chapter_id,
    story: row.story ?? {},
    mechanics: row.mechanics ?? {},
    operations: normalizeSegmentOperations(row.operations ?? {}),
    quality: row.quality ?? {},
    metadata: row.metadata ?? {},
    refs: row.refs ?? []
  };
}

export async function loadWorldSegments(worldId, client = null) {
  const result = await run(client)(
    `SELECT ws.*,
            COALESCE(json_agg(jsonb_build_object(
              'refType', wsr.ref_type, 'refId', wsr.ref_id,
              'roleSlotId', wsr.role_slot_id, 'metadata', wsr.metadata
            ) ORDER BY wsr.created_at) FILTER (WHERE wsr.id IS NOT NULL), '[]'::json) AS refs
     FROM world_segments ws
     LEFT JOIN world_segment_refs wsr ON wsr.segment_id = ws.id
     WHERE ws.world_id = $1
     GROUP BY ws.id
     ORDER BY ws.sequence, ws.created_at`,
    [worldId]
  );
  return result.rows.map(toSegmentDto);
}
