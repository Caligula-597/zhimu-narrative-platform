export function toVoteDto(row, { includeResults = false } = {}) {
  const vote = {
    id: row.id, roomId: row.room_id, segmentId: row.segment_id,
    title: row.title, prompt: row.prompt, voteType: row.vote_type,
    visibility: row.visibility, status: row.status, settings: row.settings ?? {},
    openedAt: row.opened_at, closedAt: row.closed_at,
    publishedAt: row.published_at, options: row.options ?? []
  };
  if (includeResults) vote.ballots = row.ballots ?? [];
  return vote;
}

export async function listRoomVotes(runQuery, roomId, { host = false, roleSlotId = null } = {}) {
  const result = await runQuery(
    `SELECT rv.*,
            COALESCE(json_agg(DISTINCT jsonb_build_object(
              'id', rvo.id, 'roleSlotId', rvo.role_slot_id, 'label', rvo.label,
              'description', rvo.description, 'sequence', rvo.sequence, 'metadata', rvo.metadata
            )) FILTER (WHERE rvo.id IS NOT NULL), '[]'::json) AS options,
            COALESCE(json_agg(DISTINCT jsonb_build_object(
              'id', rvb.id, 'roleSlotId', rvb.role_slot_id, 'optionId', rvb.option_id,
              'freeText', rvb.free_text, 'evidence', rvb.evidence, 'metadata', rvb.metadata,
              'submittedAt', rvb.submitted_at
            )) FILTER (WHERE rvb.id IS NOT NULL), '[]'::json) AS ballots
     FROM room_votes rv
     LEFT JOIN room_vote_options rvo ON rvo.vote_id = rv.id
     LEFT JOIN room_vote_ballots rvb ON rvb.vote_id = rv.id
       AND ($2::boolean OR rv.status = 'published' OR rv.visibility = 'public' OR rvb.role_slot_id = $3)
     WHERE rv.room_id = $1 AND ($2::boolean OR rv.status IN ('open', 'closed', 'published'))
     GROUP BY rv.id ORDER BY rv.created_at DESC`,
    [roomId, host, roleSlotId]
  );
  return result.rows.map((row) => toVoteDto(row, {
    includeResults: host || row.status === "published" || row.visibility === "public"
  }));
}
