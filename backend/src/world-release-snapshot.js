import { narrativeProfileFromSettings } from "../../shared/narrative-profile.js";
import { buildWorldSnapshot } from "./world-snapshot-service.js";
import { WORLD_RELEASE_SNAPSHOT_VERSION } from "./world-release-contract.js";
import { normalizeCommunicationTemplates } from "../../shared/communication-templates.js";

const WORLD_RELEASE_SUPPORT_SQL = `
  SELECT
    COALESCE((
      SELECT jsonb_agg(to_jsonb(ref) ORDER BY ref.created_at, ref.id)
      FROM world_segment_refs ref
      JOIN world_segments segment ON segment.id = ref.segment_id
      WHERE segment.world_id = $1
    ), '[]'::jsonb) AS segment_refs,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(claim) ORDER BY claim.created_at, claim.id)
      FROM world_truth_claims claim WHERE claim.world_id = $1
    ), '[]'::jsonb) AS truth_claims,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(relationship) ORDER BY relationship.created_at, relationship.id)
      FROM world_role_relationships relationship WHERE relationship.world_id = $1
    ), '[]'::jsonb) AS role_relationships,
    (SELECT to_jsonb(core)
     FROM world_core_tricks core
     WHERE core.world_id = $1) AS core_trick,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(archive) ORDER BY archive.created_at, archive.id)
      FROM world_role_archives archive WHERE archive.world_id = $1
    ), '[]'::jsonb) AS role_archives,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(beat) ORDER BY beat.sequence, beat.created_at, beat.id)
      FROM world_foreshadow_beats beat WHERE beat.world_id = $1
    ), '[]'::jsonb) AS foreshadow_beats,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(event) ORDER BY event.sequence, event.created_at, event.id)
      FROM world_timeline_events event WHERE event.world_id = $1
    ), '[]'::jsonb) AS timeline_events,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(tag) ORDER BY tag.tag_key, tag.tag_value)
      FROM world_tags tag WHERE tag.world_id = $1
    ), '[]'::jsonb) AS tags,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(task) ORDER BY task.role_slot_id, task.act_key, task.sequence, task.created_at, task.id)
      FROM player_tasks task WHERE task.world_id = $1
    ), '[]'::jsonb) AS player_tasks,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', asset.id,
        'originalFilename', asset.original_filename,
        'contentType', asset.content_type,
        'byteSize', COALESCE(latest.byte_size, asset.byte_size),
        'sha256', COALESCE(latest.sha256, asset.sha256),
        'assetKind', asset.asset_kind,
        'visibility', asset.visibility,
        'roleSlotId', asset.role_slot_id,
        'versionId', latest.id,
        'versionNumber', latest.version_number,
        'metadata', asset.metadata
      ) ORDER BY asset.created_at, asset.id)
      FROM asset_files asset
      LEFT JOIN LATERAL (
        SELECT version.id, version.version_number, version.byte_size, version.sha256
        FROM asset_versions version
        WHERE version.asset_file_id = asset.id
        ORDER BY version.version_number DESC
        LIMIT 1
      ) latest ON true
      WHERE asset.world_id = $1 AND asset.status = 'active'
    ), '[]'::jsonb) AS asset_manifest
`;

function authoredWorld(world, profile) {
  if (!world) return null;
  return {
    id: world.id,
    name: world.name,
    summary: world.summary ?? "",
    narrativeProfile: profile
  };
}

/**
 * Build the payload that Host/Player will eventually consume through the
 * RuntimeContentProvider. It deliberately excludes rooms, reviews, reports,
 * creator snapshots, storage keys and source manuscripts.
 */
export async function buildWorldReleaseCandidate(worldId, sourceRevision, client) {
  const core = await buildWorldSnapshot(worldId, client);
  if (!core.world) return null;
  const supportResult = await client.query(WORLD_RELEASE_SUPPORT_SQL, [worldId]);
  const support = supportResult.rows[0] ?? {};
  const narrativeProfile = narrativeProfileFromSettings(core.world.settings);

  const snapshot = {
    schemaVersion: WORLD_RELEASE_SNAPSHOT_VERSION,
    sourceRevision,
    narrativeProfile,
    world: authoredWorld(core.world, narrativeProfile),
    chapters: core.chapters,
    roles: core.roles,
    sections: core.sections,
    scenes: core.scenes,
    clues: core.clues,
    investigationPoints: core.investigationPoints,
    items: core.items,
    edges: core.edges,
    rules: core.rules,
    segments: core.segments,
    mechanismPackage: core.mechanismPackage,
    experienceConfiguration: {
      communicationTemplates: normalizeCommunicationTemplates(core.world.settings?.communicationTemplates),
    },
    segmentRefs: support.segment_refs ?? [],
    truthClaims: support.truth_claims ?? [],
    roleRelationships: support.role_relationships ?? [],
    coreTrick: support.core_trick ?? null,
    roleArchives: support.role_archives ?? [],
    foreshadowBeats: support.foreshadow_beats ?? [],
    timelineEvents: support.timeline_events ?? [],
    tags: support.tags ?? [],
    playerTasks: support.player_tasks ?? [],
    assetManifest: support.asset_manifest ?? []
  };
  return {
    snapshot,
    // Runtime state participates in readiness only. It must never enter the
    // immutable authored payload or change the content checksum.
    readinessSnapshot: { ...snapshot, rooms: core.rooms }
  };
}
