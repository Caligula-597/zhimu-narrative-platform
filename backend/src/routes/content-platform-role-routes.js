import { query } from "../db.js";
import { transactionWithEvents } from "../transaction-events.js";
import { requireActor } from "../request-actor.js";
import { sendErr, throwErr } from "../api-errors.js";
import { logHostAction } from "../audit-log.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldReader, requireWorldRole } from "./route-guards.js";
import {
  assertRoleInRoomWorld, requireHostMembership
} from "./content-platform-room-access.js";
import {
  createRoleRelationshipSchema, updateRoleStateSchema, worldIdParams
} from "./schemas.js";

export async function registerContentPlatformRoleRoutes(app) {
  app.get("/api/worlds/:worldId/role-relationships", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    const result = await query(
      `SELECT wrr.*, fr.name AS from_role_name, tr.name AS to_role_name
       FROM world_role_relationships wrr
       JOIN role_slots fr ON fr.id = wrr.from_role_slot_id
       JOIN role_slots tr ON tr.id = wrr.to_role_slot_id
       WHERE wrr.world_id = $1
       ORDER BY fr.sequence, tr.sequence, wrr.relation_type`,
      [worldId]
    );
    return { relationships: result.rows };
  });

  app.post("/api/worlds/:worldId/role-relationships", { schema: createRoleRelationshipSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const roles = await client.query(
        `SELECT count(*)::int AS count FROM role_slots
         WHERE world_id = $1 AND id = ANY($2::uuid[])`,
        [worldId, [body.fromRoleSlotId, body.toRoleSlotId]]
      );
      if (roles.rows[0].count !== 2) throwErr("ROLE_SLOT_WORLD_MISMATCH");
      const result = await client.query(
        `INSERT INTO world_role_relationships
          (world_id, from_role_slot_id, to_role_slot_id, relation_type, label, strength, visibility, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (world_id, from_role_slot_id, to_role_slot_id, relation_type)
         DO UPDATE SET label = EXCLUDED.label, strength = EXCLUDED.strength,
                       visibility = EXCLUDED.visibility, metadata = EXCLUDED.metadata, updated_at = now()
         RETURNING *`,
        [worldId, body.fromRoleSlotId, body.toRoleSlotId,
          body.relationType ?? "relationship", body.label ?? "", body.strength ?? null,
          body.visibility ?? "host", JSON.stringify(body.metadata ?? {})]
      );
      return { relationship: result.rows[0] };
    }, { sendErr, statusCode: 201 });
  });

  app.patch("/api/rooms/:roomId/host/players/:roleSlotId/state", { schema: updateRoleStateSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, roleSlotId } = request.params;
    const body = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    await assertRoleInRoomWorld(roomId, roleSlotId);
    const result = await transactionWithEvents(async (client, queueEvent) => {
      const updated = await client.query(
        `INSERT INTO room_role_states
          (room_id, role_slot_id, faction_key, public_alias, hidden_identity, variables, updated_by_user_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, now())
         ON CONFLICT (room_id, role_slot_id)
         DO UPDATE SET faction_key = COALESCE(EXCLUDED.faction_key, room_role_states.faction_key),
                       public_alias = COALESCE(EXCLUDED.public_alias, room_role_states.public_alias),
                       hidden_identity = COALESCE(EXCLUDED.hidden_identity, room_role_states.hidden_identity),
                       variables = room_role_states.variables || EXCLUDED.variables,
                       updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()
         RETURNING *`,
        [roomId, roleSlotId, body.factionKey ?? null, body.publicAlias ?? null,
          body.hiddenIdentity ?? null, JSON.stringify(body.variables ?? {}), actorId]
      );
      queueEvent(roomId, "room.role_state_updated", { roleSlotId });
      return updated.rows[0];
    });
    await logHostAction({
      roomId, actorUserId: actorId, action: "role_state_updated",
      targetType: "role_slot", targetId: roleSlotId,
      metadata: { factionKey: body.factionKey ?? null }
    });
    return { state: result };
  });
}
