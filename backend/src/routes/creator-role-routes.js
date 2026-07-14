import { sendErr, throwErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldRole } from "./route-guards.js";
import { createRoleSchema, deleteRoleSchema, updateRoleSchema } from "./schemas/creator-role.js";

export async function registerCreatorRoleRoutes(app) {
  app.post("/api/worlds/:worldId/roles", { schema: createRoleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicProfile = "", privateProfile = "", sequence } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [worldId, name, publicProfile, privateProfile, sequence]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });

  app.put("/api/worlds/:worldId/roles/:roleSlotId", { schema: updateRoleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicProfile = "", privateProfile = "", sequence } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const updated = await client.query(
        `UPDATE role_slots
         SET name = $1, public_profile = $2, private_profile = $3, sequence = $4
         WHERE id = $5 AND world_id = $6 RETURNING *`,
        [name, publicProfile, privateProfile, sequence, roleSlotId, worldId]
      );
      if (!updated.rowCount) throwErr("ROLE_SLOT_NOT_FOUND");
      return updated.rows[0];
    }, { sendErr });
  });

  app.delete("/api/worlds/:worldId/roles/:roleSlotId", { schema: deleteRoleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `DELETE FROM role_slots WHERE id = $1 AND world_id = $2 RETURNING id`,
        [roleSlotId, worldId]
      );
      if (!result.rowCount) throwErr("ROLE_SLOT_NOT_FOUND");
      return { ok: true };
    }, { sendErr });
  });
}
