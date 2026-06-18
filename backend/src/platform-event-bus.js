/** In-memory platform SSE bus for play portal (plaza broadcast + per-user DM). */

const userSubscribers = new Map();
const broadcastSubscribers = new Set();

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
  const payload = JSON.stringify(envelope);
  for (const client of set) {
    try {
      client.send(payload);
    } catch {
      /* subscriber best-effort */
    }
  }
}

export function publishPlatformUserEvent(userId, type, data = {}) {
  const subs = userSubscribers.get(userId);
  if (!subs?.size) return;
  deliver(subs, { type, at: new Date().toISOString(), userId, ...data });
}

export function publishPlatformBroadcast(type, data = {}) {
  if (!broadcastSubscribers.size) return;
  deliver(broadcastSubscribers, { type, at: new Date().toISOString(), ...data });
}

export function resetPlatformEventBusForTests() {
  userSubscribers.clear();
  broadcastSubscribers.clear();
}
