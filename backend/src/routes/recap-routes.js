import {
  createRoomRecap,
  getLatestRoomRecap,
  getRoomRecap,
  listRoomRecaps
} from "../recap-service.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { requireActor } from "../request-actor.js";
import {
  createRecapSchema,
  latestRecapSchema,
  listRecapsSchema,
  recapDetailSchema
} from "./schemas/recap.js";

export async function registerRecapRoutes(app) {
  app.get("/api/rooms/:roomId/recaps", { schema: listRecapsSchema }, async (request) => {
    const actorId = requireActor(request);
    return listRoomRecaps({ actorId, roomId: request.params.roomId });
  });

  app.get("/api/rooms/:roomId/recaps/:recapId", { schema: recapDetailSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, recapId } = request.params;
    return getRoomRecap({ actorId, roomId, recapId });
  });

  app.get("/api/rooms/:roomId/recap/latest", { schema: latestRecapSchema }, async (request) => {
    const actorId = requireActor(request);
    return getLatestRoomRecap({ actorId, roomId: request.params.roomId });
  });

  app.post("/api/rooms/:roomId/recaps", { schema: createRecapSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const roomId = request.params.roomId;
    const result = await withRoomIdempotency(roomId, request, "recaps.create", () => (
      createRoomRecap({
        actorId,
        roomId,
        title: request.body?.title,
        description: request.body?.description,
        logger: request.log
      })
    ));
    return reply.code(201).send(result);
  });
}
