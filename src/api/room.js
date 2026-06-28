/**
 * Room domain — room creation, listing, settings, SSE event stream.
 */
import {
  API_BASE,
  authHeaders,
  demoContext,
  request,
  sseCursorKey
} from "./client.js";
import { friendlyApiError } from "../utils/user-messages.js";

export function createRoom(worldId, payload) {
  return request(`/worlds/${worldId}/rooms`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function updateRoomPublicListing(worldId, roomId, publicListing) {
  return request(`/worlds/${worldId}/rooms/${roomId}/listing`, {
    userId: demoContext.hostUserId,
    method: "PATCH",
    body: { publicListing }
  });
}

export function patchRoomSettings(settings, roomId = demoContext.roomId) {
  return request(`/rooms/${roomId}/settings`, { userId: demoContext.hostUserId, method: "PATCH", body: { settings } });
}

/**
 * SSE via fetch (supports Bearer / x-user-id). onEvent(type, data); type "__connected__" on open.
 */
export function streamRoomEvents(roomId, onEvent, signal, userId = demoContext.hostUserId) {
  const headers = { Accept: "text/event-stream", ...authHeaders(userId) };
  const cursor = localStorage.getItem(sseCursorKey(roomId));
  if (cursor) headers["Last-Event-ID"] = cursor;

  return fetch(`${API_BASE}/rooms/${roomId}/events/stream`, { headers, signal, credentials: "include" }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(friendlyApiError(err, `连接实时推送失败（${res.status}）`));
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const idLine = block.split("\n").find((l) => l.startsWith("id: "));
        const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
        if (idLine) {
          const eventId = idLine.slice(4).trim();
          if (eventId) localStorage.setItem(sseCursorKey(roomId), eventId);
        }
        if (!dataLine) continue;
        try {
          const msg = JSON.parse(dataLine.slice(6));
          if (msg.type === "connected") {
            onEvent("__connected__", msg);
            continue;
          }
          if (msg.type === "heartbeat") continue;
          const { type, at, roomId: rid, ...rest } = msg;
          if (type) onEvent(type, rest);
        } catch {
          /* ignore malformed */
        }
      }
    }
  });
}
