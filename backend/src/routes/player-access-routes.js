import { sendErr } from "../api-errors.js";
import { joinRoomByInvite, loadRoomInviteAccess } from "../player-access-service.js";
import { requireActor } from "../request-actor.js";
import {
  loadAuthorizedPlayerHomeCore,
  loadPlayerHomeCore,
  loadPlayerHomePayload,
  loadPlayerHomeSupplemental
} from "./player-home-service.js";
import { requireRoomRole } from "./route-guards.js";
import { inviteLookupSchema, joinRoomSchema, roomIdParams } from "./schemas.js";

const playerHomeSocialQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    currentActKey: { type: "string", minLength: 1, maxLength: 80, pattern: "^[a-zA-Z0-9_.:-]+$" }
  }
};

export async function registerPlayerAccessRoutes(app) {
  app.get("/api/rooms/invite/:inviteCode", { schema: inviteLookupSchema }, async (request) => {
    const actorId = requireActor(request);
    return loadRoomInviteAccess(actorId, request.params.inviteCode);
  });

  app.post("/api/rooms/join", { schema: joinRoomSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { inviteCode, roleSlotId } = request.body ?? {};
    if (!inviteCode || !roleSlotId) return sendErr(reply, "INVITE_FIELDS_REQUIRED");
    const roomId = await joinRoomByInvite(actorId, { inviteCode, roleSlotId });
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

  app.get("/api/rooms/:roomId/player-home/core", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const core = await loadAuthorizedPlayerHomeCore({ roomId, actorId });
    if (core) return core;
    // Preserve legacy missing-room, host-healing and membership error semantics on the cold/error path.
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) {
      const error = new Error("Player role selection required");
      error.statusCode = 409;
      throw error;
    }
    return loadPlayerHomeCore({ roomId, roleSlotId: membership.role_slot_id });
  });

  app.get("/api/rooms/:roomId/player-home/social", {
    schema: { params: roomIdParams, querystring: playerHomeSocialQuery }
  }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) {
      const error = new Error("Player role selection required");
      error.statusCode = 409;
      throw error;
    }
    const currentActKey = String(request.query?.currentActKey || "ch1").slice(0, 80);
    return loadPlayerHomeSupplemental({
      roomId,
      roleSlotId: membership.role_slot_id,
      actorId,
      currentActKey
    });
  });
}
