import {
  addCreatorRoom,
  getCreatorRoomContentPolicy,
  listCreatorRooms,
  reviseCreatorRoomListing
} from "../creator-room-service.js";
import { requireActor } from "../request-actor.js";
import {
  applyRoomReleaseSchema,
  createRoomSchema,
  listCreatorRoomsSchema,
  previewRoomReleaseImpactSchema,
  roomContentPolicySchema,
  updateRoomListingSchema
} from "./schemas/creator-room.js";
import {
  applyRoomReleaseChange,
  previewRoomReleaseImpact
} from "../room-release-service.js";

export async function registerCreatorRoomRoutes(app) {
  app.post("/api/worlds/:worldId/rooms", { schema: createRoomSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    const room = await addCreatorRoom({ request, actorId, worldId, body: request.body });
    return reply.code(201).send(room);
  });

  app.patch("/api/worlds/:worldId/rooms/:roomId/listing", { schema: updateRoomListingSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roomId } = request.params;
    const { publicListing } = request.body ?? {};
    return reviseCreatorRoomListing({ actorId, worldId, roomId, publicListing });
  });

  app.get(
    "/api/worlds/:worldId/rooms/content-policy",
    { schema: roomContentPolicySchema },
    async (request) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      return getCreatorRoomContentPolicy({ actorId, worldId });
    }
  );

  app.get(
    "/api/worlds/:worldId/rooms/:roomId/release-impact",
    { schema: previewRoomReleaseImpactSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { worldId, roomId } = request.params;
      return previewRoomReleaseImpact({
        actorId,
        worldId,
        roomId,
        releaseId: request.query.releaseId
      });
    }
  );

  app.patch(
    "/api/worlds/:worldId/rooms/:roomId/content-release",
    { schema: applyRoomReleaseSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { worldId, roomId } = request.params;
      return applyRoomReleaseChange({
        actorId,
        worldId,
        roomId,
        ...request.body
      });
    }
  );

  app.get("/api/worlds/:worldId/rooms", { schema: listCreatorRoomsSchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    return listCreatorRooms({ actorId, worldId });
  });
}
