import { requireActor } from "../request-actor.js";
import {
  appendVoiceRoomMembers,
  createVoiceRoomForActor,
  issueVoiceRoomToken,
  loadVoiceSession,
  loadVoiceRoomMessages,
  sendVoiceRoomMessage
} from "../voice-service.js";
import { requireRoomRole } from "./route-guards.js";
import {
  appendVoiceMembersSchema,
  createVoiceRoomSchema,
  roomIdParams,
  sendVoiceMessageSchema,
  voiceRoomIdParams,
  voiceRoomInRoomParams
} from "./schemas.js";

export async function registerVoiceRoutes(app) {
  app.get("/api/rooms/:roomId/voice-session", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireRoomRole(actorId, roomId);
    return loadVoiceSession(actorId, roomId);
  });

  app.get("/api/voice-rooms/:voiceRoomId/messages", { schema: { params: voiceRoomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    return loadVoiceRoomMessages(actorId, request.params.voiceRoomId);
  });

  app.post("/api/rooms/:roomId/voice-rooms", { schema: createVoiceRoomSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    const room = await createVoiceRoomForActor({
      actorId,
      roomId,
      membership,
      ...request.body
    });
    return reply.code(201).send(room);
  });

  app.post("/api/voice-rooms/:voiceRoomId/messages", { schema: sendVoiceMessageSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const row = await sendVoiceRoomMessage(actorId, request.params.voiceRoomId, request.body?.body);
    return reply.code(201).send(row);
  });

  app.post("/api/voice-rooms/:voiceRoomId/members", { schema: appendVoiceMembersSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const result = await appendVoiceRoomMembers(
      actorId,
      request.params.voiceRoomId,
      request.body?.inviteUserIds
    );
    return reply.code(201).send(result);
  });

  app.post(
    "/api/rooms/:roomId/voice-rooms/:voiceRoomId/token",
    { schema: { params: voiceRoomInRoomParams } },
    async (request) => {
      const actorId = requireActor(request);
      return issueVoiceRoomToken(actorId, request.params.roomId, request.params.voiceRoomId);
    }
  );
}
