/** In-memory room event bus (single-node). Use SSE subscribers per running room. */

const subscribers = new Map();

export function subscribeRoomEvents(roomId, send) {
  if (!subscribers.has(roomId)) subscribers.set(roomId, new Set());
  const client = { send };
  subscribers.get(roomId).add(client);
  return () => {
    subscribers.get(roomId)?.delete(client);
    if (subscribers.get(roomId)?.size === 0) subscribers.delete(roomId);
  };
}

export function publishRoomEvent(roomId, type, data = {}) {
  const event = {
    type,
    roomId,
    at: new Date().toISOString(),
    ...data
  };
  const payload = JSON.stringify(event);
  for (const client of subscribers.get(roomId) ?? []) {
    try {
      client.send(payload);
    } catch {
      /* subscriber may have disconnected */
    }
  }
  return event;
}

export function resetRoomEventBusForTests() {
  subscribers.clear();
}
