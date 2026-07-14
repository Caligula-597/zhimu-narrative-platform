import { requireActor } from "../request-actor.js";
import { sendErr, throwErr } from "../api-errors.js";
import { runRevisionMutation } from "../world-revision.js";
import { buildWorldSnapshot } from "./world-helpers.js";
import { requireWorldRole } from "./route-guards.js";
import { createContentVersionSchema, deleteContentVersionSchema, restoreContentVersionSchema } from "./schemas/creator-studio.js";

export async function registerStudioVersionRoutes(app) {
  app.post("/api/worlds/:worldId/content-versions", { schema: createContentVersionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { label = "手动创作快照" } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const snapshot = await buildWorldSnapshot(worldId, client);
      const result = await client.query(
        `INSERT INTO content_versions (world_id, created_by_user_id, label, snapshot)
         VALUES ($1, $2, $3, $4::jsonb) RETURNING id, label, created_at`,
        [worldId, actorId, label, JSON.stringify(snapshot)]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });

  app.post("/api/worlds/:worldId/content-versions/:versionId/restore", { schema: restoreContentVersionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, versionId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const version = await client.query(`SELECT snapshot FROM content_versions WHERE id = $1 AND world_id = $2`, [versionId, worldId]);
      if (!version.rowCount) throwErr("CONTENT_VERSION_NOT_FOUND");
      const snapshot = version.rows[0].snapshot;
      for (const chapter of snapshot.chapters ?? []) {
        await client.query(
          `UPDATE chapters SET title = $1, summary = $2, publication_status = $3, unlock_rules = $4::jsonb, updated_at = now()
           WHERE id = $5 AND world_id = $6`,
          [chapter.title, chapter.summary, chapter.publication_status, JSON.stringify(chapter.unlock_rules ?? {}), chapter.id, worldId]
        );
      }
      for (const section of snapshot.sections ?? []) {
        await client.query(
          `UPDATE script_sections ss SET title = $1, body = $2, chapter_id = $3, publication_status = $4, updated_at = now()
           FROM role_slots rs WHERE ss.id = $5 AND rs.id = ss.role_slot_id AND rs.world_id = $6`,
          [section.title, section.body, section.chapter_id, section.publication_status, section.id, worldId]
        );
      }
      return { ok: true, restoredVersionId: versionId };
    }, { sendErr });
  });

  app.delete("/api/worlds/:worldId/content-versions/:versionId", { schema: deleteContentVersionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, versionId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(`DELETE FROM content_versions WHERE id = $1 AND world_id = $2 RETURNING id`, [versionId, worldId]);
      if (!result.rowCount) throwErr("CONTENT_VERSION_NOT_FOUND");
      return { ok: true };
    }, { sendErr });
  });
}
