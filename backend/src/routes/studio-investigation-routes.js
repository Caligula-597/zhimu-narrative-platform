import { query } from "../db.js";
import { requireActor } from "../request-actor.js";
import { sendErr, throwErr } from "../api-errors.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldRole } from "./route-guards.js";
import { assertWorldEntity } from "./studio-route-guards.js";
import { createInvestigationPointSchema, patchInvestigationPointSchema } from "./schemas/creator-studio.js";

export async function registerStudioInvestigationRoutes(app) {
  app.patch("/api/worlds/:worldId/investigation-points/:pointId", { schema: patchInvestigationPointSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, pointId } = request.params;
    await requireWorldRole(actorId, worldId);
    const {
      name, description, interactionText, resultText, sceneId, clueId,
      requiredItemId, requiredRoleSlotId, sequence, metadata = {}
    } = request.body ?? {};
    if (name !== undefined && !String(name).trim()) return sendErr(reply, "NAME_EMPTY");
    if (sceneId) {
      const scene = await query(`SELECT 1 FROM scenes WHERE id = $1 AND world_id = $2`, [sceneId, worldId]);
      if (!scene.rowCount) return sendErr(reply, "SCENE_WORLD_MISMATCH");
    }
    if (clueId) {
      const clue = await query(`SELECT 1 FROM clues WHERE id = $1 AND world_id = $2`, [clueId, worldId]);
      if (!clue.rowCount) return sendErr(reply, "CLUE_WORLD_MISMATCH");
    }
    if (requiredItemId) {
      const item = await query(`SELECT 1 FROM items WHERE id = $1 AND world_id = $2`, [requiredItemId, worldId]);
      if (!item.rowCount) return sendErr(reply, "ITEM_NOT_FOUND");
    }
    if (requiredRoleSlotId) {
      const role = await query(`SELECT 1 FROM role_slots WHERE id = $1 AND world_id = $2`, [requiredRoleSlotId, worldId]);
      if (!role.rowCount) return sendErr(reply, "ROLE_SLOT_WORLD_MISMATCH");
    }
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const updated = await client.query(
        `UPDATE investigation_points
         SET name = COALESCE($3, name), description = COALESCE($4, description),
             interaction_text = COALESCE($5, interaction_text), result_text = COALESCE($6, result_text),
             scene_id = COALESCE($7::uuid, scene_id),
             clue_id = CASE WHEN $8::text IS NULL THEN clue_id ELSE NULLIF($8::text, '')::uuid END,
             required_item_id = CASE WHEN $9::text IS NULL THEN required_item_id ELSE NULLIF($9::text, '')::uuid END,
             required_role_slot_id = CASE WHEN $10::text IS NULL THEN required_role_slot_id ELSE NULLIF($10::text, '')::uuid END,
             sequence = COALESCE($11, sequence), metadata = COALESCE(metadata, '{}'::jsonb) || $12::jsonb
         WHERE id = $1 AND world_id = $2
         RETURNING id, scene_id, name, description, interaction_text, result_text, clue_id,
                  required_item_id, required_role_slot_id, sequence, metadata`,
        [pointId, worldId, name?.trim() ?? null, description ?? null, interactionText ?? null,
          resultText ?? null, sceneId ?? null, clueId === undefined ? null : (clueId ?? ""),
          requiredItemId === undefined ? null : (requiredItemId ?? ""),
          requiredRoleSlotId === undefined ? null : (requiredRoleSlotId ?? ""), sequence ?? null, JSON.stringify(metadata)]
      );
      if (!updated.rowCount) throwErr("INVESTIGATION_POINT_NOT_FOUND");
      return updated.rows[0];
    }, { sendErr });
  });

  app.post("/api/worlds/:worldId/scenes/:sceneId/investigation-points", { schema: createInvestigationPointSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, sceneId } = request.params;
    await requireWorldRole(actorId, worldId);
    const scene = await query(`SELECT 1 FROM scenes WHERE id = $1 AND world_id = $2`, [sceneId, worldId]);
    if (!scene.rowCount) return sendErr(reply, "SCENE_NOT_FOUND");
    const {
      name, description = "", interactionText = "", resultText = "", clueId = null,
      requiredItemId = null, requiredRoleSlotId = null, sequence = 0, metadata = {}
    } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      await assertWorldEntity(client, "clues", clueId, worldId, "CLUE_WORLD_MISMATCH");
      await assertWorldEntity(client, "items", requiredItemId, worldId, "ITEM_NOT_FOUND");
      await assertWorldEntity(client, "role_slots", requiredRoleSlotId, worldId, "ROLE_SLOT_WORLD_MISMATCH");
      const result = await client.query(
        `INSERT INTO investigation_points
          (world_id, scene_id, name, description, interaction_text, result_text, clue_id,
           required_item_id, required_role_slot_id, sequence, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
         RETURNING *`,
        [worldId, sceneId, name, description, interactionText, resultText, clueId,
          requiredItemId, requiredRoleSlotId, sequence, JSON.stringify(metadata)]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });
}
