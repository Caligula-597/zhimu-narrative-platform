import { throwErr } from "../api-errors.js";
import {
  investigatePlayerPoint,
  loadPlayerExploration,
  readPlayerClue,
  sharePlayerClueWithRoles,
  sharePlayerClueWithRoom,
  transferPlayerClue,
  updatePlayerClueNote
} from "../player-exploration-service.js";
import {
  applyPlayerDiscoveryAction,
  listPlayerDiscoverySessions
} from "../room-discovery-service.js";
import { getRoomPaceClock } from "../room-pace-clock-service.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { requireActor } from "../request-actor.js";
import { requireRoomRole } from "./route-guards.js";
import {
  cluePlayerNoteSchema,
  clueShareRoomSchema,
  clueShareRolesSchema,
  clueTransferSchema,
  investigatePointSchema,
  readClueSchema,
  roomIdParams
} from "./schemas.js";
import { discoveryActionSchema } from "./schemas/room-discovery.js";

async function requirePlayerMembership(actorId, roomId) {
  const membership = await requireRoomRole(actorId, roomId);
  if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
  return membership;
}

export async function registerPlayerExplorationRoutes(app) {
  app.get("/api/rooms/:roomId/exploration", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requirePlayerMembership(actorId, roomId);
    return loadPlayerExploration(roomId, membership.role_slot_id);
  });

  app.get("/api/rooms/:roomId/discovery-sessions", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requirePlayerMembership(actorId, roomId);
    return listPlayerDiscoverySessions(roomId, membership.role_slot_id);
  });

  app.get("/api/rooms/:roomId/pace-clock", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requirePlayerMembership(actorId, roomId);
    return getRoomPaceClock(roomId, { audience: "player" });
  });

  app.post("/api/rooms/:roomId/discovery-sessions/:locationId/actions", { schema: discoveryActionSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, locationId } = request.params;
    const membership = await requirePlayerMembership(actorId, roomId);
    return applyPlayerDiscoveryAction({
      roomId,
      roleSlotId: membership.role_slot_id,
      actorId,
      locationId,
      input: request.body
    });
  });

  app.post("/api/rooms/:roomId/investigation-points/:pointId/investigate", { schema: investigatePointSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, pointId } = request.params;
    const membership = await requirePlayerMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "player.investigate", () =>
      investigatePlayerPoint({ roomId, pointId, roleSlotId: membership.role_slot_id, actorId })
    );
  });

  app.post("/api/rooms/:roomId/clues/:clueId/read", { schema: readClueSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const membership = await requirePlayerMembership(actorId, roomId);
    return readPlayerClue({ roomId, clueId, roleSlotId: membership.role_slot_id, actorId });
  });

  app.post("/api/rooms/:roomId/clues/:clueId/share-room", { schema: clueShareRoomSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const membership = await requirePlayerMembership(actorId, roomId);
    const shared = request.body?.shared !== false;
    return withRoomIdempotency(roomId, request, "clues.share_room", () =>
      sharePlayerClueWithRoom({ roomId, clueId, roleSlotId: membership.role_slot_id, actorId, shared })
    );
  });

  app.post("/api/rooms/:roomId/clues/:clueId/share-roles", { schema: clueShareRolesSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const membership = await requirePlayerMembership(actorId, roomId);
    const roleSlotIds = request.body?.roleSlotIds ?? [];
    return withRoomIdempotency(roomId, request, "clues.share_roles", () =>
      sharePlayerClueWithRoles({
        roomId,
        clueId,
        roleSlotId: membership.role_slot_id,
        actorId,
        roleSlotIds
      })
    );
  });

  app.post("/api/rooms/:roomId/clues/:clueId/transfer", { schema: clueTransferSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const membership = await requirePlayerMembership(actorId, roomId);
    const { targetRoleSlotId } = request.body;
    return withRoomIdempotency(roomId, request, "clues.transfer", () =>
      transferPlayerClue({
        roomId,
        clueId,
        roleSlotId: membership.role_slot_id,
        actorId,
        targetRoleSlotId
      })
    );
  });

  app.patch("/api/rooms/:roomId/clues/:clueId/player-note", { schema: cluePlayerNoteSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const membership = await requirePlayerMembership(actorId, roomId);
    return updatePlayerClueNote({
      roomId,
      clueId,
      roleSlotId: membership.role_slot_id,
      note: request.body?.note ?? ""
    });
  });
}
