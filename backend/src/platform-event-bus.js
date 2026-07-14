/** Durable platform SSE bus with optional PostgreSQL NOTIFY fan-out. */

import { randomUUID } from "node:crypto";
import { recordSseEventOperation } from "./metrics.js";
import { createPostgresEventListener } from "./postgres-event-listener.js";
import { safePostgresNotify } from "./postgres-notify.js";

const PG_CHANNEL = "zhimu_platform_events";
const INSTANCE_ID = randomUUID();
const userSubscribers = new Map();
const broadcastSubscribers = new Set();

function postgresEnabled() {
  if (process.env.ROOM_EVENTS_BUS === "memory") return false;
  return process.env.ROOM_EVENTS_BUS === "postgres" || process.env.NODE_ENV === "production";
}

export function getPlatformEventBusStatus() {
  let userConnections = 0;
  for (const subscribers of userSubscribers.values()) userConnections += subscribers.size;
  return {
    mode: postgresEnabled() ? "postgres" : "memory",
    instanceId: INSTANCE_ID,
    listening: postgresEnabled() ? postgresListener.isListening() : null,
    userConnections,
    broadcastConnections: broadcastSubscribers.size
  };
}

export function subscribePlatformUserEvents(userId, send) {
  if (!userSubscribers.has(userId)) userSubscribers.set(userId, new Set());
  const client = { send };
  userSubscribers.get(userId).add(client);
  return () => {
    userSubscribers.get(userId)?.delete(client);
    if (userSubscribers.get(userId)?.size === 0) userSubscribers.delete(userId);
  };
}

export function subscribePlatformBroadcast(send) {
  const client = { send };
  broadcastSubscribers.add(client);
  return () => broadcastSubscribers.delete(client);
}

function deliver(set, envelope) {
  for (const client of set) {
    try {
      client.send(envelope);
    } catch {
      /* subscriber may have disconnected */
    }
  }
}

function deliverAudience(audienceType, userId, envelope) {
  if (audienceType === "broadcast") deliver(broadcastSubscribers, envelope);
  else deliver(userSubscribers.get(userId) ?? [], envelope);
}

async function fanOutToOtherInstances({ audienceType, userId, envelope }) {
  if (!postgresEnabled()) return;
  const notifyPayload = JSON.stringify({
    sourceInstanceId: INSTANCE_ID,
    audienceType,
    userId,
    id: envelope.id ?? null,
    payload: envelope.payload
  });
  // PostgreSQL NOTIFY payload is limited to 8000 bytes. Large events remain
  // durable and will be recovered from the journal during reconciliation.
  if (Buffer.byteLength(notifyPayload, "utf8") >= 7900) {
    recordSseEventOperation({ bus: "platform", outcome: "notify_oversize" });
    return;
  }
  await safePostgresNotify({
    channel: PG_CHANNEL,
    payload: notifyPayload,
    onError: () => recordSseEventOperation({ bus: "platform", outcome: "notify_failed" })
  });
}

function handlePostgresNotification(message) {
  try {
    const data = JSON.parse(message.payload);
    if (data.sourceInstanceId === INSTANCE_ID) return;
    deliverAudience(data.audienceType, data.userId, {
      ...(data.id != null ? { id: data.id } : {}),
      payload: data.payload
    });
  } catch {
    /* malformed notification */
  }
}

export async function startPlatformEventBus() {
  if (!postgresEnabled()) return;
  await postgresListener.start();
}

export async function stopPlatformEventBus() {
  await postgresListener.stop();
}

const postgresListener = createPostgresEventListener({
  channel: PG_CHANNEL,
  onNotification: handlePostgresNotification,
  onError: () => recordSseEventOperation({ bus: "platform", outcome: "listener_error" })
});

export async function publishPersistedPlatformEvent({ audienceType, userId = null, event, journalId }) {
  const payload = JSON.stringify(event);
  const envelope = journalId != null ? { id: journalId, payload } : { payload };
  deliverAudience(audienceType, userId, envelope);
  await fanOutToOtherInstances({ audienceType, userId, envelope });
  recordSseEventOperation({ bus: "platform", outcome: "published" });
  return { ...event, journalId };
}

export function resetPlatformEventBusForTests() {
  userSubscribers.clear();
  broadcastSubscribers.clear();
}
