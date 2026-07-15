import { startNonOverlappingInterval } from "./non-overlapping-interval.js";
import { transactionWithEvents } from "./transaction-events.js";

/** Flip delayed host events back to pending when delay_until has passed. */
export async function wakeDueDelayedHostEvents(runTransaction = transactionWithEvents) {
  return runTransaction(async (client, queueEvent) => {
    const due = await client.query(
      `UPDATE pending_host_events
       SET status = 'pending', delay_until = NULL
       WHERE status = 'delayed'
         AND delay_until IS NOT NULL
         AND delay_until <= now()
       RETURNING id, room_id`
    );
    for (const row of due.rows) {
      queueEvent(row.room_id, "room.host_event_pending", {
        action: "delay_expired",
        eventId: row.id
      });
    }
    return due.rowCount;
  });
}

export function startHostDelayWakeInterval(intervalMs = 30_000, onError = () => {}) {
  return startNonOverlappingInterval(
    wakeDueDelayedHostEvents,
    intervalMs,
    { immediate: true, onError }
  ).stop;
}
