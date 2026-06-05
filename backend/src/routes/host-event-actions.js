import { query } from "../db.js";
import { transactionWithEvents } from "../transaction-events.js";
import { executeActionsWithClient, queueRuleActionEvents } from "../rule-engine.js";

async function lockPendingHostEvent(client, roomId, eventId) {
  const result = await client.query(
    `SELECT * FROM pending_host_events WHERE id = $1 AND room_id = $2 FOR UPDATE`,
    [eventId, roomId]
  );
  if (!result.rowCount) return { status: "missing", event: null };
  const event = result.rows[0];
  if (!["pending", "delayed"].includes(event.status)) return { status: "resolved", event };
  return { status: "pending", event };
}

function resolveHostEventLock(lock) {
  if (lock.status === "missing") return { ok: false, code: "HOST_EVENT_NOT_FOUND" };
  if (lock.status === "resolved") return { ok: false, code: "HOST_EVENT_ALREADY_RESOLVED" };
  return null;
}

export async function dismissHostEventById(roomId, actorId, eventId) {
  return transactionWithEvents(async (client, queueEvent) => {
    const lock = await lockPendingHostEvent(client, roomId, eventId);
    const denied = resolveHostEventLock(lock);
    if (denied) return denied;
    const event = lock.event;

    const updated = await client.query(
      `UPDATE pending_host_events
       SET status = 'dismissed', resolved_at = now(), resolved_by_user_id = $1
       WHERE id = $2 AND room_id = $3 AND status IN ('pending', 'delayed')
       RETURNING id`,
      [actorId, eventId, roomId]
    );
    if (!updated.rowCount) return { ok: false, code: "HOST_EVENT_ALREADY_RESOLVED" };

    await client.query(
      `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
       VALUES ($1, $2, 'host', 'host_event_dismissed', $3, jsonb_build_object('eventId', $4::text))`,
      [roomId, actorId, `主持人拒绝待确认事件「${event.title}」`, eventId]
    );
    queueEvent(roomId, "room.host_event_pending", { action: "dismissed", eventId });
    return { ok: true };
  });
}

export async function executeHostEventById(roomId, actorId, eventId) {
  return transactionWithEvents(async (client, queueEvent) => {
    const lock = await lockPendingHostEvent(client, roomId, eventId);
    const denied = resolveHostEventLock(lock);
    if (denied) return denied;
    const event = lock.event;

    const claimed = await client.query(
      `UPDATE pending_host_events
       SET status = 'executed', resolved_at = now(), resolved_by_user_id = $1
       WHERE id = $2 AND room_id = $3 AND status IN ('pending', 'delayed')
       RETURNING id`,
      [actorId, eventId, roomId]
    );
    if (!claimed.rowCount) return { ok: false, code: "HOST_EVENT_ALREADY_RESOLVED" };

    for (const action of event.actions ?? []) {
      await executeActionsWithClient(client, roomId, action.type ? [action] : []);
    }
    await client.query(
      `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
       VALUES ($1, $2, 'host', 'host_event_executed', $3, jsonb_build_object('eventId', $4::text))`,
      [roomId, actorId, `主持人确认并执行「${event.title}」`, eventId]
    );
    if (event.rule_id) {
      await client.query(
        `INSERT INTO rule_executions (rule_id, room_id, result)
         VALUES ($1, $2, '{"status":"host_confirmed"}'::jsonb)
         ON CONFLICT (rule_id, room_id) DO NOTHING`,
        [event.rule_id, roomId]
      );
    }
    queueRuleActionEvents(queueEvent, roomId, event.actions ?? [], "host_event");
    queueEvent(roomId, "room.host_event_pending", { action: "executed", eventId });
    return { ok: true };
  });
}

export async function delayHostEventById(roomId, actorId, eventId, delayMinutes) {
  const minutes = Math.min(Math.max(Number(delayMinutes) || 15, 1), 1440);
  const outcome = await transactionWithEvents(async (client, queueEvent) => {
    const lock = await lockPendingHostEvent(client, roomId, eventId);
    const denied = resolveHostEventLock(lock);
    if (denied) return denied;
    const event = lock.event;

    const updated = await client.query(
      `UPDATE pending_host_events
       SET status = 'delayed',
           delay_until = now() + ($3::text || ' minutes')::interval,
           resolved_at = NULL,
           resolved_by_user_id = NULL
       WHERE id = $1 AND room_id = $2 AND status IN ('pending', 'delayed')
       RETURNING id`,
      [eventId, roomId, String(minutes)]
    );
    if (!updated.rowCount) return { ok: false, code: "HOST_EVENT_ALREADY_RESOLVED" };

    await client.query(
      `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
       VALUES ($1, $2, 'host', 'host_event_delayed', $3, jsonb_build_object('eventId', $4::text, 'delayMinutes', $5::int))`,
      [
        roomId,
        actorId,
        `主持人延迟待确认事件「${event.title}」${minutes} 分钟`,
        eventId,
        minutes
      ]
    );
    queueEvent(roomId, "room.host_event_pending", { action: "delayed", eventId, delayMinutes: minutes });
    return { ok: true, delayMinutes: minutes };
  });
  return outcome;
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
