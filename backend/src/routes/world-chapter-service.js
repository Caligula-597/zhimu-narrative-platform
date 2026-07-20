import { pool, transaction } from "../db.js";

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

function automationRuleHasBrokenReferences(rule, snapshot) {
  const ids = {
    roles: new Set(snapshot.roles.map((item) => item.id)),
    sections: new Set(snapshot.sections.map((item) => item.id)),
    scenes: new Set(snapshot.scenes.map((item) => item.id)),
    clues: new Set(snapshot.clues.map((item) => item.id)),
    points: new Set(snapshot.investigationPoints.map((item) => item.id))
  };
  for (const condition of rule.conditions?.all ?? []) {
    if (condition.roleSlotId && !ids.roles.has(condition.roleSlotId)) return true;
    if (condition.scriptSectionId && !ids.sections.has(condition.scriptSectionId)) return true;
    if (condition.clueId && !ids.clues.has(condition.clueId)) return true;
    if (condition.investigationPointId && !ids.points.has(condition.investigationPointId)) return true;
  }
  for (const action of rule.actions ?? []) {
    if (action.roleSlotId && !ids.roles.has(action.roleSlotId)) return true;
    if (action.scriptSectionId && !ids.sections.has(action.scriptSectionId)) return true;
    if (action.clueId && !ids.clues.has(action.clueId)) return true;
    if (action.sceneId && !ids.scenes.has(action.sceneId)) return true;
  }
  return false;
}

export function findBrokenAutomationRuleIds(snapshot) {
  return snapshot.rules.filter((rule) => automationRuleHasBrokenReferences(rule, snapshot)).map((rule) => rule.id);
}

export async function pruneBrokenAutomationRules(worldId, client = null) {
  const run = async (c) => {
    const snapshot = await buildWorldSnapshot(worldId, c);
    const broken = findBrokenAutomationRuleIds(snapshot);
    if (!broken.length) return 0;
    await c.query(`DELETE FROM automation_rules WHERE world_id = $1 AND id = ANY($2::uuid[])`, [worldId, broken]);
    return broken.length;
  };
  if (client) return run(client);
  return transaction(run);
}

export async function compactChapterSequences(client, worldId) {
  const shifted = await client.query(
    `WITH bounds AS (
       SELECT COALESCE(MAX(sequence), 0)::int + 1 AS offset
       FROM chapters
       WHERE world_id = $1
     )
     UPDATE chapters c
     SET sequence = c.sequence + bounds.offset
     FROM bounds
     WHERE c.world_id = $1
     RETURNING c.id`,
    [worldId]
  );
  if (!shifted.rowCount) return 0;
  await client.query(
    `WITH ranked AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY sequence, created_at)::int AS new_sequence
       FROM chapters
       WHERE world_id = $1
     )
     UPDATE chapters c
     SET sequence = ranked.new_sequence, updated_at = now()
     FROM ranked
     WHERE c.id = ranked.id`,
    [worldId]
  );
  return shifted.rowCount;
}

export function chapterSequencesNeedRepair(chapterRows) {
  if (!chapterRows.length) return false;
  return chapterRows.some((row, index) => Number(row.sequence) !== index + 1);
}

/** Renumber chapters to 1..N when gaps remain (e.g. prologue deleted before auto-compact existed). */
export async function repairChapterSequencesIfNeeded(worldId, client = null) {
  const run = async (c) => {
    const rows = await c.query(
      `SELECT id, sequence FROM chapters WHERE world_id = $1 ORDER BY sequence, created_at`,
      [worldId]
    );
    if (!chapterSequencesNeedRepair(rows.rows)) return 0;
    return compactChapterSequences(c, worldId);
  };
  if (client) return run(client);
  return transaction(run);
}

/** Delete a public chapter, remove bound role sections + dependent rules, renumber survivors. */
export async function deleteWorldChapter(client, worldId, chapterId) {
  const sectionRows = await client.query(
    `SELECT ss.id FROM script_sections ss
     INNER JOIN role_slots rs ON rs.id = ss.role_slot_id
     WHERE rs.world_id = $1 AND ss.chapter_id = $2`,
    [worldId, chapterId]
  );
  const sectionIds = sectionRows.rows.map((row) => row.id);

  if (sectionIds.length) {
    const rules = await client.query(`SELECT id, conditions, actions FROM automation_rules WHERE world_id = $1`, [worldId]);
    const sectionIdSet = new Set(sectionIds);
    const ruleIdsToDelete = rules.rows.filter((rule) => {
      const conditionHit = (rule.conditions?.all ?? []).some((item) => sectionIdSet.has(item.scriptSectionId));
      const actionHit = (rule.actions ?? []).some((item) => sectionIdSet.has(item.scriptSectionId));
      return conditionHit || actionHit;
    }).map((rule) => rule.id);
    if (ruleIdsToDelete.length) {
      await client.query(`DELETE FROM automation_rules WHERE world_id = $1 AND id = ANY($2::uuid[])`, [worldId, ruleIdsToDelete]);
    }
    await client.query(`DELETE FROM script_sections WHERE id = ANY($1::uuid[])`, [sectionIds]);
  }

  await client.query(
    `DELETE FROM story_graph_edges
     WHERE world_id = $1 AND ((from_type = 'chapter' AND from_id = $2) OR (to_type = 'chapter' AND to_id = $2))`,
    [worldId, chapterId]
  );

  const deleted = await client.query(
    `DELETE FROM chapters WHERE id = $1 AND world_id = $2 RETURNING id`,
    [chapterId, worldId]
  );
  if (!deleted.rowCount) return null;

  await compactChapterSequences(client, worldId);
  await pruneBrokenAutomationRules(worldId, client);
  return { deletedId: chapterId, sectionsRemoved: sectionIds.length };
}
