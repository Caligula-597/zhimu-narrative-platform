import { transaction } from "../db.js";
import { throwErr } from "../api-errors.js";
import { logHostAction } from "../audit-log.js";
import { requireActor } from "../request-actor.js";
import { recordRoleSlotLastOccupant } from "../role-slot-runtime-helpers.js";
import { transactionWithEvents } from "../transaction-events.js";
import { assertRoleInRoomWorld, requireHostMembership } from "./host-route-guards.js";
import { hostNotesSchema, roleSlotRoomParams } from "./schemas.js";

export async function registerHostPlayerManagementRoutes(app) {
  app.put("/api/rooms/:roomId/host/players/:roleSlotId/notes", { schema: hostNotesSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, roleSlotId } = request.params;
    const { notes } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    await transaction(async (client) => {
      await assertRoleInRoomWorld(client.query.bind(client), roomId, roleSlotId);
      await client.query(
        `INSERT INTO player_states (room_id, role_slot_id, variables, updated_at)
         VALUES ($1, $2, jsonb_build_object('hostNotes', $3::text), now())
         ON CONFLICT (room_id, role_slot_id)
         DO UPDATE SET variables = COALESCE(player_states.variables, '{}'::jsonb) || jsonb_build_object('hostNotes', $3::text),
                       updated_at = now()`,
        [roomId, roleSlotId, notes ?? ""]
      );
    });
    return { ok: true };
  });

  app.post("/api/rooms/:roomId/host/players/:roleSlotId/kick", { schema: { params: roleSlotRoomParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, roleSlotId } = request.params;
    await requireHostMembership(actorId, roomId);
    let kickedUserId = null;
    let roleName = "";
    let displayName = "";

    await transactionWithEvents(async (client, queueEvent) => {
      await assertRoleInRoomWorld(client.query.bind(client), roomId, roleSlotId);
      const member = await client.query(
        `SELECT rm.user_id, u.display_name, rs.name AS role_name
         FROM room_members rm
         JOIN users u ON u.id = rm.user_id
         JOIN role_slots rs ON rs.id = rm.role_slot_id
         WHERE rm.room_id = $1 AND rm.role_slot_id = $2 AND rm.status = 'active'
         FOR UPDATE`,
        [roomId, roleSlotId]
      );
      if (!member.rowCount) throwErr("ROLE_SLOT_NOT_OCCUPIED");
      kickedUserId = member.rows[0].user_id;
      roleName = member.rows[0].role_name;
      displayName = member.rows[0].display_name;
      await recordRoleSlotLastOccupant(client, roomId, roleSlotId, kickedUserId);
      await client.query(
        `UPDATE room_members
         SET status = 'removed', role_slot_id = NULL
         WHERE room_id = $1 AND user_id = $2 AND status = 'active'`,
        [roomId, kickedUserId]
      );
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'player_kicked', $3, $4::jsonb)`,
        [
          roomId,
          actorId,
          `主持人将 ${displayName || "玩家"} 移出角色「${roleName}」`,
          JSON.stringify({ roleSlotId, userId: kickedUserId, roleName })
        ]
      );
      queueEvent(roomId, "room.player_kicked", { roleSlotId, userId: kickedUserId, roleName });
    });

    await logHostAction({
      roomId,
      actorUserId: actorId,
      action: "host_kick_player",
      targetType: "role_slot",
      targetId: roleSlotId,
      metadata: { userId: kickedUserId, roleName, displayName }
    });
    return { ok: true, userId: kickedUserId, roleSlotId, roleName };
  });
}
