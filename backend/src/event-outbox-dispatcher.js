import { startNonOverlappingInterval } from "./non-overlapping-interval.js";
import {
  claimEventOutbox,
  persistClaimedPlatformEvent,
  persistClaimedRoomEvent,
  readEventOutboxCounts,
  releaseFailedOutboxEvent
} from "./event-outbox-repository.js";
import { publishPersistedRoomEvent } from "./room-event-bus.js";
import { publishPersistedPlatformEvent } from "./platform-event-bus.js";

const status = {
  started: false,
  running: false,
  processed: 0,
  failed: 0,
  dead: 0,
  discarded: 0,
  pending: 0,
  processing: 0,
  oldestPendingSeconds: 0,
  lastDispatchedAt: null,
  lastErrorAt: null,
  lastError: null
};
const scheduledIds = new Set();
let dispatchScheduled = false;
let scheduledDispatchPromise = Promise.resolve();

export function getEventOutboxStatus() {
  return { ...status };
}

async function refreshCounts() {
  const counts = await readEventOutboxCounts();
  status.pending = Number(counts.pending || 0);
  status.processing = Number(counts.processing || 0);
  status.dead = Number(counts.dead || 0);
  status.oldestPendingSeconds = Number(counts.oldest_pending_seconds || 0);
}

export async function dispatchEventOutbox({ ids = null, limit = 50, refresh = false } = {}) {
  const rows = await claimEventOutbox({ ids, limit });
  let processed = 0;
  let failed = 0;
  status.running = true;
  try {
    for (const row of rows) {
      try {
        const published = row.event_scope === "room"
          ? await persistClaimedRoomEvent(row)
          : await persistClaimedPlatformEvent(row);
        if (!published) continue;
        if (published.discarded) {
          status.discarded += 1;
        } else if (row.event_scope === "room") {
          await publishPersistedRoomEvent(published.event, published.journalId);
        } else {
          await publishPersistedPlatformEvent(published);
        }
        processed += 1;
        status.processed += 1;
        status.lastDispatchedAt = new Date().toISOString();
      } catch (error) {
        failed += 1;
        status.failed += 1;
        status.lastErrorAt = new Date().toISOString();
        status.lastError = String(error?.message || error).slice(0, 500);
        const released = await releaseFailedOutboxEvent(row, error).catch(() => ({ dead: false }));
        if (released.dead) status.dead += 1;
      }
    }
    if (refresh) await refreshCounts();
    return { claimed: rows.length, processed, failed };
  } finally {
    status.running = false;
  }
}

/** Coalesce post-commit wakeups so request latency never includes journal/SSE delivery. */
export function scheduleEventOutboxDispatch(ids = []) {
  for (const id of ids) scheduledIds.add(String(id));
  if (dispatchScheduled) return;
  dispatchScheduled = true;
  scheduledDispatchPromise = new Promise((resolve) => {
    queueMicrotask(async () => {
      const batch = [...scheduledIds];
      scheduledIds.clear();
      try {
        await dispatchEventOutbox({ ids: batch, limit: Math.min(Math.max(batch.length, 1), 200) });
      } catch (error) {
        status.failed += 1;
        status.lastErrorAt = new Date().toISOString();
        status.lastError = String(error?.message || error).slice(0, 500);
      } finally {
        dispatchScheduled = false;
        resolve();
        if (scheduledIds.size) scheduleEventOutboxDispatch();
      }
    });
  });
}

export async function waitForScheduledEventOutbox() {
  while (dispatchScheduled) await scheduledDispatchPromise;
}

export function startEventOutboxDispatcher({ log = console, intervalMs = Number(process.env.EVENT_OUTBOX_POLL_MS || 5000) } = {}) {
  status.started = true;
  let ticks = 0;
  const controller = startNonOverlappingInterval(
    () => dispatchEventOutbox({ refresh: ++ticks % 6 === 0 }),
    intervalMs,
    {
      immediate: true,
      onError(error) {
        status.failed += 1;
        status.lastErrorAt = new Date().toISOString();
        status.lastError = String(error?.message || error).slice(0, 500);
        log.error?.({ error }, "event outbox dispatcher failed");
      }
    }
  );
  return async () => {
    await controller.stop();
    status.started = false;
  };
}

export function resetEventOutboxStatusForTests() {
  scheduledIds.clear();
  dispatchScheduled = false;
  scheduledDispatchPromise = Promise.resolve();
  Object.assign(status, {
    started: false,
    running: false,
    processed: 0,
    failed: 0,
    dead: 0,
    discarded: 0,
    pending: 0,
    processing: 0,
    oldestPendingSeconds: 0,
    lastDispatchedAt: null,
    lastErrorAt: null,
    lastError: null
  });
}
