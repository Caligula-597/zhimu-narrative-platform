import { query } from "../db.js";

const PREFERENCE_KIND = "recap_library";
const PREFERENCE_SCOPE = "player_library";

function filters({ worldId = null, roleSlotId = null } = {}) {
  return [worldId, roleSlotId];
}

export async function listAccountRecapRows({ actorId, worldId = null, roleSlotId = null, limit = 100 }) {
  const [filteredWorldId, filteredRoleSlotId] = filters({ worldId, roleSlotId });
  const result = await query(
    `SELECT rr.id, rr.room_id, rr.label,
            rr.snapshot->>'description' AS description,
            rr.snapshot->'stats' AS stats,
            rr.created_at,
            room.name AS room_name,
            world.id AS world_id,
            world.name AS world_name,
            member.role_slot_id,
            role_slot.name AS role_name,
            COALESCE((preference.payload->>'retentionDays')::int, 0) AS retention_days
     FROM room_recaps rr
     JOIN rooms room ON room.id = rr.room_id
     JOIN worlds world ON world.id = room.world_id
     JOIN room_members member
       ON member.room_id = room.id
      AND member.user_id = $1
      AND member.status = 'active'
     LEFT JOIN role_slots role_slot ON role_slot.id = member.role_slot_id
     LEFT JOIN room_experience_states preference
       ON preference.room_id = room.id
      AND preference.state_kind = '${PREFERENCE_KIND}'
      AND preference.scope_key = '${PREFERENCE_SCOPE}'
      AND preference.subject_key = $1::text
     WHERE ($2::uuid IS NULL OR world.id = $2)
       AND ($3::uuid IS NULL OR member.role_slot_id = $3)
       AND NOT (COALESCE(preference.payload->'hiddenRecapIds', '[]'::jsonb) ? rr.id::text)
       AND (
         COALESCE((preference.payload->>'retentionDays')::int, 0) = 0
         OR rr.created_at >= now() - make_interval(days => (preference.payload->>'retentionDays')::int)
       )
     ORDER BY rr.created_at DESC, rr.id DESC
     LIMIT $4`,
    [actorId, filteredWorldId, filteredRoleSlotId, limit],
  );
  return result.rows;
}

export async function findAccountRecapContext({ actorId, recapId, includeHidden = false, client = null, forUpdate = false }) {
  const run = client?.query ? client.query.bind(client) : query;
  const result = await run(
    `SELECT rr.id, rr.room_id, rr.label, rr.snapshot, rr.created_at,
            room.name AS room_name, room.world_id,
            world.name AS world_name,
            member.role_slot_id, member.member_type,
            role_slot.name AS role_name,
            COALESCE((preference.payload->>'retentionDays')::int, 0) AS retention_days,
            COALESCE(preference.payload->'hiddenRecapIds', '[]'::jsonb) AS hidden_recap_ids
     FROM room_recaps rr
     JOIN rooms room ON room.id = rr.room_id
     JOIN worlds world ON world.id = room.world_id
     JOIN room_members member
       ON member.room_id = room.id
      AND member.user_id = $2
      AND member.status = 'active'
     LEFT JOIN role_slots role_slot ON role_slot.id = member.role_slot_id
     LEFT JOIN room_experience_states preference
       ON preference.room_id = room.id
      AND preference.state_kind = '${PREFERENCE_KIND}'
      AND preference.scope_key = '${PREFERENCE_SCOPE}'
      AND preference.subject_key = $2::text
     WHERE rr.id = $1
       AND ($3::boolean OR NOT (COALESCE(preference.payload->'hiddenRecapIds', '[]'::jsonb) ? rr.id::text))
       AND (
         $3::boolean
         OR COALESCE((preference.payload->>'retentionDays')::int, 0) = 0
         OR rr.created_at >= now() - make_interval(days => (preference.payload->>'retentionDays')::int)
       )
     ${forUpdate ? "FOR UPDATE OF member" : ""}`,
    [recapId, actorId, includeHidden],
  );
  return result.rows[0] ?? null;
}
