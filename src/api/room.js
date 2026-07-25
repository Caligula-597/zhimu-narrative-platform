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
import { openSseStream } from "../../shared/sse-client.js";

export function createRoom(worldId, payload) {
  return request(`/worlds/${worldId}/rooms`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: payload,
    idempotent: true
  });
}

export function updateRoomPublicListing(worldId, roomId, publicListing) {
  return request(`/worlds/${worldId}/rooms/${roomId}/listing`, {
    userId: demoContext.hostUserId,
    method: "PATCH",
    body: { publicListing }
  });
}

export function getRoomContentPolicy(worldId) {
  return request(`/worlds/${worldId}/rooms/content-policy`, {
    userId: demoContext.hostUserId
  });
}

export function getRoomReleaseImpact(worldId, roomId, releaseId) {
  const query = new URLSearchParams({ releaseId });
  return request(`/worlds/${worldId}/rooms/${roomId}/release-impact?${query}`, {
    userId: demoContext.hostUserId
  });
}

export function applyRoomRelease(worldId, roomId, payload) {
  return request(`/worlds/${worldId}/rooms/${roomId}/content-release`, {
    userId: demoContext.hostUserId,
    method: "PATCH",
    body: payload
  });
}

export function getCreatorRoomCurrentState(worldId, roomId) {
  return request(`/worlds/${worldId}/rooms/${roomId}/current-state`, {
    userId: demoContext.hostUserId
  });
}

export function getCreatorRoleKnowledge(worldId, roomId, roleSlotId) {
  return request(`/worlds/${worldId}/rooms/${roomId}/knowledge/${roleSlotId}`, {
    userId: demoContext.hostUserId
  });
}

export function patchRoomSettings(settings, roomId = demoContext.roomId) {
  return request(`/rooms/${roomId}/settings`, { userId: demoContext.hostUserId, method: "PATCH", body: { settings } });
}

/**
 * SSE via fetch (supports Bearer / x-user-id). onEvent(type, data); type "__connected__" on open.
 */
export function streamRoomEvents(roomId, onEvent, signal, userId = demoContext.hostUserId) {
  const cursorKey = sseCursorKey(roomId, userId);
  return openSseStream({
    url: `${API_BASE}/rooms/${roomId}/events/stream`,
    headers: authHeaders(userId),
    signal,
    cursorKey,
    onEvent,
    mapHttpError: (response, payload) => {
      const error = new Error(friendlyApiError(payload, `SSE ${response.status}`));
      error.status = response.status;
      return error;
    }
  });
}
