import { query } from "../db.js";
import { sendErr, throwErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldRole } from "./route-guards.js";
import { createChapterSchema, updateChapterSchema } from "./schemas/creator-role.js";

export async function registerCreatorChapterRoutes(app) {
  app.post("/api/worlds/:worldId/chapters", { schema: createChapterSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, summary = "", sequence } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `INSERT INTO chapters (world_id, title, summary, sequence)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [worldId, title, summary, sequence]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });

  app.put("/api/worlds/:worldId/chapters/:chapterId", { schema: updateChapterSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, chapterId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, summary = "", publicationStatus = "draft", unlockRules = {}, metadata = {} } = request.body ?? {};
    const current = await query(`SELECT metadata FROM chapters WHERE id = $1 AND world_id = $2`, [chapterId, worldId]);
    if (!current.rowCount) return sendErr(reply, "CHAPTER_NOT_FOUND");
    const mergedMeta = { ...(current.rows[0].metadata ?? {}), ...metadata };
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const updated = await client.query(
        `UPDATE chapters SET title = $1, summary = $2, publication_status = $3, unlock_rules = $4::jsonb,
                metadata = $5::jsonb, updated_at = now()
         WHERE id = $6 AND world_id = $7 RETURNING *`,
        [title, summary, publicationStatus, JSON.stringify(unlockRules), JSON.stringify(mergedMeta), chapterId, worldId]
      );
      if (!updated.rowCount) throwErr("CHAPTER_NOT_FOUND");
      return updated.rows[0];
    }, { sendErr });
  });
}
