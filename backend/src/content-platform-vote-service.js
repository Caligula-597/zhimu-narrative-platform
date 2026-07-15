import { throwErr } from "./api-errors.js";
import { logHostAction } from "./audit-log.js";
import { transactionWithEvents } from "./transaction-events.js";
import {
  createVote,
  defaultVoteOptions,
  insertVoteOptions,
  insertVoteTimeline,
  listRoomVotes,
  lockVote,
  updateVoteStatus,
  upsertVoteBallot,
  voteOptionExists
} from "./repositories/content-platform-vote-repository.js";

export function getRoomVotes(roomId, options) {
  return listRoomVotes(roomId, options);
}

export async function submitRoomVoteBallot({ actorId, roomId, voteId, roleSlotId, body }) {
  await transactionWithEvents(async (client, queueEvent) => {
    const vote = await lockVote(client, roomId, voteId);
    if (!vote) throwErr("NOT_FOUND", "Vote not found");
    if (vote.status !== "open") throwErr("BAD_REQUEST", "Vote is not open");
    if (!(await voteOptionExists(client, voteId, body.optionId))) {
      throwErr("BAD_REQUEST", "Vote option not found");
    }
    await upsertVoteBallot(client, { voteId, roomId, roleSlotId, body });
    await insertVoteTimeline(client, {
      roomId,
      actorId,
      visibility: "host",
      eventType: "vote_ballot_submitted",
      message: "玩家提交了投票/指认",
      metadata: { voteId, roleSlotId }
    });
    queueEvent(roomId, "room.vote_updated", { voteId, action: "ballot_submitted" });
  });
  return { ok: true };
}

export async function createRoomVote({ actorId, roomId, body }) {
  const vote = await transactionWithEvents(async (client, queueEvent) => {
    const created = await createVote(client, { roomId, actorId, body });
    const options = body.options?.length ? body.options : await defaultVoteOptions(client, roomId);
    await insertVoteOptions(client, created.id, options);
    await insertVoteTimeline(client, {
      roomId,
      actorId,
      visibility: "public",
      eventType: "vote_created",
      message: `主持人开启投票/指认：「${body.title}」`,
      metadata: { voteId: created.id }
    });
    queueEvent(roomId, "room.vote_created", {
      voteId: created.id,
      title: created.title,
      status: created.status
    });
    return created;
  });
  await logHostAction({
    roomId,
    actorUserId: actorId,
    action: "vote_created",
    targetType: "vote",
    targetId: vote.id
  });
  return vote;
}

export async function setRoomVoteStatus({ actorId, roomId, voteId, status }) {
  return transactionWithEvents(async (client, queueEvent) => {
    const updated = await updateVoteStatus(client, roomId, voteId, status);
    if (!updated) throwErr("NOT_FOUND", "Vote not found");
    await insertVoteTimeline(client, {
      roomId,
      actorId,
      visibility: "public",
      eventType: "vote_status_updated",
      message: `投票/指认状态更新为 ${status}`,
      metadata: { voteId, status }
    });
    queueEvent(roomId, "room.vote_updated", { voteId, action: status });
    return updated;
  });
}
