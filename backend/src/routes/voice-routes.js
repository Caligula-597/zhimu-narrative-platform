import { query, transaction } from "../db.js";
import { sendErr, throwErr } from "../api-errors.js";
import { transactionWithEvents } from "../transaction-events.js";
import { createVoiceRoomToken, isLiveKitConfigured } from "../livekit.js";
import { requireActor } from "../request-actor.js";
import { requireRoomRole } from "./route-guards.js";
import { ensureVoiceProviderRoomKey, requireVoiceRoomAccess, resolveVoiceRoomAccess } from "./voice-access.js";
import {
  appendVoiceMembersSchema,
  createVoiceRoomSchema,
  sendVoiceMessageSchema,
  voiceRoomIdParams
} from "./schemas.js";

const voiceRoomInRoomParams = {
  type: "object",
  additionalProperties: false,
  required: ["roomId", "voiceRoomId"],
  properties: {
    roomId: { type: "string", minLength: 36, maxLength: 36 },
    voiceRoomId: { type: "string", minLength: 36, maxLength: 36 }
  }
};

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
    if (!name?.trim()) return sendErr(reply, "VOICE_ROOM_NAME_REQUIRED");
    if (!["public", "role_private", "invite_private"].includes(roomType)) return sendErr(reply, "VOICE_ROOM_TYPE_INVALID");
    if (!Array.isArray(inviteUserIds) || inviteUserIds.length > 20) return sendErr(reply, "VOICE_INVITE_LIST_INVALID");
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
          if (!member.rowCount) throwErr("VOICE_MEMBER_NOT_IN_ROOM");
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
    if (!body || body.length > 1000) return sendErr(reply, "VOICE_MESSAGE_INVALID");
    const row = await transactionWithEvents(async (client, queueEvent) => {
      const result = await client.query(
        `INSERT INTO voice_room_messages (voice_room_id, sender_user_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, body, created_at, voice_room_id`,
        [voiceRoomId, actorId, body]
      );
      const message = result.rows[0];
      const room = await client.query(
        `SELECT vr.room_id, vr.room_type,
                COALESCE(array_agg(vrm.user_id) FILTER (WHERE vrm.user_id IS NOT NULL), '{}') AS audience_user_ids
         FROM voice_rooms vr
         LEFT JOIN voice_room_members vrm
           ON vrm.voice_room_id = vr.id AND vr.room_type <> 'public'
         WHERE vr.id = $1
         GROUP BY vr.id, vr.room_id, vr.room_type`,
        [voiceRoomId]
      );
      if (room.rowCount) {
        const isPublic = room.rows[0].room_type === "public";
        queueEvent(room.rows[0].room_id, "room.voice_message_created", {
          voiceRoomId,
          messageId: message.id,
          audience: isPublic ? "room" : "restricted",
          audienceUserIds: isPublic ? [] : room.rows[0].audience_user_ids
        });
      }
      return message;
    });
    return reply.code(201).send({ id: row.id, body: row.body, created_at: row.created_at });
  });

  app.post("/api/voice-rooms/:voiceRoomId/members", { schema: appendVoiceMembersSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { voiceRoomId } = request.params;
    const access = await requireVoiceRoomAccess(actorId, voiceRoomId);
    const { inviteUserIds = [] } = request.body ?? {};
    if (!Array.isArray(inviteUserIds) || !inviteUserIds.length || inviteUserIds.length > 20) {
      return sendErr(reply, "VOICE_INVITE_COUNT_INVALID");
    }
    if (access.room_type === "public") return sendErr(reply, "VOICE_PUBLIC_NO_INVITE");
    const invitees = [...new Set(inviteUserIds)];
    await transaction(async (client) => {
      for (const userId of invitees) {
        const member = await client.query(
          `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND status = 'active'`,
          [access.room_id, userId]
        );
        if (!member.rowCount) throwErr("VOICE_MEMBER_NOT_IN_ROOM");
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

  app.post("/api/rooms/:roomId/voice-rooms/:voiceRoomId/token", { schema: { params: voiceRoomInRoomParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, voiceRoomId } = request.params;
    const access = await resolveVoiceRoomAccess(actorId, voiceRoomId);
    if (!access.allowed) return sendErr(reply, "VOICE_ACCESS_DENIED", access.error);
    if (access.room_id !== roomId) return sendErr(reply, "VOICE_ROOM_NOT_IN_PARALLEL_ROOM");
    if (!isLiveKitConfigured()) return sendErr(reply, "LIVEKIT_NOT_CONFIGURED");

    const user = await query(`SELECT display_name FROM users WHERE id = $1`, [actorId]);
    const displayName = user.rows[0]?.display_name || "玩家";
    const providerRoomKey = await ensureVoiceProviderRoomKey(voiceRoomId, access.provider_room_key);
    const issued = await createVoiceRoomToken({
      roomName: providerRoomKey,
      participantIdentity: actorId,
      participantName: displayName
    });
    return {
      token: issued.token,
      url: issued.url,
      roomName: issued.roomName,
      voiceRoomId,
      livekit: true
    };
  });

}
