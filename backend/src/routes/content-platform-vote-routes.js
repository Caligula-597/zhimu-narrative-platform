import { requireActor } from "../request-actor.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import {
  createRoomVote,
  getRoomVotes,
  setRoomVoteStatus,
  submitRoomVoteBallot
} from "../content-platform-vote-service.js";
import { requireHostMembership, requireRoomPlayer } from "./content-platform-room-access.js";
import {
  createRoomVoteSchema,
  roomIdParams,
  submitVoteBallotSchema,
  updateRoomVoteStatusSchema
} from "./schemas.js";

export async function registerContentPlatformVoteRoutes(app) {
  app.get("/api/rooms/:roomId/votes", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomPlayer(actorId, roomId);
    return {
      votes: await getRoomVotes(roomId, { roleSlotId: membership.role_slot_id })
    };
  });

  app.post("/api/rooms/:roomId/votes/:voteId/ballots", { schema: submitVoteBallotSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, voteId } = request.params;
    const membership = await requireRoomPlayer(actorId, roomId);
    return submitRoomVoteBallot({
      actorId,
      roomId,
      voteId,
      roleSlotId: membership.role_slot_id,
      body: request.body ?? {}
    });
  });

  app.get("/api/rooms/:roomId/host/votes", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return { votes: await getRoomVotes(roomId, { host: true }) };
  });

  app.post("/api/rooms/:roomId/host/votes", { schema: createRoomVoteSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const result = await withRoomIdempotency(roomId, request, "host.vote_create", async () => ({
      vote: await createRoomVote({ actorId, roomId, body: request.body ?? {} })
    }));
    return reply.code(201).send(result);
  });

  app.patch("/api/rooms/:roomId/host/votes/:voteId", { schema: updateRoomVoteStatusSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, voteId } = request.params;
    await requireHostMembership(actorId, roomId);
    const vote = await setRoomVoteStatus({
      actorId,
      roomId,
      voteId,
      status: request.body?.status
    });
    return { vote };
  });
}
