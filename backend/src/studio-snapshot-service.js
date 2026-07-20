import { query, transaction } from "./db.js";
import { throwErr } from "./api-errors.js";
import {
  chapterSequencesNeedRepair,
  compactChapterSequences
} from "./routes/world-chapter-service.js";
import { ROOMS_VISIBLE_TO_ACTOR_SQL } from "./routes/world-access-service.js";
import { projectWorldForMembership } from "./world-settings-visibility.js";

export const STUDIO_SNAPSHOT_SQL = `
  WITH world_row AS (
    SELECT w.id, w.owner_user_id, w.name, w.summary, w.status,
           w.catalog_public, w.catalog_review_status,
           w.catalog_review_submitted_at, w.catalog_review_note,
           w.settings, w.content_revision, wm.role AS membership_role,
           wm.role IN ('owner', 'editor', 'reviewer') AS can_read_draft_content,
           wm.role IN ('owner', 'editor', 'reviewer', 'host') AS can_read_operational_content
    FROM worlds w
    JOIN world_members wm ON wm.world_id = w.id AND wm.user_id = $2
    WHERE w.id = $1
  )
  SELECT
    (SELECT to_jsonb(world_row) - 'can_read_draft_content' - 'can_read_operational_content' FROM world_row) AS world,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(chapter_row) ORDER BY chapter_row.sequence)
      FROM (
        SELECT id, title, summary, sequence, publication_status, unlock_rules, metadata
        FROM chapters
        WHERE world_id = $1
          AND (SELECT can_read_operational_content FROM world_row)
      ) chapter_row
    ), '[]'::jsonb) AS chapters,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(role_row) ORDER BY role_row.sequence)
      FROM (
        SELECT id, name, public_profile,
               CASE WHEN (SELECT can_read_draft_content FROM world_row)
                    THEN private_profile ELSE '' END AS private_profile,
               sequence
        FROM role_slots
        WHERE world_id = $1 AND EXISTS (SELECT 1 FROM world_row)
      ) role_row
    ), '[]'::jsonb) AS roles,
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(section_row) - 'role_sequence'
        ORDER BY section_row.role_sequence, section_row.sequence
      )
      FROM (
        SELECT ss.id, ss.role_slot_id, ss.chapter_id, ss.title,
               CASE WHEN (SELECT can_read_draft_content FROM world_row)
                         OR (SELECT membership_role FROM world_row) = 'host'
                    THEN ss.body ELSE '' END AS body,
               ss.sequence, ss.publication_status, ss.updated_at,
               rs.sequence AS role_sequence
        FROM script_sections ss
        JOIN role_slots rs ON rs.id = ss.role_slot_id
        WHERE rs.world_id = $1
          AND EXISTS (SELECT 1 FROM world_row)
          AND (SELECT can_read_operational_content FROM world_row)
          AND ((SELECT can_read_draft_content FROM world_row)
               OR ss.publication_status IN ('testing', 'published'))
      ) section_row
    ), '[]'::jsonb) AS sections,
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(scene_row) - 'sort_created_at'
        ORDER BY scene_row.sort_created_at
      )
      FROM (
        SELECT id, chapter_id, name, public_text,
               CASE WHEN (SELECT can_read_operational_content FROM world_row)
                    THEN host_text ELSE '' END AS host_text,
               metadata, created_at AS sort_created_at
        FROM scenes
        WHERE world_id = $1
          AND (SELECT can_read_operational_content FROM world_row)
      ) scene_row
    ), '[]'::jsonb) AS scenes,
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(clue_row) - 'sort_created_at'
        ORDER BY clue_row.sort_created_at
      )
      FROM (
        SELECT id, name, public_text,
               CASE WHEN (SELECT can_read_operational_content FROM world_row)
                    THEN host_text ELSE '' END AS host_text,
               visibility, clue_kind, metadata, created_at AS sort_created_at
        FROM clues
        WHERE world_id = $1
          AND (SELECT can_read_operational_content FROM world_row)
      ) clue_row
    ), '[]'::jsonb) AS clues,
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(point_row) - 'sort_created_at'
        ORDER BY point_row.scene_id, point_row.sequence, point_row.sort_created_at
      )
      FROM (
        SELECT id, scene_id, name, description, interaction_text,
               CASE WHEN (SELECT can_read_operational_content FROM world_row)
                    THEN result_text ELSE '' END AS result_text,
               clue_id, required_item_id, required_role_slot_id,
               sequence, metadata, created_at AS sort_created_at
        FROM investigation_points
        WHERE world_id = $1
          AND (SELECT can_read_operational_content FROM world_row)
      ) point_row
    ), '[]'::jsonb) AS investigation_points,
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(item_row) - 'sort_created_at'
        ORDER BY item_row.sort_created_at
      )
      FROM (
        SELECT id, name, public_text,
               CASE WHEN (SELECT can_read_operational_content FROM world_row)
                    THEN host_text ELSE '' END AS host_text,
               metadata, created_at AS sort_created_at
        FROM items
        WHERE world_id = $1
          AND (SELECT can_read_operational_content FROM world_row)
      ) item_row
    ), '[]'::jsonb) AS items,
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(edge_row) - 'sort_created_at'
        ORDER BY edge_row.sort_created_at
      )
      FROM (
        SELECT id, from_type, from_id, to_type, to_id,
               relation_type, label, created_at AS sort_created_at
        FROM story_graph_edges
        WHERE world_id = $1
          AND (SELECT can_read_operational_content FROM world_row)
      ) edge_row
    ), '[]'::jsonb) AS edges,
    COALESCE((
      SELECT jsonb_agg(to_jsonb(version_row) ORDER BY version_row.created_at DESC)
      FROM (
        SELECT id, label, created_at
        FROM content_versions
        WHERE world_id = $1
          AND (SELECT can_read_draft_content FROM world_row)
        ORDER BY created_at DESC
        LIMIT 12
      ) version_row
    ), '[]'::jsonb) AS versions,
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(room_row) - 'sort_created_at'
        ORDER BY room_row.sort_created_at DESC
      )
      FROM (
        SELECT r.id, r.name, r.status,
               CASE WHEN (SELECT membership_role FROM world_row) IN ('owner', 'editor', 'host')
                    THEN r.invite_code ELSE NULL END AS invite_code,
               r.public_listing,
               r.created_at AS sort_created_at
        FROM rooms r
        WHERE r.world_id = $1
          AND EXISTS (SELECT 1 FROM world_row)
          AND ${ROOMS_VISIBLE_TO_ACTOR_SQL}
      ) room_row
    ), '[]'::jsonb) AS rooms`;

