import { query } from "../db.js";
import { transactionWithEvents } from "../transaction-events.js";
import { requireActor } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import { logHostAction } from "../audit-log.js";
import { requireHostMembership, requireRoomPlayer } from "./content-platform-room-access.js";
import { listRoomVotes } from "./content-platform-vote-helpers.js";
import {
  createRoomVoteSchema, roomIdParams, submitVoteBallotSchema,
  updateRoomVoteStatusSchema
} from "./schemas.js";

async function insertVoteOptions(client, voteId, options) {
  if (!options.length) return;
  const values = [];
  const placeholders = options.map((option, index) => {
    const offset = index * 6;
    values.push(
      voteId, option.roleSlotId ?? null, option.label, option.description ?? "",
      option.sequence ?? index + 1, JSON.stringify(option.metadata ?? {})
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}::jsonb)`;
  });
  await client.query(
    `INSERT INTO room_vote_options (vote_id, role_slot_id, label, description, sequence, metadata)
     VALUES ${placeholders.join(", ")}`,
    values
  );
}

export async function registerContentPlatformVoteRoutes(app) {
  app.get("/api/rooms/:roomId/votes", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomPlayer(actorId, roomId);
    return { votes: await listRoomVotes(query, roomId, { roleSlotId: membership.role_slot_id }) };
  });

  app.post("/api/rooms/:roomId/votes/:voteId/ballots", { schema: submitVoteBallotSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, voteId } = request.params;
    const membership = await requireRoomPlayer(actorId, roomId);
    const body = request.body ?? {};
    const vote = await query(`SELECT status FROM room_votes WHERE id = $1 AND room_id = $2`, [voteId, roomId]);
    if (!vote.rowCount) return sendErr(reply, "NOT_FOUND", "Vote not found");
    if (vote.rows[0].status !== "open") return sendErr(reply, "BAD_REQUEST", "Vote is not open");
    if (body.optionId) {
      const option = await query(`SELECT 1 FROM room_vote_options WHERE id = $1 AND vote_id = $2`, [body.optionId, voteId]);
      if (!option.rowCount) return sendErr(reply, "BAD_REQUEST", "Vote option not found");
    }
    await transactionWithEvents(async (client, queueEvent) => {
      await client.query(
        `INSERT INTO room_vote_ballots (vote_id, room_id, role_slot_id, option_id, free_text, evidence, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
         ON CONFLICT (vote_id, role_slot_id)
         DO UPDATE SET option_id = EXCLUDED.option_id, free_text = EXCLUDED.free_text,
                       evidence = EXCLUDED.evidence, metadata = EXCLUDED.metadata, submitted_at = now()`,
        [voteId, roomId, membership.role_slot_id, body.optionId ?? null, body.freeText ?? "",
          JSON.stringify(body.evidence ?? []), JSON.stringify(body.metadata ?? {})]
      );
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'vote_ballot_submitted', '玩家提交了投票/指认', jsonb_build_object('voteId', $3::text, 'roleSlotId', $4::text))`,
        [roomId, actorId, voteId, membership.role_slot_id]
      );
      queueEvent(roomId, "room.vote_updated", { voteId, action: "ballot_submitted" });
    });
    return { ok: true };
  });

  app.get("/api/rooms/:roomId/host/votes", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return { votes: await listRoomVotes(query, roomId, { host: true }) };
  });

  app.post("/api/rooms/:roomId/host/votes", { schema: createRoomVoteSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const body = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    let vote;
    await transactionWithEvents(async (client, queueEvent) => {
      const result = await client.query(
        `INSERT INTO room_votes (room_id, segment_id, created_by_user_id, title, prompt, vote_type, visibility, settings)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) RETURNING *`,
        [roomId, body.segmentId ?? null, actorId, body.title, body.prompt ?? "",
          body.voteType ?? "accusation", body.visibility ?? "secret_until_published",
          JSON.stringify(body.settings ?? {})]
      );
      vote = result.rows[0];
      const options = body.options?.length
        ? body.options
        : (await client.query(
          `SELECT rs.id AS "roleSlotId", rs.name AS label, rs.sequence
           FROM rooms r JOIN role_slots rs ON rs.world_id = r.world_id
           WHERE r.id = $1 ORDER BY rs.sequence`, [roomId]
        )).rows;
      await insertVoteOptions(client, vote.id, options);
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'public', 'vote_created', $3, jsonb_build_object('voteId', $4::text))`,
        [roomId, actorId, `主持人开启投票/指认：「${body.title}」`, vote.id]
      );
      queueEvent(roomId, "room.vote_created", { voteId: vote.id, title: vote.title, status: vote.status });
    });
    await logHostAction({
      roomId, actorUserId: actorId, action: "vote_created", targetType: "vote", targetId: vote.id
    });
    return reply.code(201).send({ vote });
  });

  app.patch("/api/rooms/:roomId/host/votes/:voteId", { schema: updateRoomVoteStatusSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, voteId } = request.params;
    const { status } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    const result = await transactionWithEvents(async (client, queueEvent) => {
      const updated = await client.query(
        `UPDATE room_votes SET status = $3,
             closed_at = CASE WHEN $3 IN ('closed', 'published', 'cancelled') THEN COALESCE(closed_at, now()) ELSE closed_at END,
             published_at = CASE WHEN $3 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
             updated_at = now()
         WHERE id = $1 AND room_id = $2 RETURNING *`,
        [voteId, roomId, status]
      );
      if (!updated.rowCount) return null;
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'public', 'vote_status_updated', $3, jsonb_build_object('voteId', $4::text, 'status', $5::text))`,
        [roomId, actorId, `投票/指认状态更新为 ${status}`, voteId, status]
      );
      queueEvent(roomId, "room.vote_updated", { voteId, action: status });
      return updated.rows[0];
    });
    if (!result) return sendErr(reply, "NOT_FOUND", "Vote not found");
    return { vote: result };
  });
}
