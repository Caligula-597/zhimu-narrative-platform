/**
 * Player home payload loader — parallel pool queries to cut sequential round-trips.
 * Used by GET /api/rooms/:roomId/player-home.
 */
import { query } from "../db.js";
import { fetchPlayerClues } from "./clue-helpers.js";
import { enrichPlayerSectionsWithPages } from "../section-pages.js";
import { listPlayerInventory } from "../inventory-helpers.js";
import { fetchPlayerHostConfirmStatus } from "./host-helpers.js";
import { resolveCurrentActKey, fetchPlayerTasksForRoom } from "../player-tasks.js";
import { fetchPlayerSuspicions } from "../player-suspicions.js";
import { fetchMyTestimonies } from "../testimonies.js";
import { fetchCurrentMiniGame } from "../room-mini-games.js";

const poolQuery = { query };

/**
 * @param {{ roomId: string, roleSlotId: string, actorId: string }} args
 */
export async function loadPlayerHomePayload({ roomId, roleSlotId, actorId }) {
  const [
    roomInfo,
    role,
    sections,
    notes,
    clueBundle,
    voiceRooms,
    members,
    inventory,
    segments,
    hostConfirm,
    currentGame,
    suspicions,
    testimonies,
    activeVotes,
    privateActions,
    roleState
  ] = await Promise.all([
    query(`SELECT id, name, invite_code, status FROM rooms WHERE id = $1`, [roomId]),
    query(`SELECT id, name, public_profile, private_profile FROM role_slots WHERE id = $1`, [roleSlotId]),
    query(
      `SELECT ss.id, ss.title, ss.body, ss.sequence, ss.chapter_id, ss.metadata,
              rp.started_at, rp.completed_at,
              (rp.completed_at IS NOT NULL) AS completed
       FROM script_sections ss
       JOIN rooms room ON room.id = $1
       LEFT JOIN reading_progress rp
         ON rp.script_section_id = ss.id AND rp.room_id = $1 AND rp.role_slot_id = $2
       WHERE ss.role_slot_id = $2
         AND (
           ss.publication_status = 'published'
           OR (room.status = 'testing' AND ss.publication_status = 'testing')
         )
         AND (
           ss.sequence = 1 OR EXISTS (
             SELECT 1 FROM room_content_unlocks rcu
             WHERE rcu.room_id = $1 AND rcu.content_type = 'script_section' AND rcu.content_id = ss.id
           )
         )
       ORDER BY ss.sequence`,
      [roomId, roleSlotId]
    ),
    query(
      `SELECT id, source_type, source_id, title, body, created_at
       FROM notebook_entries
       WHERE room_id = $1 AND role_slot_id = $2
       ORDER BY created_at DESC`,
      [roomId, roleSlotId]
    ),
    fetchPlayerClues(query, roomId, roleSlotId),
    query(
      `SELECT vr.id, vr.name, vr.room_type, vr.status
       FROM voice_rooms vr
       WHERE vr.room_id = $1 AND (
         vr.room_type = 'public' OR EXISTS (
           SELECT 1 FROM voice_room_members vrm
           WHERE vrm.voice_room_id = vr.id AND vrm.user_id = $2
         )
       ) ORDER BY vr.created_at`,
      [roomId, actorId]
    ),
    query(
      `SELECT rs.id AS role_slot_id, rs.name AS role_name, rm.user_id, u.display_name,
              rm.member_type, (rm.user_id IS NOT NULL) AS online
       FROM rooms r
       JOIN role_slots rs ON rs.world_id = r.world_id
       LEFT JOIN room_members rm
         ON rm.room_id = r.id AND rm.role_slot_id = rs.id AND rm.status = 'active'
       LEFT JOIN users u ON u.id = rm.user_id
       WHERE r.id = $1
       ORDER BY rs.sequence`,
      [roomId]
    ),
    listPlayerInventory(poolQuery, roomId, roleSlotId),
    query(
      `SELECT ws.id, ws.segment_key, ws.title, ws.sequence, ws.chapter_id,
              ws.story->'playerTasks' AS player_tasks,
              ws.mechanics->'endCondition' AS end_condition,
              ws.operations->'playerTips' AS player_tips
       FROM world_segments ws
       JOIN rooms r ON r.world_id = ws.world_id
       WHERE r.id = $1
       ORDER BY ws.sequence, ws.created_at`,
      [roomId]
    ),
    fetchPlayerHostConfirmStatus(query, roomId, roleSlotId),
    fetchCurrentMiniGame(query, roomId),
    fetchPlayerSuspicions(query, roomId, roleSlotId),
    fetchMyTestimonies(query, roomId, roleSlotId),
    query(
      `SELECT rv.id, rv.title, rv.prompt, rv.vote_type, rv.visibility, rv.status,
              COALESCE(json_agg(jsonb_build_object(
                'id', rvo.id,
                'roleSlotId', rvo.role_slot_id,
                'label', rvo.label,
                'description', rvo.description,
                'sequence', rvo.sequence
              ) ORDER BY rvo.sequence) FILTER (WHERE rvo.id IS NOT NULL), '[]'::json) AS options,
              MAX(rvb.submitted_at) AS submitted_at
       FROM room_votes rv
       LEFT JOIN room_vote_options rvo ON rvo.vote_id = rv.id
       LEFT JOIN room_vote_ballots rvb ON rvb.vote_id = rv.id AND rvb.role_slot_id = $2
       WHERE rv.room_id = $1 AND rv.status IN ('open', 'closed', 'published')
       GROUP BY rv.id
       ORDER BY rv.created_at DESC`,
      [roomId, roleSlotId]
    ),
    query(
      `SELECT id, segment_id, target_role_slot_id, action_type, title, body, payload,
              status, host_response, visibility, created_at, updated_at
       FROM room_private_actions
       WHERE room_id = $1 AND (
         actor_role_slot_id = $2
         OR (visibility = 'actor_target_host' AND target_role_slot_id = $2)
       )
       ORDER BY created_at DESC
       LIMIT 50`,
      [roomId, roleSlotId]
    ),
    query(
      `SELECT faction_key, public_alias, hidden_identity, variables, updated_at
       FROM room_role_states
       WHERE room_id = $1 AND role_slot_id = $2`,
      [roomId, roleSlotId]
    )
  ]);

  const enrichedSections = await enrichPlayerSectionsWithPages(poolQuery, sections.rows);
  const currentActKey = resolveCurrentActKey(enrichedSections, segments.rows);
  const tasks = await fetchPlayerTasksForRoom(query, roomId, roleSlotId, currentActKey);

  return {
    room: roomInfo.rows[0],
    role: role.rows[0],
    sections: enrichedSections,
    notes: notes.rows,
    clues: clueBundle.owned,
    sharedClues: clueBundle.shared,
    voiceRooms: voiceRooms.rows,
    roomMembers: members.rows,
    inventory,
    hostConfirm,
    currentGame,
    currentActKey,
    tasks,
    suspicions,
    testimonies,
    activeVotes: activeVotes.rows,
    privateActions: privateActions.rows,
    roleState: roleState.rows[0] ?? null,
    segments: segments.rows
  };
}
