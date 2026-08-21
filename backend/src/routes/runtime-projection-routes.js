import { throwErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { loadRuntimeContentProvider } from "../runtime-content-provider.js";
import { buildRuntimeKnowledgeProjection } from "../runtime-knowledge-service.js";
import { buildRuntimeCurrentState } from "../runtime-current-state-service.js";
import { requireHostMembership } from "./host-route-guards.js";
import {
  WORLD_CREATOR_READER_ROLES,
  requireRoomRole,
  requireWorldRole
} from "./route-guards.js";
import {
  creatorCurrentStateRouteSchema,
  creatorKnowledgeRouteSchema,
  hostCurrentStateRouteSchema,
  hostKnowledgeRouteSchema,
  hostRuntimeContentRouteSchema,
  playerCurrentStateRouteSchema,
  playerKnowledgeRouteSchema
} from "./schemas/runtime-projection.js";

async function requirePlayerRole(actorId, roomId) {
  const membership = await requireRoomRole(actorId, roomId);
  if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
  return membership.role_slot_id;
}

async function requireCreatorRuntimeRoom(actorId, worldId, roomId) {
  await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
  const provider = await loadRuntimeContentProvider(roomId);
  if (!provider || provider.worldId !== worldId) throwErr("ROOM_NOT_FOUND");
  return provider;
}

export async function registerRuntimeProjectionRoutes(app) {
  app.get("/api/rooms/:roomId/runtime-content", {
    schema: hostRuntimeContentRouteSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const provider = await loadRuntimeContentProvider(roomId);
    if (!provider) throwErr("ROOM_NOT_FOUND");
    return provider.toResponse();
  });

  app.get("/api/rooms/:roomId/knowledge", {
    schema: playerKnowledgeRouteSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const roleSlotId = await requirePlayerRole(actorId, roomId);
    return buildRuntimeKnowledgeProjection({ roomId, roleSlotId, audience: "player" });
  });

  app.get("/api/rooms/:roomId/host/players/:roleSlotId/knowledge", {
    schema: hostKnowledgeRouteSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, roleSlotId } = request.params;
    await requireHostMembership(actorId, roomId);
    return buildRuntimeKnowledgeProjection({ roomId, roleSlotId, audience: "host" });
  });

  app.get("/api/worlds/:worldId/rooms/:roomId/knowledge/:roleSlotId", {
    schema: creatorKnowledgeRouteSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, roomId, roleSlotId } = request.params;
    const provider = await requireCreatorRuntimeRoom(actorId, worldId, roomId);
    return buildRuntimeKnowledgeProjection({
      roomId,
      roleSlotId,
      audience: "creator",
      provider
    });
  });

  app.get("/api/rooms/:roomId/current-state", {
    schema: playerCurrentStateRouteSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const roleSlotId = await requirePlayerRole(actorId, roomId);
    return buildRuntimeCurrentState({
      roomId,
      roleSlotId,
      audience: "player"
    });
  });

  app.get("/api/rooms/:roomId/host/current-state", {
    schema: hostCurrentStateRouteSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return buildRuntimeCurrentState({
      roomId,
      audience: "host"
    });
  });

  app.get("/api/worlds/:worldId/rooms/:roomId/current-state", {
    schema: creatorCurrentStateRouteSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, roomId } = request.params;
    const provider = await requireCreatorRuntimeRoom(actorId, worldId, roomId);
    return buildRuntimeCurrentState({ roomId, audience: "creator", provider });
  });
}
