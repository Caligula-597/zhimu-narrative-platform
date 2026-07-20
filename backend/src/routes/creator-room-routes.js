import {
  addCreatorRoom,
  listCreatorRooms,
  reviseCreatorRoomListing
} from "../creator-room-service.js";
import { requireActor } from "../request-actor.js";
import {
  createRoomSchema,
  listCreatorRoomsSchema,
  updateRoomListingSchema
} from "./schemas/creator-room.js";

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

  app.get("/api/worlds/:worldId/rooms", { schema: listCreatorRoomsSchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    return listCreatorRooms({ actorId, worldId });
  });
}
