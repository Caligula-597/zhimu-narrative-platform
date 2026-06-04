import { query } from "../db.js";
import { transactionWithEvents } from "../transaction-events.js";
import { executeActionsWithClient, queueRuleActionEvents } from "../rule-engine.js";
import { publishRoomEvent } from "../room-event-bus.js";

export async function dismissHostEventById(roomId, actorId, eventId) {
  const event = await query(
    `SELECT id, title FROM pending_host_events
     WHERE id = $1 AND room_id = $2 AND status IN ('pending', 'delayed')`,
    [eventId, roomId]
  );
  if (!event.rowCount) return { ok: false, code: "HOST_EVENT_NOT_FOUND" };

  await query(
    `UPDATE pending_host_events
     SET status = 'dismissed', resolved_at = now(), resolved_by_user_id = $1
     WHERE id = $2`,
    [actorId, eventId]
  );
  await query(
    `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
     VALUES ($1, $2, 'host', 'host_event_dismissed', $3, jsonb_build_object('eventId', $4::text))`,
    [roomId, actorId, `主持人拒绝待确认事件「${event.rows[0].title}」`, eventId]
  );
  await publishRoomEvent(roomId, "room.host_event_pending", { action: "dismissed", eventId });
  return { ok: true };
}

export async function executeHostEventById(roomId, actorId, eventId) {
  const event = await query(
    `SELECT * FROM pending_host_events WHERE id = $1 AND room_id = $2 AND status IN ('pending', 'delayed')`,
    [eventId, roomId]
  );
  if (!event.rowCount) return { ok: false, code: "HOST_EVENT_NOT_FOUND" };

  await transactionWithEvents(async (client, queueEvent) => {
    for (const action of event.rows[0].actions ?? []) {
      await executeActionsWithClient(client, roomId, action.type ? [action] : []);
    }
    await client.query(
      `UPDATE pending_host_events
       SET status = 'executed', resolved_at = now(), resolved_by_user_id = $1
       WHERE id = $2`,
      [actorId, eventId]
    );
    await client.query(
      `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
       VALUES ($1, $2, 'host', 'host_event_executed', $3, jsonb_build_object('eventId', $4::text))`,
      [roomId, actorId, `主持人确认并执行「${event.rows[0].title}」`, eventId]
    );
    if (event.rows[0].rule_id) {
      await client.query(
        `INSERT INTO rule_executions (rule_id, room_id, result)
         VALUES ($1, $2, '{"status":"host_confirmed"}'::jsonb)
         ON CONFLICT (rule_id, room_id) DO NOTHING`,
        [event.rows[0].rule_id, roomId]
      );
    }
    queueRuleActionEvents(queueEvent, roomId, event.rows[0].actions ?? [], "host_event");
    queueEvent(roomId, "room.host_event_pending", { action: "executed", eventId });
  });
  return { ok: true };
}

export async function batchHostEvents(roomId, actorId, action, eventIds) {
  const uniqueIds = [...new Set((eventIds ?? []).filter(Boolean))].slice(0, 50);
  if (!uniqueIds.length) return { ok: false, code: "BAD_REQUEST", message: "请至少选择一条待确认事件。" };

  const handler = action === "execute" ? executeHostEventById : dismissHostEventById;
  const results = [];
  for (const eventId of uniqueIds) {
    const outcome = await handler(roomId, actorId, eventId);
    if (outcome.ok) {
      results.push({ eventId, status: "ok" });
    } else {
      results.push({ eventId, status: "skipped", code: outcome.code || "HOST_EVENT_NOT_FOUND" });
    }
  }
  const processed = results.filter((row) => row.status === "ok").length;
  return { ok: true, action, processed, skipped: results.length - processed, results };
}
