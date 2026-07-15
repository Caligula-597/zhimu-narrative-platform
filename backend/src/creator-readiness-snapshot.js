import { pool } from "./db.js";

// Creator checks need references and status fields, not full manuscript, scene,
// clue, or graph records. Keep this projection deliberately smaller than the
// export-grade world snapshot used by imports and versioning.
export const CREATOR_READINESS_SNAPSHOT_SQL = `
  SELECT
    (SELECT to_jsonb(world_row) FROM (
      SELECT id, name, summary, status, catalog_public, settings, content_revision
      FROM worlds WHERE id = $1
    ) world_row) AS world,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(chapter_row) ORDER BY chapter_row.sequence)
      FROM (
        SELECT id, title, summary, sequence, publication_status, metadata
        FROM chapters WHERE world_id = $1
      ) chapter_row
    ), '[]'::jsonb) AS chapters,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(role_row) ORDER BY role_row.sequence)
      FROM (
        SELECT id, name, sequence FROM role_slots WHERE world_id = $1
      ) role_row
    ), '[]'::jsonb) AS roles,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(section_row) ORDER BY section_row.role_sequence, section_row.sequence)
      FROM (
        SELECT ss.id, ss.role_slot_id, ss.chapter_id, ss.title, ss.body, ss.sequence,
               ss.publication_status, ss.metadata, rs.sequence AS role_sequence
        FROM script_sections ss
        JOIN role_slots rs ON rs.id = ss.role_slot_id
        WHERE rs.world_id = $1
      ) section_row
    ), '[]'::jsonb) AS sections,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'chapter_id', chapter_id, 'name', name
      ) ORDER BY created_at)
      FROM scenes WHERE world_id = $1
    ), '[]'::jsonb) AS scenes,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY created_at)
      FROM clues WHERE world_id = $1
    ), '[]'::jsonb) AS clues,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'result_text', result_text, 'clue_id', clue_id
      ) ORDER BY created_at)
      FROM investigation_points WHERE world_id = $1
    ), '[]'::jsonb) AS investigation_points,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'from_type', from_type, 'from_id', from_id,
        'to_type', to_type, 'to_id', to_id
      ) ORDER BY created_at)
      FROM story_graph_edges WHERE world_id = $1
    ), '[]'::jsonb) AS edges,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'enabled', enabled,
        'conditions', conditions, 'actions', actions
      ) ORDER BY priority, created_at)
      FROM automation_rules WHERE world_id = $1
    ), '[]'::jsonb) AS rules,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id) ORDER BY created_at DESC)
      FROM rooms WHERE world_id = $1
    ), '[]'::jsonb) AS rooms,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'segment_key', segment_key, 'title', title,
        'sequence', sequence, 'operations', operations
      ) ORDER BY sequence, created_at)
      FROM world_segments WHERE world_id = $1
    ), '[]'::jsonb) AS segments`;

export function creatorReadinessSnapshotFromRow(row = {}) {
  return {
    world: row.world || undefined,
    chapters: row.chapters ?? [],
    roles: row.roles ?? [],
    sections: (row.sections ?? []).map(({ role_sequence: _roleSequence, ...section }) => section),
    scenes: row.scenes ?? [],
    clues: row.clues ?? [],
    investigationPoints: row.investigation_points ?? [],
    items: [],
    edges: row.edges ?? [],
    rules: row.rules ?? [],
    rooms: row.rooms ?? [],
    segments: row.segments ?? []
  };
}

export async function buildCreatorReadinessSnapshot(worldId, client = pool) {
  const result = await client.query(CREATOR_READINESS_SNAPSHOT_SQL, [worldId]);
  return creatorReadinessSnapshotFromRow(result.rows[0]);
}
