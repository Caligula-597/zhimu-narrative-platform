import { query } from "../db.js";

export async function listPendingHostEvents(roomId) {
  const result = await query(
    `SELECT event.id, event.event_key, event.title, event.description,
            event.status, event.created_at, event.delay_until, event.rule_id, event.actions,
            COALESCE(frozen_rule.value->>'name', rule.name) AS rule_name,
            COALESCE(frozen_rule.value->'conditions', rule.conditions) AS rule_conditions,
            COALESCE(frozen_rule.value->>'mode', rule.mode::text) AS rule_mode
     FROM pending_host_events event
     JOIN rooms runtime_room ON runtime_room.id = event.room_id
     LEFT JOIN world_releases release ON release.id = runtime_room.release_id
     LEFT JOIN automation_rules rule ON rule.id = event.rule_id
     LEFT JOIN LATERAL (
       SELECT value
       FROM jsonb_array_elements(COALESCE(release.snapshot->'rules', '[]'::jsonb)) value
       WHERE value->>'id' = event.rule_id::text
       LIMIT 1
     ) frozen_rule ON true
     WHERE event.room_id = $1 AND event.status IN ('pending', 'delayed')
     ORDER BY CASE WHEN event.status = 'delayed' THEN 1 ELSE 0 END, event.created_at`,
    [roomId]
  );
  return result.rows;
}