function run(client) {
  return client?.query ? client.query.bind(client) : query;
}

function asDate(value) {
  return value == null || value instanceof Date ? value : new Date(value);
}

export async function queryStudioSnapshot({ worldId, actorId, client = null }) {
  const result = await run(client)(STUDIO_SNAPSHOT_SQL, [worldId, actorId]);
  const row = result.rows[0] ?? {};
  const projectedWorld = projectWorldForMembership(row.world);
  const world = projectedWorld
    ? {
        ...projectedWorld,
        ...(projectedWorld.catalog_review_submitted_at == null
          ? {}
          : { catalog_review_submitted_at: asDate(projectedWorld.catalog_review_submitted_at) }),
        content_revision: Number(projectedWorld.content_revision ?? 1)
      }
    : null;
  return {
    world,
    chapters: row.chapters ?? [],
    roles: row.roles ?? [],
    sections: (row.sections ?? []).map((section) => ({
      ...section,
      updated_at: asDate(section.updated_at)
    })),
    scenes: row.scenes ?? [],
    clues: row.clues ?? [],
    investigationPoints: row.investigation_points ?? [],
    items: row.items ?? [],
    edges: row.edges ?? [],
    versions: (row.versions ?? []).map((version) => ({
      ...version,
      created_at: asDate(version.created_at)
    })),
    rooms: row.rooms ?? []
  };
}

export async function loadStudioSnapshot({ worldId, actorId, client = null }) {
  if (!client?.query) {
    return transaction((transactionClient) => loadStudioSnapshot({
      worldId,
      actorId,
      client: transactionClient
    }));
  }
  const snapshot = await queryStudioSnapshot({ worldId, actorId, client });
  if (!snapshot.world) throwErr("WORLD_ACCESS_DENIED");
  if (!chapterSequencesNeedRepair(snapshot.chapters)) return snapshot;
  await compactChapterSequences(client, worldId);
  return queryStudioSnapshot({ worldId, actorId, client });
}
