import { query } from "./db.js";
import { buildCreatorDashboard } from "./creator-dashboard.js";
import { BIBLE_SUMMARY_SQL, bibleSummaryFromRow } from "./creator-bible.js";
import {
  CREATOR_READINESS_SNAPSHOT_SQL,
  creatorReadinessSnapshotFromRow
} from "./creator-readiness-snapshot.js";
import { storageUsage } from "./routes/world-access-service.js";
import { toSegmentDto } from "./world-segment-read-service.js";

export const CREATOR_COCKPIT_CONTENT_SQL = `
  WITH segment_rows AS (
    SELECT ws.*,
           COALESCE(jsonb_agg(jsonb_build_object(
             'refType', wsr.ref_type, 'refId', wsr.ref_id,
             'roleSlotId', wsr.role_slot_id, 'metadata', wsr.metadata
           ) ORDER BY wsr.created_at) FILTER (WHERE wsr.id IS NOT NULL), '[]'::jsonb) AS refs
    FROM world_segments ws
    LEFT JOIN world_segment_refs wsr ON wsr.segment_id = ws.id
    WHERE ws.world_id = $1
    GROUP BY ws.id
  ), relationship_rows AS (
    SELECT wrr.*, fr.name AS from_role_name, tr.name AS to_role_name,
           fr.sequence AS from_role_sequence, tr.sequence AS to_role_sequence
    FROM world_role_relationships wrr
    JOIN role_slots fr ON fr.id = wrr.from_role_slot_id
    JOIN role_slots tr ON tr.id = wrr.to_role_slot_id
    WHERE wrr.world_id = $1
  )
  SELECT
    COALESCE((
      SELECT jsonb_agg(to_jsonb(segment_rows) ORDER BY sequence, created_at)
      FROM segment_rows
    ), '[]'::jsonb) AS segments,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(world_truth_claims) ORDER BY created_at DESC)
      FROM world_truth_claims WHERE world_id = $1
    ), '[]'::jsonb) AS truth_claims,
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(relationship_rows) - 'from_role_sequence' - 'to_role_sequence'
        ORDER BY from_role_sequence, to_role_sequence, relation_type
      )
      FROM relationship_rows
    ), '[]'::jsonb) AS role_relationships`;

export function creatorCockpitContentFromRow(row = {}) {
  return {
    segments: (row.segments ?? []).map(toSegmentDto),
    truthClaims: row.truth_claims ?? [],
    roleRelationships: row.role_relationships ?? []
  };
}

export async function loadCreatorCockpitContent(worldId, client = null) {
  const db = client?.query ? client.query.bind(client) : query;
  const result = await db(CREATOR_COCKPIT_CONTENT_SQL, [worldId]);
  return creatorCockpitContentFromRow(result.rows[0]);
}

export const CREATOR_BOOTSTRAP_DATA_SQL = `
  WITH readiness AS (
    ${CREATOR_READINESS_SNAPSHOT_SQL}
  ), bible AS (
    ${BIBLE_SUMMARY_SQL}
  ), content AS (
    ${CREATOR_COCKPIT_CONTENT_SQL}
  )
  SELECT
    to_jsonb(readiness) AS readiness,
    to_jsonb(bible) AS bible,
    to_jsonb(content) AS content
  FROM readiness, bible, content`;

export async function loadCreatorBootstrapData(worldId, client = null) {
  const db = client?.query ? client.query.bind(client) : query;
  const result = await db(CREATOR_BOOTSTRAP_DATA_SQL, [worldId]);
  const row = result.rows[0] ?? {};
  return {
    snapshot: creatorReadinessSnapshotFromRow(row.readiness),
    bibleSummary: bibleSummaryFromRow(row.bible),
    ...creatorCockpitContentFromRow(row.content)
  };
}

export function creatorWorkspacePreview(snapshot = {}) {
  const world = snapshot.world
    ? {
        id: snapshot.world.id,
        name: snapshot.world.name,
        summary: snapshot.world.summary || "",
        status: snapshot.world.status,
        catalog_public: snapshot.world.catalog_public,
        settings: snapshot.world.settings || {},
        content_revision: Number(snapshot.world.content_revision ?? 1)
      }
    : null;
  return {
    world,
    chapters: (snapshot.chapters || []).map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary || "",
      sequence: chapter.sequence,
      publication_status: chapter.publication_status,
      metadata: chapter.metadata || {}
    })),
    roles: (snapshot.roles || []).map((role) => ({
      id: role.id,
      name: role.name,
      sequence: role.sequence
    })),
    sections: (snapshot.sections || []).map((section) => ({
      id: section.id,
      role_slot_id: section.role_slot_id,
      chapter_id: section.chapter_id,
      title: section.title,
      sequence: section.sequence,
      publication_status: section.publication_status
    })),
    scenes: (snapshot.scenes || []).map((scene) => ({
      id: scene.id,
      chapter_id: scene.chapter_id,
      name: scene.name
    })),
    clues: (snapshot.clues || []).map((clue) => ({ id: clue.id, name: clue.name })),
    rooms: (snapshot.rooms || []).map((room) => ({ id: room.id }))
  };
}

export async function buildCreatorBootstrap({ worldId, actorId, roomId = null }) {
  const [data, storage] = await Promise.all([
    loadCreatorBootstrapData(worldId),
    storageUsage(actorId)
  ]);
  const dashboard = await buildCreatorDashboard({
    worldId,
    actorId,
    roomId,
    snapshot: data.snapshot,
    storage
  });

  return {
    worldId,
    dashboard,
    workspacePreview: creatorWorkspacePreview(data.snapshot),
    bibleSummary: data.bibleSummary,
    segments: data.segments,
    truthClaims: data.truthClaims,
    roleRelationships: data.roleRelationships,
    generatedAt: new Date().toISOString()
  };
}
