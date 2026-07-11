import { query, transaction } from "../db.js";
import { publishRoomEvent } from "../room-event-bus.js";
import { requireActor } from "../request-actor.js";
import { assertCapability } from "../capabilities.js";
import { requireRoomRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import { prepareRoleSlotForJoin } from "../role-slot-runtime-helpers.js";
import { inviteLookupSchema, joinRoomSchema, roomIdParams } from "./schemas.js";
import { loadPlayerHomePayload } from "./player-home-service.js";

export async function registerPlayerAccessRoutes(app) {

  app.get("/api/rooms/invite/:inviteCode", { schema: inviteLookupSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const room = await query(
      `SELECT r.id, r.name, r.status, w.id AS world_id, w.name AS world_name
       FROM rooms r JOIN worlds w ON w.id = r.world_id
       WHERE r.invite_code = $1`,
      [request.params.inviteCode]
    );
    if (!room.rowCount) return sendErr(reply, "ROOM_NOT_FOUND");
    const bound = await query(
      `SELECT role_slot_id FROM room_members
       WHERE room_id = $1 AND user_id = $2 AND status = 'active' AND role_slot_id IS NOT NULL`,
      [room.rows[0].id, actorId]
    );
    const roles = await query(
      `SELECT rs.id, rs.name, rs.public_profile,
              EXISTS (
                SELECT 1 FROM room_members rm
                WHERE rm.room_id = $1 AND rm.role_slot_id = rs.id AND rm.status = 'active'
              ) AS occupied,
              EXISTS (
                SELECT 1 FROM room_members rm
                WHERE rm.room_id = $1 AND rm.role_slot_id = rs.id
                  AND rm.user_id = $3 AND rm.status = 'active'
              ) AS occupied_by_current
       FROM role_slots rs
       WHERE rs.world_id = $2
       ORDER BY rs.sequence`,
      [room.rows[0].id, room.rows[0].world_id, actorId]
    );
    return {
      room: { id: room.rows[0].id, name: room.rows[0].name, status: room.rows[0].status },
      world: { id: room.rows[0].world_id, name: room.rows[0].world_name },
      current_role_slot_id: bound.rows[0]?.role_slot_id ?? null,
      roles: roles.rows
    };
  });

  app.post("/api/rooms/join", { schema: joinRoomSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    await assertCapability(actorId, "room.join");
    const { inviteCode, roleSlotId } = request.body ?? {};
    if (!inviteCode || !roleSlotId) return sendErr(reply, "INVITE_FIELDS_REQUIRED");
    let roomId;
    try {
      roomId = await transaction(async (client) => {
        const room = await client.query(`SELECT id, world_id FROM rooms WHERE invite_code = $1`, [inviteCode]);
        if (!room.rowCount) {
          const err = new Error("ROOM_NOT_FOUND");
          err.code = "ROOM_NOT_FOUND";
          throw err;
        }
        const role = await client.query(
          `SELECT 1 FROM role_slots WHERE id = $1 AND world_id = $2`,
          [roleSlotId, room.rows[0].world_id]
        );
        if (!role.rowCount) {
          const err = new Error("ROLE_SLOT_WORLD_MISMATCH");
          err.code = "ROLE_SLOT_WORLD_MISMATCH";
          throw err;
        }
        const existing = await client.query(
          `SELECT role_slot_id FROM room_members
           WHERE room_id = $1 AND user_id = $2 AND status = 'active'
           FOR UPDATE`,
          [room.rows[0].id, actorId]
        );
        const boundRoleId = existing.rows[0]?.role_slot_id ?? null;
        if (boundRoleId) {
          if (boundRoleId === roleSlotId) {
            return room.rows[0].id;
          }
          const err = new Error("ROLE_ALREADY_BOUND");
          err.code = "ROLE_ALREADY_BOUND";
          throw err;
        }
        const occupied = await client.query(
          `SELECT 1 FROM room_members
           WHERE room_id = $1 AND role_slot_id = $2 AND user_id <> $3 AND status = 'active'
           FOR UPDATE`,
          [room.rows[0].id, roleSlotId, actorId]
        );
        if (occupied.rowCount) {
          const err = new Error("ROLE_SLOT_OCCUPIED");
          err.code = "ROLE_SLOT_OCCUPIED";
          throw err;
        }
        await prepareRoleSlotForJoin(client, room.rows[0].id, roleSlotId, actorId);
        await client.query(
          `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id)
           VALUES ($1, $2, 'player', $3)
           ON CONFLICT (room_id, user_id)
           DO UPDATE SET role_slot_id = EXCLUDED.role_slot_id, status = 'active'`,
          [room.rows[0].id, actorId, roleSlotId]
        );
        return room.rows[0].id;
      });
    } catch (error) {
      if (error.code === "ROLE_ALREADY_BOUND") {
        return sendErr(reply, "ROLE_ALREADY_BOUND");
      }
      if (error.code === "ROLE_SLOT_OCCUPIED" || error.code === "23505") {
        return sendErr(reply, "ROLE_SLOT_OCCUPIED", "该角色席位已被其他玩家占用。");
      }
      if (error.code === "ROOM_NOT_FOUND") return sendErr(reply, "ROOM_NOT_FOUND");
      if (error.code === "ROLE_SLOT_WORLD_MISMATCH") return sendErr(reply, "ROLE_SLOT_WORLD_MISMATCH");
      throw error;
    }
    const roleInfo = await query(`SELECT name FROM role_slots WHERE id = $1`, [roleSlotId]);
    publishRoomEvent(roomId, "room.player_joined", {
      roleSlotId,
      roleName: roleInfo.rows[0]?.name ?? "玩家角色"
    }).catch(() => {});
    return { ok: true, roomId };
  });

  app.get("/api/rooms/:roomId/player-home", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) {
      const error = new Error("Player role selection required");
      error.statusCode = 409;
      throw error;
    }
    return loadPlayerHomePayload({
      roomId,
      roleSlotId: membership.role_slot_id,
      actorId
    });
  });
}
