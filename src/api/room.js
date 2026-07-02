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
import { consumeSseStream } from "../../shared/sse.js";

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
  const cursorKey = sseCursorKey(roomId);
  const cursor = localStorage.getItem(cursorKey);
  if (cursor) headers["Last-Event-ID"] = cursor;

  return fetch(`${API_BASE}/rooms/${roomId}/events/stream`, { headers, signal, credentials: "include" }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(friendlyApiError(err, `连接实时推送失败（${res.status}）`));
    }
    return consumeSseStream(res, {
      cursorKey,
      onEvent: (eventType, msg) => {
        if (msg.type === "connected") { onEvent("__connected__", msg); return; }
        if (msg.type === "heartbeat") return;
        const { type, at, roomId: rid, ...rest } = msg;
        if (type) onEvent(type, rest);
      }
    });
  });
}
