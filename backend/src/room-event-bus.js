/** In-memory room event bus with optional PostgreSQL NOTIFY fan-out for multi-instance SSE. */

import { randomUUID } from "node:crypto";
import { appendRoomEventJournal } from "./room-event-journal.js";
import { query } from "./db.js";
import { validateRoomEvent } from "./room-event-schemas.js";
import { recordSseEventOperation } from "./metrics.js";
import { createPostgresEventListener } from "./postgres-event-listener.js";

const PG_CHANNEL = "zhimu_room_events";
const INSTANCE_ID = randomUUID();
function postgresEnabled() {
  if (process.env.ROOM_EVENTS_BUS === "memory") return false;
  return process.env.ROOM_EVENTS_BUS === "postgres" || process.env.NODE_ENV === "production";
}

const subscribers = new Map();

export function getSseConnectionMetrics() {
  let connections = 0;
  for (const roomSubs of subscribers.values()) {
    connections += roomSubs.size;
  }
  return {
    connections,
    rooms: subscribers.size
  };
}

export function getRoomEventBusStatus() {
  const sse = getSseConnectionMetrics();
  return {
    mode: postgresEnabled() ? "postgres" : "memory",
    instanceId: INSTANCE_ID,
    listening: postgresEnabled() ? postgresListener.isListening() : null,
    subscriberRooms: sse.rooms,
    sseConnections: sse.connections
  };
}

export function subscribeRoomEvents(roomId, send) {
  if (!subscribers.has(roomId)) subscribers.set(roomId, new Set());
  const client = { send };
  subscribers.get(roomId).add(client);
  return () => {
    subscribers.get(roomId)?.delete(client);
    if (subscribers.get(roomId)?.size === 0) subscribers.delete(roomId);
  };
}

function normalizeSendArg(message) {
  if (typeof message === "string") {
    return { payload: message };
  }
  if (message && typeof message.payload === "string") {
    return message;
  }
  return { payload: JSON.stringify(message) };
}

function deliverToSubscribers(roomId, message) {
  const envelope = normalizeSendArg(message);
  for (const client of subscribers.get(roomId) ?? []) {
    try {
      client.send(envelope);
    } catch {
      /* subscriber may have disconnected */
    }
  }
}

async function fanOutToOtherInstances(roomId, envelope) {
  if (!postgresEnabled()) return;
  const notifyPayload = JSON.stringify({
    sourceInstanceId: INSTANCE_ID,
    roomId,
    id: envelope.id ?? null,
    payload: envelope.payload
  });
  if (Buffer.byteLength(notifyPayload, "utf8") >= 7900) {
    recordSseEventOperation({ bus: "room", outcome: "notify_oversize" });
    return;
  }
  await query(`SELECT pg_notify($1, $2)`, [PG_CHANNEL, notifyPayload]);
}

function handlePostgresNotification(msg) {
  try {
    const data = JSON.parse(msg.payload);
    if (data.sourceInstanceId === INSTANCE_ID) return;
    deliverToSubscribers(
      data.roomId,
      data.id != null ? { id: data.id, payload: data.payload } : data.payload
    );
  } catch {
    /* malformed notify payload */
  }
}

export async function startRoomEventBus() {
  if (!postgresEnabled()) return;
  await postgresListener.start();
}

export async function stopRoomEventBus() {
  await postgresListener.stop();
}

const postgresListener = createPostgresEventListener({
  channel: PG_CHANNEL,
  onNotification: handlePostgresNotification,
  onError: () => recordSseEventOperation({ bus: "room", outcome: "listener_error" })
});

/** Publish after journal write so SSE subscribers receive stable journal ids. */
export async function publishRoomEvent(roomId, type, data = {}) {
  const { ok, errors } = validateRoomEvent(type, data);
  if (!ok) {
    throw new Error(`Invalid room event: ${errors.join("; ")}`);
  }
  const event = {
    type,
    roomId,
    at: new Date().toISOString(),
    ...data
  };
  const payload = JSON.stringify(event);
  let journalId;
  try {
    const row = await appendRoomEventJournal(roomId, event);
    journalId = row?.id;
  } catch {
    /* journal is best-effort for non-uuid test rooms */
    recordSseEventOperation({ bus: "room", outcome: "journal_failed" });
  }
  const envelope = journalId != null ? { id: journalId, payload } : { payload };
  deliverToSubscribers(roomId, envelope);
  await fanOutToOtherInstances(roomId, envelope);
  recordSseEventOperation({ bus: "room", outcome: "published" });
  return { ...event, journalId };
}

export function resetRoomEventBusForTests() {
  subscribers.clear();
}
