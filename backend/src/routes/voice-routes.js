import { query, transaction } from "../db.js";
import { publishRoomEvent } from "../room-event-bus.js";
import { requireActor } from "../request-actor.js";
import { requireRoomRole, requireVoiceRoomAccess } from "./route-guards.js";
import {
  appendVoiceMembersSchema,
  createVoiceRoomSchema,
  sendVoiceMessageSchema,
  voiceRoomIdParams
} from "./schemas.js";

export async function registerVoiceRoutes(app) {
  app.get("/api/voice-rooms/:voiceRoomId/messages", { schema: { params: voiceRoomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { voiceRoomId } = request.params;
    await requireVoiceRoomAccess(actorId, voiceRoomId);
    const result = await query(
      `SELECT vrm.id, vrm.body, vrm.created_at, u.display_name AS sender_name
       FROM voice_room_messages vrm
       JOIN users u ON u.id = vrm.sender_user_id
       WHERE vrm.voice_room_id = $1
       ORDER BY vrm.created_at DESC LIMIT 80`,
      [voiceRoomId]
    );
    return result.rows.reverse();
  });

  app.post("/api/rooms/:roomId/voice-rooms", { schema: createVoiceRoomSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireRoomRole(actorId, roomId);
    const { name, roomType = "invite_private", inviteUserIds = [] } = request.body ?? {};
    if (!name?.trim()) return reply.code(400).send({ error: "Voice room name is required" });
    if (!["public", "role_private", "invite_private"].includes(roomType)) return reply.code(400).send({ error: "Unsupported voice room type" });
    if (!Array.isArray(inviteUserIds) || inviteUserIds.length > 20) return reply.code(400).send({ error: "inviteUserIds must be an array of up to 20 members" });
    const room = await transaction(async (client) => {
      const created = await client.query(
        `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
         VALUES ($1, $2, $3, $4) RETURNING id, room_id, name, room_type, status`,
        [roomId, name.trim(), roomType, actorId]
      );
      if (roomType !== "public") {
        const invitees = [...new Set([actorId, ...inviteUserIds])];
        for (const userId of invitees) {
          const member = await client.query(`SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND status = 'active'`, [roomId, userId]);
          if (!member.rowCount) throw Object.assign(new Error("Invited user must be an active room member"), { statusCode: 400 });
          await client.query(
            `INSERT INTO voice_room_members (voice_room_id, user_id, invited_by_user_id, joined_at)
             VALUES ($1, $2, $3, now()) ON CONFLICT (voice_room_id, user_id) DO NOTHING`,
            [created.rows[0].id, userId, actorId]
          );
        }
      }
      return created.rows[0];
    });
    return reply.code(201).send(room);
  });

  app.post("/api/voice-rooms/:voiceRoomId/messages", { schema: sendVoiceMessageSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { voiceRoomId } = request.params;
    await requireVoiceRoomAccess(actorId, voiceRoomId);
    const body = String(request.body?.body ?? "").trim();
    if (!body || body.length > 1000) return reply.code(400).send({ error: "Message body must contain between 1 and 1000 characters" });
    const result = await query(
      `INSERT INTO voice_room_messages (voice_room_id, sender_user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, body, created_at, voice_room_id`,
      [voiceRoomId, actorId, body]
    );
    const row = result.rows[0];
    const room = await query(`SELECT room_id FROM voice_rooms WHERE id = $1`, [voiceRoomId]);
    if (room.rowCount) {
      publishRoomEvent(room.rows[0].room_id, "room.voice_message_created", {
        voiceRoomId,
        messageId: row.id
      });
    }
    return reply.code(201).send({ id: row.id, body: row.body, created_at: row.created_at });
  });

  app.post("/api/voice-rooms/:voiceRoomId/members", { schema: appendVoiceMembersSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { voiceRoomId } = request.params;
    const access = await requireVoiceRoomAccess(actorId, voiceRoomId);
    const { inviteUserIds = [] } = request.body ?? {};
    if (!Array.isArray(inviteUserIds) || !inviteUserIds.length || inviteUserIds.length > 20) {
      return reply.code(400).send({ error: "inviteUserIds must contain between 1 and 20 members" });
    }
    if (access.room_type === "public") return reply.code(400).send({ error: "Public voice rooms do not require invitations" });
    const invitees = [...new Set(inviteUserIds)];
    await transaction(async (client) => {
      for (const userId of invitees) {
        const member = await client.query(
          `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND status = 'active'`,
          [access.room_id, userId]
        );
        if (!member.rowCount) throw Object.assign(new Error("Invited user must be an active room member"), { statusCode: 400 });
      }
      for (const userId of invitees) {
        await client.query(
          `INSERT INTO voice_room_members (voice_room_id, user_id, invited_by_user_id, joined_at)
           VALUES ($1, $2, $3, now()) ON CONFLICT (voice_room_id, user_id) DO NOTHING`,
          [voiceRoomId, userId, actorId]
        );
      }
    });
    return reply.code(201).send({ ok: true, invited: invitees.length });
  });

}
