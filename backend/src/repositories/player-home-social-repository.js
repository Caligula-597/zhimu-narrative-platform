/** Player-owned notes, clues, social presence, deductions and private actions. */
import { query } from "../db.js";

export async function loadPlayerHomeSocial({ roomId, roleSlotId, runQuery = query }) {
  const snapshot = await runQuery(
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
             SELECT rs.id AS role_slot_id, rs.name AS role_name, rm.user_id,
                    COALESCE((
                      SELECT profile.display_name FROM user_portal_profiles profile
                      WHERE profile.user_id = u.id AND profile.portal = 'player'
                    ), u.display_name) AS display_name,
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
         ), '[]'::jsonb) AS private_actions,
         COALESCE((
           SELECT jsonb_agg(to_jsonb(owned_row) ORDER BY owned_row.acquired_at DESC)
           FROM (
             SELECT c.id, c.name, c.public_text, co.acquired_at, co.read_at,
                    co.shared_with_room, co.shared_with_roles, co.player_note, co.shared_at,
                    true AS is_owner, co.role_slot_id AS owner_role_slot_id,
                    rs.name AS owner_role_name, COALESCE((
                      SELECT profile.display_name FROM user_portal_profiles profile
                      WHERE profile.user_id = u.id AND profile.portal = 'player'
                    ), u.display_name) AS owner_player_name
             FROM clue_ownership co
             JOIN clues c ON c.id = co.clue_id
             JOIN role_slots rs ON rs.id = co.role_slot_id
             LEFT JOIN room_members rm
               ON rm.room_id = co.room_id AND rm.role_slot_id = co.role_slot_id AND rm.status = 'active'
             LEFT JOIN users u ON u.id = rm.user_id
             WHERE co.room_id = $1 AND co.role_slot_id = $2
           ) owned_row
         ), '[]'::jsonb) AS owned_clues,
         COALESCE((
           SELECT jsonb_agg(
             to_jsonb(shared_row)
             ORDER BY shared_row.shared_at DESC NULLS LAST, shared_row.acquired_at DESC
           )
           FROM (
             SELECT c.id, c.name, c.public_text, co.acquired_at, co.shared_at,
                    co.player_note, co.shared_with_room, co.shared_with_roles,
                    false AS is_owner, co.role_slot_id AS owner_role_slot_id,
                    rs.name AS owner_role_name, COALESCE((
                      SELECT profile.display_name FROM user_portal_profiles profile
                      WHERE profile.user_id = u.id AND profile.portal = 'player'
                    ), u.display_name) AS owner_player_name,
                    CASE WHEN co.shared_with_room THEN 'room' ELSE 'roles' END AS shared_scope,
                    EXISTS (
                      SELECT 1 FROM clue_read_receipts crr
                      WHERE crr.room_id = $1 AND crr.clue_id = c.id AND crr.role_slot_id = $2
                    ) AS read_by_me,
                    (SELECT crr.read_at FROM clue_read_receipts crr
                     WHERE crr.room_id = $1 AND crr.clue_id = c.id AND crr.role_slot_id = $2
                     LIMIT 1) AS read_at
             FROM clue_ownership co
             JOIN clues c ON c.id = co.clue_id
             JOIN role_slots rs ON rs.id = co.role_slot_id
             LEFT JOIN room_members rm
               ON rm.room_id = co.room_id AND rm.role_slot_id = co.role_slot_id AND rm.status = 'active'
             LEFT JOIN users u ON u.id = rm.user_id
             WHERE co.room_id = $1
               AND co.role_slot_id <> $2
               AND (
                 co.shared_with_room = true
                 OR $2::uuid = ANY(COALESCE(co.shared_with_roles, '{}'))
               )
           ) shared_row
         ), '[]'::jsonb) AS shared_clues,
         COALESCE((
           SELECT jsonb_agg(
             to_jsonb(suspicion_row) - 'sequence'
             ORDER BY suspicion_row.level DESC, suspicion_row.sequence
           )
           FROM (
             SELECT ps.id, ps.target_role_slot_id, rs.name AS target_role_name,
                    ps.level, ps.reason, ps.updated_at, rs.sequence
             FROM player_suspicions ps
             JOIN role_slots rs ON rs.id = ps.target_role_slot_id
             WHERE ps.room_id = $1 AND ps.observer_role_slot_id = $2
           ) suspicion_row
         ), '[]'::jsonb) AS suspicions,
         COALESCE((
           SELECT jsonb_agg(to_jsonb(testimony_row) ORDER BY testimony_row.submitted_at DESC)
           FROM (
             SELECT id, act_key, body, host_flag, host_note, submitted_at, reviewed_at
             FROM testimonies
             WHERE room_id = $1 AND role_slot_id = $2
           ) testimony_row
         ), '[]'::jsonb) AS testimonies`,
    [roomId, roleSlotId]
  );

  const row = snapshot.rows[0] ?? {};
  return {
    notes: row.notes ?? [],
    clues: row.owned_clues ?? [],
    sharedClues: row.shared_clues ?? [],
    roomMembers: row.members ?? [],
    suspicions: row.suspicions ?? [],
    testimonies: row.testimonies ?? [],
    privateActions: row.private_actions ?? []
  };
}
