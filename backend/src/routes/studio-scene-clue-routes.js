import { requireActor } from "../request-actor.js";
import { sendErr, throwErr } from "../api-errors.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldRole } from "./route-guards.js";
import { assertWorldEntity } from "./studio-route-guards.js";
import { createClueSchema, createSceneSchema, patchClueSchema, patchSceneSchema } from "./schemas/creator-studio.js";

export async function registerStudioSceneClueRoutes(app) {
  app.post("/api/worlds/:worldId/scenes", { schema: createSceneSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText = "", hostText = "", chapterId = null, metadata = {} } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      await assertWorldEntity(client, "chapters", chapterId, worldId, "CHAPTER_NOT_FOUND");
      const result = await client.query(
        `INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *`,
        [worldId, chapterId, name, publicText, hostText, JSON.stringify(metadata)]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });

  app.post("/api/worlds/:worldId/clues", { schema: createClueSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText = "", hostText = "", visibility = "role", clueKind = "general", metadata = {} } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `INSERT INTO clues (world_id, name, public_text, host_text, visibility, clue_kind, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING *`,
        [worldId, name, publicText, hostText, visibility, clueKind, JSON.stringify(metadata)]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });

  app.patch("/api/worlds/:worldId/scenes/:sceneId", { schema: patchSceneSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, sceneId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText, hostText, chapterId, metadata = {} } = request.body ?? {};
    if (name !== undefined && !String(name).trim()) return sendErr(reply, "NAME_EMPTY");
    return runRevisionMutation(request, reply, worldId, async (client) => {
      if (chapterId) await assertWorldEntity(client, "chapters", chapterId, worldId, "CHAPTER_NOT_FOUND");
      const updated = await client.query(
        `UPDATE scenes
         SET name = COALESCE($3, name),
             public_text = COALESCE($4, public_text),
             host_text = COALESCE($5, host_text),
             chapter_id = CASE WHEN $6::text IS NULL THEN chapter_id ELSE NULLIF($6::text, '')::uuid END,
             metadata = COALESCE(metadata, '{}'::jsonb) || $7::jsonb
         WHERE id = $1 AND world_id = $2
         RETURNING id, chapter_id, name, public_text, host_text, metadata`,
        [sceneId, worldId, name?.trim() ?? null, publicText ?? null, hostText ?? null,
          chapterId === undefined ? null : (chapterId ?? ""), JSON.stringify(metadata)]
      );
      if (!updated.rowCount) throwErr("SCENE_NOT_FOUND");
      return updated.rows[0];
    }, { sendErr });
  });

  app.patch("/api/worlds/:worldId/clues/:clueId", { schema: patchClueSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, clueId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText, hostText, visibility, clueKind, metadata = {} } = request.body ?? {};
    if (name !== undefined && !String(name).trim()) return sendErr(reply, "NAME_EMPTY");
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const updated = await client.query(
        `UPDATE clues
         SET name = COALESCE($3, name), public_text = COALESCE($4, public_text),
             host_text = COALESCE($5, host_text), visibility = COALESCE($6, visibility),
             clue_kind = COALESCE($7, clue_kind), metadata = COALESCE(metadata, '{}'::jsonb) || $8::jsonb
         WHERE id = $1 AND world_id = $2
         RETURNING id, name, public_text, host_text, visibility, clue_kind, metadata`,
        [clueId, worldId, name?.trim() ?? null, publicText ?? null, hostText ?? null,
          visibility ?? null, clueKind ?? null, JSON.stringify(metadata)]
      );
      if (!updated.rowCount) throwErr("CLUE_NOT_FOUND");
      return updated.rows[0];
    }, { sendErr });
  });
}
