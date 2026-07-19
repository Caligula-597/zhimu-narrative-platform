import {
  createRoomCheckpoint,
  getRoomCheckpoint,
  listRoomCheckpointRestores,
  listRoomCheckpoints,
  restoreRoomCheckpoint
} from "../checkpoint-service.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { requireActor } from "../request-actor.js";
import { requireHostMembership } from "./host-route-guards.js";
import {
  checkpointIdParams,
  checkpointRoomIdParams,
  createCheckpointSchema,
  restoreCheckpointSchema
} from "./schemas/checkpoint.js";

export async function registerCheckpointRoutes(app) {
  app.get("/api/rooms/:roomId/checkpoints", { schema: { params: checkpointRoomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return listRoomCheckpoints(roomId);
  });

  app.get("/api/rooms/:roomId/checkpoints/:checkpointId", { schema: { params: checkpointIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, checkpointId } = request.params;
    await requireHostMembership(actorId, roomId);
    return getRoomCheckpoint(roomId, checkpointId);
  });

  app.post("/api/rooms/:roomId/checkpoints", { schema: createCheckpointSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { title, description = "" } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    const response = await withRoomIdempotency(roomId, request, "checkpoints.create", () =>
      createRoomCheckpoint({ roomId, actorId, title, description })
    );
    return reply.code(201).send(response);
  });

  app.get("/api/rooms/:roomId/checkpoints/:checkpointId/restores", { schema: { params: checkpointIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, checkpointId } = request.params;
    await requireHostMembership(actorId, roomId);
    return listRoomCheckpointRestores(roomId, checkpointId);
  });

  app.post("/api/rooms/:roomId/checkpoints/:checkpointId/restore", { schema: restoreCheckpointSchema }, async (request) => {
    const actorId = requireActor(request);
    const targetRoomId = request.params.roomId;
    const { checkpointId } = request.params;
    await requireHostMembership(actorId, targetRoomId);
    return withRoomIdempotency(targetRoomId, request, "checkpoints.restore", () =>
      restoreRoomCheckpoint({
        targetRoomId,
        checkpointId,
        actorId,
        scope: request.body?.scope ?? {}
      })
    );
  });
}
