import { pool } from "./db.js";

// One PostgreSQL statement gives every consumer a transaction-consistent
// snapshot and avoids twelve managed-database network round trips.
export const WORLD_ARCHIVE_SNAPSHOT_SQL = `
  SELECT
    (SELECT to_jsonb(w) FROM (
      SELECT id, name, summary, status, settings
      FROM worlds WHERE id = $1
    ) w) AS world,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sequence)
      FROM chapters c WHERE c.world_id = $1
    ), '[]'::jsonb) AS chapters,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.sequence)
      FROM role_slots r WHERE r.world_id = $1
    ), '[]'::jsonb) AS roles,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(ss) ORDER BY rs.sequence, ss.sequence)
      FROM script_sections ss
      JOIN role_slots rs ON rs.id = ss.role_slot_id
      WHERE rs.world_id = $1
    ), '[]'::jsonb) AS sections,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at)
      FROM scenes s WHERE s.world_id = $1
    ), '[]'::jsonb) AS scenes,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at)
      FROM clues c WHERE c.world_id = $1
    ), '[]'::jsonb) AS clues,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(ip) ORDER BY ip.created_at)
      FROM investigation_points ip WHERE ip.world_id = $1
    ), '[]'::jsonb) AS investigation_points,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at)
      FROM items i WHERE i.world_id = $1
    ), '[]'::jsonb) AS items,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at)
      FROM story_graph_edges e WHERE e.world_id = $1
    ), '[]'::jsonb) AS edges,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(ar) ORDER BY ar.priority, ar.created_at)
      FROM automation_rules ar WHERE ar.world_id = $1
    ), '[]'::jsonb) AS rules,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'status', r.status
        ) ORDER BY r.created_at DESC
      )
      FROM rooms r WHERE r.world_id = $1
    ), '[]'::jsonb) AS rooms,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(ws) ORDER BY ws.sequence, ws.created_at)
      FROM world_segments ws WHERE ws.world_id = $1
    ), '[]'::jsonb) AS segments,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(ref) ORDER BY ref.created_at)
      FROM world_segment_refs ref
      JOIN world_segments segment ON segment.id = ref.segment_id
      WHERE segment.world_id = $1
    ), '[]'::jsonb) AS segment_refs,
    (SELECT to_jsonb(manuscript)
     FROM story_manuscripts manuscript
     WHERE manuscript.world_id = $1) AS story_manuscript,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(claim) ORDER BY claim.created_at)
      FROM world_truth_claims claim WHERE claim.world_id = $1
    ), '[]'::jsonb) AS truth_claims,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(relationship) ORDER BY relationship.created_at)
      FROM world_role_relationships relationship WHERE relationship.world_id = $1
    ), '[]'::jsonb) AS role_relationships,
    (SELECT to_jsonb(core)
     FROM world_core_tricks core
     WHERE core.world_id = $1) AS core_trick,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(archive) ORDER BY archive.created_at)
      FROM world_role_archives archive WHERE archive.world_id = $1
    ), '[]'::jsonb) AS role_archives,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(beat) ORDER BY beat.sequence, beat.created_at)
      FROM world_foreshadow_beats beat WHERE beat.world_id = $1
    ), '[]'::jsonb) AS foreshadow_beats,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(event) ORDER BY event.sequence, event.created_at)
      FROM world_timeline_events event WHERE event.world_id = $1
    ), '[]'::jsonb) AS timeline_events,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(report) ORDER BY report.created_at)
      FROM world_quality_reports report WHERE report.world_id = $1
    ), '[]'::jsonb) AS quality_reports,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(tag) ORDER BY tag.tag_key, tag.tag_value)
      FROM world_tags tag WHERE tag.world_id = $1
    ), '[]'::jsonb) AS tags,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', asset.id,
        'originalFilename', asset.original_filename,
        'contentType', asset.content_type,
        'byteSize', asset.byte_size,
        'assetKind', asset.asset_kind,
        'visibility', asset.visibility,
        'roleSlotId', asset.role_slot_id,
        'status', asset.status,
        'metadata', asset.metadata,
        'createdAt', asset.created_at,
        'updatedAt', asset.updated_at
      ) ORDER BY asset.created_at)
      FROM asset_files asset
      WHERE asset.world_id = $1 AND asset.status <> 'deleted'
    ), '[]'::jsonb) AS asset_manifest,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', version.id,
        'label', version.label,
        'createdByUserId', version.created_by_user_id,
        'createdAt', version.created_at
      ) ORDER BY version.created_at DESC)
      FROM content_versions version WHERE version.world_id = $1
    ), '[]'::jsonb) AS content_version_manifest,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', review.id,
        'parentId', review.parent_id,
        'targetType', review.target_type,
        'targetId', review.target_id,
        'targetLabel', review.target_label,
        'anchor', review.anchor,
        'kind', review.kind,
        'status', review.status,
        'severity', review.severity,
        'title', review.title,
        'body', review.body,
        'suggestedPatch', review.suggested_patch,
        'impactScope', review.impact_scope,
        'createdByName', COALESCE(creator.display_name, '已删除成员'),
        'resolvedByName', resolver.display_name,
        'createdAt', review.created_at,
        'updatedAt', review.updated_at,
        'resolvedAt', review.resolved_at
      ) ORDER BY review.created_at)
      FROM creator_review_threads review
      LEFT JOIN users creator ON creator.id = review.created_by_user_id
      LEFT JOIN users resolver ON resolver.id = review.resolved_by_user_id
      WHERE review.world_id = $1
    ), '[]'::jsonb) AS creator_reviews
`;

