import { withRoomIdempotency } from "../idempotency-helpers.js";
import { requireActor } from "../request-actor.js";
import {
  executeRoomMechanismAction,
  getRoomMechanismRuntime,
  initializeRoomMechanismRuntime
} from "../room-mechanism-runtime-service.js";
import { requireHostMembership } from "./host-route-guards.js";
import {
  hostMechanismRuntimeActionSchema,
  hostMechanismRuntimeGetSchema,
  hostMechanismRuntimeInitializeSchema
} from "./schemas/host-mechanism-runtime.js";

export async function registerHostMechanismRuntimeRoutes(app) {
  app.get("/api/rooms/:roomId/host/mechanism-runtime", {
    schema: hostMechanismRuntimeGetSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return getRoomMechanismRuntime({ roomId, ...request.query });
  });

  app.post("/api/rooms/:roomId/host/mechanism-runtime/initialize", {
    schema: hostMechanismRuntimeInitializeSchema
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const response = await withRoomIdempotency(roomId, request, "host.mechanism.initialize", () => (
      initializeRoomMechanismRuntime({ roomId, actorId, ...(request.body ?? {}) })
    ));
    return reply.code(response.replayed ? 200 : 201).send(response);
  });

  app.post("/api/rooms/:roomId/host/mechanism-runtime/actions", {
    schema: hostMechanismRuntimeActionSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.mechanism.action", () => (
      executeRoomMechanismAction({ roomId, actorId, ...request.body })
    ));
  });
}
