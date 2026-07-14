import { pool } from "../db.js";
import { requireActor } from "../request-actor.js";
import { requireWorldReader } from "./route-guards.js";
import { ROOMS_VISIBLE_TO_ACTOR_SQL, repairChapterSequencesIfNeeded } from "./world-helpers.js";
import { worldIdParams } from "./schemas/world.js";

export async function registerStudioSnapshotRoutes(app) {
  app.get("/api/worlds/:worldId/studio", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    const client = await pool.connect();
    try {
      await repairChapterSequencesIfNeeded(worldId, client);
      const world = await client.query(
        `SELECT w.id, w.owner_user_id, w.name, w.summary, w.status, w.catalog_public, w.catalog_review_status, w.catalog_review_submitted_at, w.catalog_review_note, w.settings, w.content_revision, wm.role AS membership_role
         FROM worlds w JOIN world_members wm ON wm.world_id = w.id AND wm.user_id = $2 WHERE w.id = $1`,
        [worldId, actorId]
      );
      const canReadDraftContent = ["owner", "editor"].includes(world.rows[0]?.membership_role);
      const chapters = await client.query(`SELECT id, title, summary, sequence, publication_status, unlock_rules, metadata FROM chapters WHERE world_id = $1 ORDER BY sequence`, [worldId]);
      const roles = await client.query(
        `SELECT id, name, public_profile, CASE WHEN $2::boolean THEN private_profile ELSE '' END AS private_profile, sequence
         FROM role_slots WHERE world_id = $1 ORDER BY sequence`, [worldId, canReadDraftContent]
      );
      const sections = await client.query(
        `SELECT ss.id, ss.role_slot_id, ss.chapter_id, ss.title,
                CASE WHEN $2::boolean THEN ss.body ELSE '' END AS body,
                ss.sequence, ss.publication_status, ss.updated_at
         FROM script_sections ss JOIN role_slots rs ON rs.id = ss.role_slot_id
         WHERE rs.world_id = $1 AND ($2::boolean OR ss.publication_status IN ('testing', 'published'))
         ORDER BY rs.sequence, ss.sequence`, [worldId, canReadDraftContent]
      );
      const scenes = await client.query(`SELECT id, chapter_id, name, public_text, host_text, metadata FROM scenes WHERE world_id = $1 ORDER BY created_at`, [worldId]);
      const clues = await client.query(`SELECT id, name, public_text, host_text, visibility, clue_kind, metadata FROM clues WHERE world_id = $1 ORDER BY created_at`, [worldId]);
      const points = await client.query(
        `SELECT id, scene_id, name, description, interaction_text, result_text, clue_id,
                required_item_id, required_role_slot_id, sequence, metadata
         FROM investigation_points WHERE world_id = $1 ORDER BY scene_id, sequence, created_at`, [worldId]
      );
      const items = await client.query(`SELECT id, name, public_text, host_text, metadata FROM items WHERE world_id = $1 ORDER BY created_at`, [worldId]);
      const edges = await client.query(`SELECT id, from_type, from_id, to_type, to_id, relation_type, label FROM story_graph_edges WHERE world_id = $1 ORDER BY created_at`, [worldId]);
      const versions = await client.query(`SELECT id, label, created_at FROM content_versions WHERE world_id = $1 ORDER BY created_at DESC LIMIT 12`, [worldId]);
      const rooms = await client.query(
        `SELECT r.id, r.name, r.status, r.invite_code, r.public_listing FROM rooms r
         WHERE r.world_id = $1 AND ${ROOMS_VISIBLE_TO_ACTOR_SQL} ORDER BY r.created_at DESC`, [worldId, actorId]
      );
      return {
        world: { ...world.rows[0], content_revision: Number(world.rows[0].content_revision ?? 1) },
        chapters: chapters.rows, roles: roles.rows, sections: sections.rows, scenes: scenes.rows,
        clues: clues.rows, investigationPoints: points.rows, items: items.rows, edges: edges.rows,
        versions: versions.rows, rooms: rooms.rows
      };
    } finally {
      client.release();
    }
  });
}
