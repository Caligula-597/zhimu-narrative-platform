import {
  appointCohost,
  listCohosts,
  removeCohost
} from "../host-cohost-service.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { requireActor } from "../request-actor.js";
import {
  appointHostCohostSchema,
  listHostCohostsSchema,
  removeHostCohostSchema
} from "./schemas/host-cohost.js";

export async function registerHostCohostRoutes(app) {
  app.get(
    "/api/rooms/:roomId/host/cohosts",
    { schema: listHostCohostsSchema },
    async (request) => {
      const actorId = requireActor(request);
      return listCohosts(request.params.roomId, actorId);
    }
  );

  app.post(
    "/api/rooms/:roomId/host/cohosts",
    { schema: appointHostCohostSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      return withRoomIdempotency(roomId, request, "host.cohost_appoint", () => appointCohost({
        actorId,
        roomId,
        userId: request.body?.userId,
        email: request.body?.email
      }));
    }
  );

  app.delete(
    "/api/rooms/:roomId/host/cohosts/:userId",
    { schema: removeHostCohostSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId, userId } = request.params;
      return withRoomIdempotency(roomId, request, "host.cohost_remove", () => removeCohost({
        actorId,
        roomId,
        userId
      }));
    }
  );
}
