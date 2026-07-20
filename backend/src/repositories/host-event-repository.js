import { query } from "../db.js";

export async function listPendingHostEvents(roomId) {
  const result = await query(
    `SELECT event.id, event.event_key, event.title, event.description,
            event.status, event.created_at, event.delay_until, event.rule_id, event.actions,
            rule.name AS rule_name, rule.conditions AS rule_conditions, rule.mode AS rule_mode
     FROM pending_host_events event
     LEFT JOIN automation_rules rule ON rule.id = event.rule_id
     WHERE event.room_id = $1 AND event.status IN ('pending', 'delayed')
     ORDER BY CASE WHEN event.status = 'delayed' THEN 1 ELSE 0 END, event.created_at`,
    [roomId]
  );
  return result.rows;
}
