/** Player-owned notes, clues, social presence, deductions and private actions. */
import { query } from "../db.js";
import { fetchPlayerClues } from "../routes/clue-helpers.js";
import { fetchPlayerSuspicions } from "../player-suspicions.js";
import { fetchMyTestimonies } from "../testimonies.js";

export async function loadPlayerHomeSocial({ roomId, roleSlotId }) {
  const [snapshot, clueBundle, suspicions, testimonies] = await Promise.all([
    query(
      `SELECT
         COALESCE((
           SELECT jsonb_agg(to_jsonb(note_row) ORDER BY note_row.created_at DESC)
           FROM (
             SELECT id, source_type, source_id, title, body, created_at
             FROM notebook_entries
             WHERE room_id = $1 AND role_slot_id = $2
           ) note_row
         ), '[]'::jsonb) AS notes,
         COALESCE((
           SELECT jsonb_agg(to_jsonb(member_row) - 'sequence' ORDER BY member_row.sequence)
           FROM (
             SELECT rs.id AS role_slot_id, rs.name AS role_name, rm.user_id, u.display_name,
                    rm.member_type, (rm.user_id IS NOT NULL) AS online, rs.sequence
             FROM rooms r
             JOIN role_slots rs ON rs.world_id = r.world_id
             LEFT JOIN room_members rm
               ON rm.room_id = r.id AND rm.role_slot_id = rs.id AND rm.status = 'active'
             LEFT JOIN users u ON u.id = rm.user_id
             WHERE r.id = $1
           ) member_row
         ), '[]'::jsonb) AS members,
         COALESCE((
           SELECT jsonb_agg(to_jsonb(action_row) ORDER BY action_row.created_at DESC)
           FROM (
             SELECT id, segment_id, target_role_slot_id, action_type, title, body, payload,
                    status, host_response, visibility, created_at, updated_at
             FROM room_private_actions
             WHERE room_id = $1 AND (
               actor_role_slot_id = $2
               OR (visibility = 'actor_target_host' AND target_role_slot_id = $2)
             )
             ORDER BY created_at DESC
             LIMIT 50
           ) action_row
         ), '[]'::jsonb) AS private_actions`,
      [roomId, roleSlotId]
    ),
    fetchPlayerClues(query, roomId, roleSlotId),
    fetchPlayerSuspicions(query, roomId, roleSlotId),
    fetchMyTestimonies(query, roomId, roleSlotId)
  ]);

  const row = snapshot.rows[0] ?? {};
  return {
    notes: row.notes ?? [],
    clues: clueBundle.owned,
    sharedClues: clueBundle.shared,
    roomMembers: row.members ?? [],
    suspicions,
    testimonies,
    privateActions: row.private_actions ?? []
  };
}
