import { query, transaction } from "../db.js";
import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { setRoomPublicListing } from "../public-room-listing.js";
import { ROOMS_VISIBLE_TO_ACTOR_SQL } from "./world-helpers.js";
import { requireWorldRole } from "./route-guards.js";
import { createRoomSchema, updateRoomListingSchema } from "./schemas/creator-room.js";
import { worldIdParams } from "./schemas/world.js";
import { generateRoomInviteCode } from "../room-invite-code.js";

export async function registerCreatorRoomRoutes(app) {
  app.post("/api/worlds/:worldId/rooms", { schema: createRoomSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const { name, publicListing = false } = request.body ?? {};
    const inviteCode = generateRoomInviteCode("ROOM");
    const room = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status, public_listing)
         VALUES ($1, $2, $3, $4, 'testing', $5) RETURNING *`,
        [worldId, actorId, name, inviteCode, Boolean(publicListing)]
      );
      await client.query(
        `INSERT INTO room_members (room_id, user_id, member_type) VALUES ($1, $2, 'host')`,
        [result.rows[0].id, actorId]
      );
      await client.query(
        `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
         VALUES ($1, '公共讨论房', 'public', $2)`,
        [result.rows[0].id, actorId]
      );
      return result.rows[0];
    });
    return reply.code(201).send(room);
  });

  app.patch("/api/worlds/:worldId/rooms/:roomId/listing", { schema: updateRoomListingSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roomId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const { publicListing } = request.body ?? {};
    try {
      return await setRoomPublicListing({ actorId, worldId, roomId, publicListing });
    } catch (error) {
      if (error.code === "ROOM_NOT_FOUND") return sendErr(reply, "ROOM_NOT_FOUND");
      throw error;
    }
  });

  app.get("/api/worlds/:worldId/rooms", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const result = await query(
      `SELECT r.id, r.name, r.invite_code, r.status, r.public_listing, r.created_at, r.host_user_id,
              (SELECT COUNT(*)::int FROM room_members rm
               WHERE rm.room_id = r.id AND rm.status = 'active' AND rm.role_slot_id IS NOT NULL) AS member_count,
              (SELECT COUNT(*)::int FROM role_slots rs WHERE rs.world_id = r.world_id) AS role_slot_count,
              (r.host_user_id = $2) AS is_mine
       FROM rooms r
       WHERE r.world_id = $1 AND ${ROOMS_VISIBLE_TO_ACTOR_SQL}
       ORDER BY r.created_at DESC`,
      [worldId, actorId]
    );
    return result.rows;
  });
}
