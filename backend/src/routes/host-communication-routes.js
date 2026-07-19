import {
  createHostManualLog,
  nudgeWaitingPlayers
} from "../host-communication-service.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { requireActor } from "../request-actor.js";
import {
  hostLogSchema,
  hostNudgeWaitingSchema
} from "./schemas/host-communication.js";

export async function registerHostCommunicationRoutes(app) {
  app.post("/api/rooms/:roomId/host/log", { schema: hostLogSchema }, async (request) => {
    const actorId = requireActor(request);
    const roomId = request.params.roomId;
    return withRoomIdempotency(roomId, request, "host.manual_log", () => createHostManualLog({
      actorId,
      roomId,
      message: request.body?.message,
      eventType: request.body?.eventType,
      roleSlotId: request.body?.roleSlotId
    }));
  });

  app.post("/api/rooms/:roomId/host/nudge-waiting", { schema: hostNudgeWaitingSchema }, async (request) => {
    const actorId = requireActor(request);
    const roomId = request.params.roomId;
    return withRoomIdempotency(roomId, request, "host.nudge_waiting", () => nudgeWaitingPlayers({
      actorId,
      roomId,
      message: request.body?.message,
      roleSlotIds: request.body?.roleSlotIds
    }));
  });
}
