/** Volatile room session state used by the Player home screen. */
import { query } from "../db.js";
import { listPlayerInventory } from "../inventory-helpers.js";
import { fetchPlayerHostConfirmStatus } from "../routes/host-helpers.js";
import { fetchCurrentMiniGame } from "../room-mini-games.js";

const poolQuery = { query };

export async function loadPlayerHomeSession({ roomId, roleSlotId, actorId }) {
  const [snapshot, inventory, hostConfirm, currentGame] = await Promise.all([
    query(
      `SELECT
         COALESCE((
           SELECT jsonb_agg(to_jsonb(voice_row) - 'created_at' ORDER BY voice_row.created_at)
           FROM (
             SELECT vr.id, vr.name, vr.room_type, vr.status, vr.created_at
             FROM voice_rooms vr
             WHERE vr.room_id = $1
               AND vr.status = 'active'
               AND (vr.expires_at IS NULL OR vr.expires_at > now())
               AND (
                 vr.room_type = 'public' OR EXISTS (
                 SELECT 1 FROM voice_room_members vrm
                 WHERE vrm.voice_room_id = vr.id AND vrm.user_id = $3
               )
             )
           ) voice_row
         ), '[]'::jsonb) AS voice_rooms,
         COALESCE((
           SELECT jsonb_agg(to_jsonb(vote_row) - 'created_at' ORDER BY vote_row.created_at DESC)
           FROM (
             SELECT rv.id, rv.title, rv.prompt, rv.vote_type, rv.visibility, rv.status,
                    COALESCE(json_agg(jsonb_build_object(
                      'id', rvo.id, 'roleSlotId', rvo.role_slot_id, 'label', rvo.label,
                      'description', rvo.description, 'sequence', rvo.sequence
                    ) ORDER BY rvo.sequence) FILTER (WHERE rvo.id IS NOT NULL), '[]'::json) AS options,
                    MAX(rvb.submitted_at) AS submitted_at,
                    rv.created_at
             FROM room_votes rv
             LEFT JOIN room_vote_options rvo ON rvo.vote_id = rv.id
             LEFT JOIN room_vote_ballots rvb ON rvb.vote_id = rv.id AND rvb.role_slot_id = $2
             WHERE rv.room_id = $1 AND rv.status IN ('open', 'closed', 'published')
             GROUP BY rv.id
           ) vote_row
         ), '[]'::jsonb) AS active_votes,
         (SELECT to_jsonb(state_row)
          FROM (
            SELECT faction_key, public_alias, hidden_identity, variables, updated_at
            FROM room_role_states
            WHERE room_id = $1 AND role_slot_id = $2
          ) state_row) AS role_state`,
      [roomId, roleSlotId, actorId]
    ),
    listPlayerInventory(poolQuery, roomId, roleSlotId),
    fetchPlayerHostConfirmStatus(query, roomId, roleSlotId),
    fetchCurrentMiniGame(query, roomId)
  ]);

  const row = snapshot.rows[0] ?? {};
  return {
    voiceRooms: row.voice_rooms ?? [],
    inventory,
    hostConfirm,
    currentGame,
    activeVotes: row.active_votes ?? [],
    roleState: row.role_state ?? null
  };
}
