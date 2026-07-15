import { query } from "../db.js";

export function toVoteDto(row, { includeResults = false } = {}) {
  const vote = {
    id: row.id,
    roomId: row.room_id,
    segmentId: row.segment_id,
    title: row.title,
    prompt: row.prompt,
    voteType: row.vote_type,
    visibility: row.visibility,
    status: row.status,
    settings: row.settings ?? {},
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    publishedAt: row.published_at,
    options: row.options ?? []
  };
  if (includeResults) vote.ballots = row.ballots ?? [];
  return vote;
}

export async function listRoomVotesWith(runQuery, roomId, { host = false, roleSlotId = null } = {}) {
  const result = await runQuery(
    `SELECT rv.*,
            COALESCE(options.items, '[]'::json) AS options,
            COALESCE(ballots.items, '[]'::json) AS ballots
     FROM room_votes rv
     LEFT JOIN LATERAL (
       SELECT json_agg(jsonb_build_object(
         'id', rvo.id, 'roleSlotId', rvo.role_slot_id, 'label', rvo.label,
         'description', rvo.description, 'sequence', rvo.sequence, 'metadata', rvo.metadata
       ) ORDER BY rvo.sequence, rvo.id) AS items
       FROM room_vote_options rvo WHERE rvo.vote_id = rv.id
     ) options ON true
     LEFT JOIN LATERAL (
       SELECT json_agg(jsonb_build_object(
         'id', rvb.id, 'roleSlotId', rvb.role_slot_id, 'optionId', rvb.option_id,
         'freeText', rvb.free_text, 'evidence', rvb.evidence, 'metadata', rvb.metadata,
         'submittedAt', rvb.submitted_at
       ) ORDER BY rvb.submitted_at, rvb.id) AS items
       FROM room_vote_ballots rvb
       WHERE rvb.vote_id = rv.id
         AND ($2::boolean OR rv.status = 'published' OR rv.visibility = 'public' OR rvb.role_slot_id = $3)
     ) ballots ON true
     WHERE rv.room_id = $1 AND ($2::boolean OR rv.status IN ('open', 'closed', 'published'))
     ORDER BY rv.created_at DESC`,
    [roomId, host, roleSlotId]
  );
  return result.rows.map((row) => toVoteDto(row, {
    includeResults: host || row.status === "published" || row.visibility === "public"
  }));
}

export function listRoomVotes(roomId, options) {
  return listRoomVotesWith(query, roomId, options);
}

export async function lockVote(client, roomId, voteId) {
  const result = await client.query(
    `SELECT id, status FROM room_votes WHERE id = $1 AND room_id = $2 FOR UPDATE`,
    [voteId, roomId]
  );
  return result.rows[0] ?? null;
}

export async function voteOptionExists(client, voteId, optionId) {
  if (!optionId) return true;
  const result = await client.query(
    `SELECT 1 FROM room_vote_options WHERE id = $1 AND vote_id = $2`,
    [optionId, voteId]
  );
  return result.rowCount > 0;
}

export function upsertVoteBallot(client, { voteId, roomId, roleSlotId, body }) {
  return client.query(
    `INSERT INTO room_vote_ballots (vote_id, room_id, role_slot_id, option_id, free_text, evidence, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     ON CONFLICT (vote_id, role_slot_id)
     DO UPDATE SET option_id = EXCLUDED.option_id, free_text = EXCLUDED.free_text,
                   evidence = EXCLUDED.evidence, metadata = EXCLUDED.metadata, submitted_at = now()`,
    [
      voteId,
      roomId,
      roleSlotId,
      body.optionId ?? null,
      body.freeText ?? "",
      JSON.stringify(body.evidence ?? []),
      JSON.stringify(body.metadata ?? {})
    ]
  );
}

export function insertVoteTimeline(client, { roomId, actorId, visibility, eventType, message, metadata }) {
  return client.query(
    `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [roomId, actorId, visibility, eventType, message, JSON.stringify(metadata)]
  );
}

export async function createVote(client, { roomId, actorId, body }) {
  const result = await client.query(
    `INSERT INTO room_votes (room_id, segment_id, created_by_user_id, title, prompt, vote_type, visibility, settings)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) RETURNING *`,
    [
      roomId,
      body.segmentId ?? null,
      actorId,
      body.title,
      body.prompt ?? "",
      body.voteType ?? "accusation",
      body.visibility ?? "secret_until_published",
      JSON.stringify(body.settings ?? {})
    ]
  );
  return result.rows[0];
}

export async function defaultVoteOptions(client, roomId) {
  const result = await client.query(
    `SELECT rs.id AS "roleSlotId", rs.name AS label, rs.sequence
     FROM rooms r JOIN role_slots rs ON rs.world_id = r.world_id
     WHERE r.id = $1 ORDER BY rs.sequence`,
    [roomId]
  );
  return result.rows;
}

export async function insertVoteOptions(client, voteId, options) {
  if (!options.length) return;
  const values = [];
  const placeholders = options.map((option, index) => {
    const offset = index * 6;
    values.push(
      voteId,
      option.roleSlotId ?? null,
      option.label,
      option.description ?? "",
      option.sequence ?? index + 1,
      JSON.stringify(option.metadata ?? {})
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}::jsonb)`;
  });
  await client.query(
    `INSERT INTO room_vote_options (vote_id, role_slot_id, label, description, sequence, metadata)
     VALUES ${placeholders.join(", ")}`,
    values
  );
}

export async function updateVoteStatus(client, roomId, voteId, status) {
  const result = await client.query(
    `UPDATE room_votes SET status = $3,
         closed_at = CASE WHEN $3 IN ('closed', 'published', 'cancelled') THEN COALESCE(closed_at, now()) ELSE closed_at END,
         published_at = CASE WHEN $3 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
         updated_at = now()
     WHERE id = $1 AND room_id = $2 RETURNING *`,
    [voteId, roomId, status]
  );
  return result.rows[0] ?? null;
}
