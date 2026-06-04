/** In-memory room event bus with optional PostgreSQL NOTIFY fan-out for multi-instance SSE. */

import { randomUUID } from "node:crypto";
import { appendRoomEventJournal } from "./room-event-journal.js";
import { pool, query } from "./db.js";

const PG_CHANNEL = "zhimu_room_events";
const INSTANCE_ID = randomUUID();
const busMode = process.env.ROOM_EVENTS_BUS === "postgres" ? "postgres" : "memory";

const subscribers = new Map();
let listenerClient = null;
let listening = false;

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
    mode: busMode,
    instanceId: INSTANCE_ID,
    listening: busMode === "postgres" ? listening : null,
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
  if (busMode !== "postgres") return;
  const notifyPayload = JSON.stringify({
    sourceInstanceId: INSTANCE_ID,
    roomId,
    id: envelope.id ?? null,
    payload: envelope.payload
  });
  if (notifyPayload.length > 7900) return;
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
  if (busMode !== "postgres" || listenerClient) return;
  listenerClient = await pool.connect();
  listenerClient.on("notification", handlePostgresNotification);
  await listenerClient.query(`LISTEN ${PG_CHANNEL}`);
  listening = true;
}

export async function stopRoomEventBus() {
  if (!listenerClient) return;
  try {
    await listenerClient.query(`UNLISTEN ${PG_CHANNEL}`);
  } catch {
    /* ignore shutdown races */
  }
  listenerClient.removeListener("notification", handlePostgresNotification);
  listenerClient.release();
  listenerClient = null;
  listening = false;
}

/** Publish after journal write so SSE subscribers receive stable journal ids. */
export async function publishRoomEvent(roomId, type, data = {}) {
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
  }
  const envelope = journalId != null ? { id: journalId, payload } : { payload };
  deliverToSubscribers(roomId, envelope);
  await fanOutToOtherInstances(roomId, envelope);
  return { ...event, journalId };
}

export function resetRoomEventBusForTests() {
  subscribers.clear();
}
