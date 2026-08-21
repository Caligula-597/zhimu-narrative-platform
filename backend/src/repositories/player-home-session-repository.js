/** Volatile room session state used by the Player home screen. */
import { query } from "../db.js";
import { extractTriggerPlayers } from "../routes/host-helpers.js";
import { publicMiniGame } from "../room-mini-games.js";

export function summarizePlayerHostConfirm(rows, roleSlotId) {
  let waitingForYou = false;
  const titles = [];
  for (const row of rows) {
    titles.push(row.title);
    const triggers = extractTriggerPlayers(row.rule_conditions);
    if (!triggers.length || triggers.includes(roleSlotId)) waitingForYou = true;
  }
  return {
    pendingCount: rows.length,
    waitingForYou,
    titles: titles.slice(0, 3)
  };
}

export async function loadPlayerHomeSession({ roomId, roleSlotId, actorId, runQuery = query }) {
  const snapshot = await runQuery(
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
                 vr.room_type = 'public' OR (
                   EXISTS (
                     SELECT 1 FROM rooms voice_runtime_room
                     WHERE voice_runtime_room.id = vr.room_id
                       AND voice_runtime_room.started_at IS NOT NULL
                       AND voice_runtime_room.status NOT IN ('completed', 'archived')
                   )
                   AND EXISTS (
                     SELECT 1 FROM voice_room_members vrm
                     WHERE vrm.voice_room_id = vr.id AND vrm.user_id = $3
                   )
                 )
               )
             ) voice_row
         ), '[]'::jsonb) AS voice_rooms,
         (SELECT jsonb_build_object(
            'mainRoomId', (
              SELECT public_voice.id
              FROM voice_rooms public_voice
              WHERE public_voice.room_id = runtime_room.id
                AND public_voice.room_type = 'public'
                AND public_voice.status = 'active'
              ORDER BY public_voice.created_at
              LIMIT 1
            ),
            'privateRoomsEnabled', runtime_room.started_at IS NOT NULL
              AND runtime_room.status NOT IN ('completed', 'archived'),
            'startedAt', runtime_room.started_at,
            'roomStatus', runtime_room.status
          )
          FROM rooms runtime_room
          WHERE runtime_room.id = $1) AS voice_policy,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'user_id', member.user_id,
             'member_type', member.member_type,
             'role_slot_id', member.role_slot_id,
             'role_name', role_slot.name,
             'display_name', COALESCE((
               SELECT profile.display_name
               FROM user_portal_profiles profile
               WHERE profile.user_id = member.user_id
                 AND profile.portal = CASE
                   WHEN member.member_type IN ('host', 'cohost') THEN 'host'
                   ELSE 'player'
                 END
               LIMIT 1
             ), member_user.display_name)
           ) ORDER BY
             CASE WHEN member.member_type IN ('host', 'cohost') THEN 0 ELSE 1 END,
             member.joined_at)
           FROM room_members member
           JOIN users member_user ON member_user.id = member.user_id
           LEFT JOIN role_slots role_slot ON role_slot.id = member.role_slot_id
           WHERE member.room_id = $1 AND member.status = 'active'
         ), '[]'::jsonb) AS voice_roster,
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
          ) state_row) AS role_state,
         COALESCE((
           SELECT jsonb_agg(to_jsonb(inventory_row) ORDER BY inventory_row.name)
           FROM (
             SELECT i.id AS item_id, i.name, i.public_text,
                    jsonb_build_object(
                      'unique', COALESCE(i.metadata->>'unique', 'false') = 'true',
                      'consumable', COALESCE(i.metadata->>'consumable', 'false') = 'true',
                      'itemActions', COALESCE(i.metadata->'itemActions', '[]'::jsonb)
                    ) AS metadata,
                    inv.quantity, inv.metadata AS inventory_metadata
             FROM inventory inv
             JOIN items i ON i.id = inv.item_id
             WHERE inv.room_id = $1 AND inv.role_slot_id = $2 AND inv.quantity > 0
           ) inventory_row
         ), '[]'::jsonb) AS inventory,
         COALESCE((
           SELECT jsonb_agg(
             jsonb_build_object(
               'title', phe.title,
               'rule_conditions', COALESCE(frozen_rule.value->'conditions', ar.conditions)
             )
             ORDER BY phe.created_at
           )
           FROM pending_host_events phe
           JOIN rooms runtime_room ON runtime_room.id = phe.room_id
           LEFT JOIN world_releases release ON release.id = runtime_room.release_id
           LEFT JOIN automation_rules ar ON ar.id = phe.rule_id
           LEFT JOIN LATERAL (
             SELECT value
             FROM jsonb_array_elements(COALESCE(release.snapshot->'rules', '[]'::jsonb)) value
             WHERE value->>'id' = phe.rule_id::text
             LIMIT 1
           ) frozen_rule ON true
           WHERE phe.room_id = $1 AND phe.status = 'pending'
         ), '[]'::jsonb) AS pending_host_events,
         (SELECT to_jsonb(game_row)
          FROM (
            SELECT *
            FROM room_mini_games
            WHERE room_id = $1
            ORDER BY updated_at DESC
            LIMIT 1
          ) game_row) AS current_game`,
    [roomId, roleSlotId, actorId]
  );

  const row = snapshot.rows[0] ?? {};
  return {
    voiceRooms: row.voice_rooms ?? [],
    voicePolicy: row.voice_policy ?? {
      mainRoomId: null,
      privateRoomsEnabled: false,
      startedAt: null,
      roomStatus: null
    },
    voiceRoster: row.voice_roster ?? [],
    inventory: row.inventory ?? [],
    hostConfirm: summarizePlayerHostConfirm(row.pending_host_events ?? [], roleSlotId),
    currentGame: publicMiniGame(row.current_game),
    activeVotes: row.active_votes ?? [],
    roleState: row.role_state ?? null
  };
}
