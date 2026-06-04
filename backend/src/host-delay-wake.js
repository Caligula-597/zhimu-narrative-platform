import { query } from "./db.js";
import { publishRoomEvent } from "./room-event-bus.js";

/** Flip delayed host events back to pending when delay_until has passed. */
export async function wakeDueDelayedHostEvents(runQuery = query) {
  const due = await runQuery(
    `UPDATE pending_host_events
     SET status = 'pending', delay_until = NULL
     WHERE status = 'delayed'
       AND delay_until IS NOT NULL
       AND delay_until <= now()
     RETURNING id, room_id`
  );
  for (const row of due.rows) {
    await publishRoomEvent(row.room_id, "room.host_event_pending", {
      action: "delay_expired",
      eventId: row.id
    });
  }
  return due.rowCount;
}

export function startHostDelayWakeInterval(intervalMs = 30_000) {
  const tick = () => {
    wakeDueDelayedHostEvents().catch(() => {});
  };
  tick();
  return setInterval(tick, intervalMs);
}
