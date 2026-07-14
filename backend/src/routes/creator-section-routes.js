import { sendErr, throwErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldRole } from "./route-guards.js";
import { createSectionSchema, deleteSectionSchema, updateSectionSchema } from "./schemas/creator-role.js";

export async function registerCreatorSectionRoutes(app) {
  app.post("/api/worlds/:worldId/roles/:roleSlotId/sections", { schema: createSectionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, body, sequence, chapterId = null, publicationStatus = "draft" } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const script = await client.query(
        `INSERT INTO character_scripts (role_slot_id, title)
         SELECT $1, '角色私人剧本'
         WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1)
         RETURNING id`,
        [roleSlotId]
      );
      const scriptId = script.rows[0]?.id ?? (
        await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`, [roleSlotId])
      ).rows[0].id;
      const result = await client.query(
        `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [scriptId, roleSlotId, chapterId, title, body, sequence, publicationStatus]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });

  app.put("/api/worlds/:worldId/roles/:roleSlotId/sections/:sectionId", { schema: updateSectionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId, sectionId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, body, chapterId = null, publicationStatus = "draft" } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const updated = await client.query(
        `UPDATE script_sections ss SET title = $1, body = $2, chapter_id = $3, publication_status = $4, updated_at = now()
         FROM role_slots rs
         WHERE ss.id = $5 AND ss.role_slot_id = $6 AND rs.id = ss.role_slot_id AND rs.world_id = $7
         RETURNING ss.*`,
        [title, body, chapterId || null, publicationStatus, sectionId, roleSlotId, worldId]
      );
      if (!updated.rowCount) throwErr("SECTION_NOT_FOUND");
      return updated.rows[0];
    }, { sendErr });
  });

  app.delete("/api/worlds/:worldId/roles/:roleSlotId/sections/:sectionId", { schema: deleteSectionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId, sectionId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `DELETE FROM script_sections ss USING role_slots rs
         WHERE ss.id = $1 AND ss.role_slot_id = $2 AND rs.id = ss.role_slot_id AND rs.world_id = $3
         RETURNING ss.id`,
        [sectionId, roleSlotId, worldId]
      );
      if (!result.rowCount) throwErr("SCRIPT_SECTION_NOT_FOUND");
      return { ok: true };
    }, { sendErr });
  });
}