// Latency-sensitive rules, readiness, graph and manuscript paths only need the
// authored runtime core. Archive-only domains stay out of these hot queries.
export const WORLD_SNAPSHOT_SQL = `
  SELECT
    (SELECT to_jsonb(w) FROM (
      SELECT id, name, summary, status, settings
      FROM worlds WHERE id = $1
    ) w) AS world,
    COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sequence) FROM chapters c WHERE c.world_id = $1), '[]'::jsonb) AS chapters,
    COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.sequence) FROM role_slots r WHERE r.world_id = $1), '[]'::jsonb) AS roles,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(ss) ORDER BY rs.sequence, ss.sequence)
      FROM script_sections ss JOIN role_slots rs ON rs.id = ss.role_slot_id
      WHERE rs.world_id = $1
    ), '[]'::jsonb) AS sections,
    COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at) FROM scenes s WHERE s.world_id = $1), '[]'::jsonb) AS scenes,
    COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at) FROM clues c WHERE c.world_id = $1), '[]'::jsonb) AS clues,
    COALESCE((SELECT jsonb_agg(to_jsonb(ip) ORDER BY ip.created_at) FROM investigation_points ip WHERE ip.world_id = $1), '[]'::jsonb) AS investigation_points,
    COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at) FROM items i WHERE i.world_id = $1), '[]'::jsonb) AS items,
    COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at) FROM story_graph_edges e WHERE e.world_id = $1), '[]'::jsonb) AS edges,
    COALESCE((SELECT jsonb_agg(to_jsonb(ar) ORDER BY ar.priority, ar.created_at) FROM automation_rules ar WHERE ar.world_id = $1), '[]'::jsonb) AS rules,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'status', r.status
      ) ORDER BY r.created_at DESC)
      FROM rooms r WHERE r.world_id = $1
    ), '[]'::jsonb) AS rooms,
    COALESCE((SELECT jsonb_agg(to_jsonb(ws) ORDER BY ws.sequence, ws.created_at) FROM world_segments ws WHERE ws.world_id = $1), '[]'::jsonb) AS segments
`;

function snapshotFromRow(row, { archive = false } = {}) {
  const snapshot = {
    world: row.world || undefined,
    chapters: row.chapters || [],
    roles: row.roles || [],
    sections: row.sections || [],
    scenes: row.scenes || [],
    clues: row.clues || [],
    investigationPoints: row.investigation_points || [],
    items: row.items || [],
    edges: row.edges || [],
    rules: row.rules || [],
    rooms: row.rooms || [],
    segments: row.segments || []
  };
  if (!archive) return snapshot;
  return {
    ...snapshot,
    segmentRefs: row.segment_refs || [],
    storyManuscript: row.story_manuscript || null,
    truthClaims: row.truth_claims || [],
    roleRelationships: row.role_relationships || [],
    coreTrick: row.core_trick || null,
    roleArchives: row.role_archives || [],
    foreshadowBeats: row.foreshadow_beats || [],
    timelineEvents: row.timeline_events || [],
    qualityReports: row.quality_reports || [],
    tags: row.tags || [],
    assetManifest: row.asset_manifest || [],
    contentVersionManifest: row.content_version_manifest || [],
    creatorReviews: row.creator_reviews || []
  };
}

export async function buildWorldSnapshot(worldId, client = pool) {
  const result = await client.query(WORLD_SNAPSHOT_SQL, [worldId]);
  return snapshotFromRow(result.rows[0] || {});
}

export async function buildWorldArchiveSnapshot(worldId, client = pool) {
  const result = await client.query(WORLD_ARCHIVE_SNAPSHOT_SQL, [worldId]);
  return snapshotFromRow(result.rows[0] || {}, { archive: true });
}
