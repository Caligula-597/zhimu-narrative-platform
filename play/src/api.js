import { consumeSseStream } from "../../shared/sse.js";
import { createApiFetch, extractAuthToken } from "../../shared/api-fetch.js";
import { createSessionTokenStore } from "../../shared/session-token.js";

const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN || "https://app.getzhimu.com").replace(/\/$/, "");
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, "")
  ?? (import.meta.env.DEV ? "" : APP_ORIGIN);
const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

const sessionToken = createSessionTokenStore("zhimuSessionToken");

/** Play 部署在 play.*，API 在 app.*；SameSite=Lax 的 HttpOnly Cookie 不会随跨站 fetch 发送，故始终用 Bearer。 */
function sseCursorKey(roomId) {
  return `zhimuPlaySseCursor:${roomId}`;
}

const PLATFORM_SSE_CURSOR = "zhimuPlayPlatformSseCursor";

const { request } = createApiFetch({
  baseUrl: API_BASE,
  getHeaders() {
    const headers = { ...sessionToken.bearerHeaders() };
    const demoUserId = localStorage.getItem("zhimuDemoUserId");
    if (demoUserId) headers["x-user-id"] = demoUserId;
    return headers;
  },
  mapHttpError(response, payload) {
    const err = new Error(payload.error || payload.message || `请求失败 (${response.status})`);
    err.code = payload.code;
    err.status = response.status;
    err.details = payload.details;
    return err;
  },
  afterSuccess(path, payload) {
    const token = extractAuthToken(path, payload);
    if (token) sessionToken.set(token);
  }
});

export function getAppOrigin() {
  return APP_ORIGIN;
}

export function getPlayOrigin() {
  return window.location.origin;
}

export function getSessionToken() {
  return sessionToken.get();
}

export function setSessionToken(token) {
  if (token) sessionToken.set(token);
  else sessionToken.clear();
}

export function clearSession() {
  sessionToken.clear();
}

export function hasSession() {
  return Boolean(sessionToken.get());
}

export const api = {
  authConfig: () => request("/auth/config"),
  me: () => request("/auth/me"),
  guest: (displayName) => request("/auth/guest", { method: "POST", body: { displayName } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  register: (email, displayName, password) =>
    request("/auth/register", { method: "POST", body: { email, displayName, password } }),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token, password) =>
    request("/auth/reset-password", { method: "POST", body: { token, password } }),
  verifyEmail: (token) => request("/auth/verify-email", { method: "POST", body: { token } }),
  resendVerification: () => request("/auth/resend-verification", { method: "POST", body: {} }),
  oauthStartUrl: (provider, returnOrigin) =>
    request(`/auth/oauth/${provider}/start-url`, {
      method: "POST",
      body: returnOrigin ? { returnOrigin } : {}
    }),
  oauthComplete: (code) => request("/auth/oauth/complete", { method: "POST", body: { code } }),
  lookupInvite: (inviteCode) => request(`/rooms/invite/${encodeURIComponent(inviteCode)}`),
  joinRoom: (inviteCode, roleSlotId) =>
    request("/rooms/join", { method: "POST", body: { inviteCode, roleSlotId } }),
  playerHome: (roomId) => request(`/rooms/${roomId}/player-home`),
  completeSection: (roomId, sectionId) =>
    request(`/rooms/${roomId}/sections/${sectionId}/complete`, { method: "POST", body: {} }),
  exploration: (roomId) => request(`/rooms/${roomId}/exploration`),
  investigate: (roomId, pointId) =>
    request(`/rooms/${roomId}/investigation-points/${pointId}/investigate`, { method: "POST", body: {} }),
  readClue: (roomId, clueId) =>
    request(`/rooms/${roomId}/clues/${clueId}/read`, { method: "POST", body: {} }),
  shareClueToRoom: (roomId, clueId, shared = true) =>
    request(`/rooms/${roomId}/clues/${clueId}/share-room`, { method: "POST", body: { shared } }),
  shareClueToRoles: (roomId, clueId, roleSlotIds) =>
    request(`/rooms/${roomId}/clues/${clueId}/share-roles`, { method: "POST", body: { roleSlotIds } }),
  submitMiniGame: (payload) => request("/rooms/game/submit", { method: "POST", body: payload }),
  updateCluePlayerNote: (roomId, clueId, note) =>
    request(`/rooms/${roomId}/clues/${clueId}/player-note`, { method: "PATCH", body: { note } }),
  addNotebookEntry: (roomId, entry) =>
    request(`/rooms/${roomId}/notebook`, { method: "POST", body: entry }),
  deleteNotebookEntry: (roomId, entryId) =>
    request(`/rooms/${roomId}/notebook/${entryId}`, { method: "DELETE" }),
  getVoiceMessages: (voiceRoomId) => request(`/voice-rooms/${voiceRoomId}/messages`),
  getVoiceRoomToken: (roomId, voiceRoomId) =>
    request(`/rooms/${roomId}/voice-rooms/${voiceRoomId}/token`, { method: "POST", body: {} }),
  sendVoiceMessage: (voiceRoomId, body) =>
    request(`/voice-rooms/${voiceRoomId}/messages`, { method: "POST", body: { body } }),
  createVoiceRoom: (roomId, payload) =>
    request(`/rooms/${roomId}/voice-rooms`, { method: "POST", body: payload }),
  inviteVoiceRoomMembers: (voiceRoomId, inviteUserIds) =>
    request(`/voice-rooms/${voiceRoomId}/members`, { method: "POST", body: { inviteUserIds } }),
  platformSite: () => request("/platform/site"),
  publicRooms: (limit = 24) => request(`/platform/public-rooms?limit=${limit}`),
  plazaPosts: ({ kind, limit = 40 } = {}) => {
    const params = new URLSearchParams();
    if (kind && kind !== "all") params.set("kind", kind);
    params.set("limit", String(limit));
    const qs = params.toString();
    return request(`/platform/plaza/posts${qs ? `?${qs}` : ""}`);
  },
  createPlazaPost: (payload) => request("/platform/plaza/posts", { method: "POST", body: payload }),
  plazaPost: (postId) => request(`/platform/plaza/posts/${postId}`),
  plazaReplies: (postId, limit = 100) =>
    request(`/platform/plaza/posts/${postId}/replies?limit=${limit}`),
  createPlazaReply: (postId, payload) =>
    request(`/platform/plaza/posts/${postId}/replies`, { method: "POST", body: payload }),
  deletePlazaPost: (postId) => request(`/platform/plaza/posts/${postId}`, { method: "DELETE" }),
  deletePlazaReply: (replyId) => request(`/platform/plaza/replies/${replyId}`, { method: "DELETE" }),
  reportPlaza: (payload) => request("/platform/plaza/reports", { method: "POST", body: payload }),
  searchPlayers: (q, limit = 10) =>
    request(`/platform/social/players/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  listFriends: () => request("/platform/social/friends"),
  sendFriendRequest: (targetUserId) =>
    request("/platform/social/friends/request", { method: "POST", body: { targetUserId } }),
  respondFriendRequest: (targetUserId, accept) =>
    request("/platform/social/friends/respond", { method: "POST", body: { targetUserId, accept } }),
  listDmConversations: () => request("/platform/social/dm/conversations"),
  openDmConversation: (peerUserId) =>
    request("/platform/social/dm/conversations", { method: "POST", body: { peerUserId } }),
  listDmMessages: (conversationId) =>
    request(`/platform/social/dm/conversations/${conversationId}/messages`),
  sendDmMessage: (conversationId, body) =>
    request(`/platform/social/dm/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { body }
    }),
  officialExample: () => request("/platform/official-example"),
  joinOfficialExample: () => request("/platform/official-example/join", { method: "POST", body: {} }),
  latestRecap: (roomId) => request(`/rooms/${roomId}/recap/latest`),
  getRecap: (roomId, recapId) => request(`/rooms/${roomId}/recaps/${recapId}`),

  /** SSE room stream — same endpoint as app.getzhimu.com host/player views. */
  streamRoomEvents(roomId, onEvent, signal) {
    const headers = { Accept: "text/event-stream", ...authHeaders() };
    const cursorKey = sseCursorKey(roomId);
    const cursor = localStorage.getItem(cursorKey);
    if (cursor) headers["Last-Event-ID"] = cursor;
    return fetch(`${API_BASE}/rooms/${roomId}/events/stream`, { headers, signal, credentials: "include" }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const error = new Error(err.error || err.message || `连接实时推送失败（${res.status}）`);
        error.status = res.status;
        throw error;
      }
      return consumeSseStream(res, {
        cursorKey,
        onEvent: (eventType, msg) => {
          if (msg.type === "connected") { onEvent("__connected__", msg); return; }
          if (msg.type === "heartbeat") return;
          const { type, ...rest } = msg;
          if (type) onEvent(type, rest);
        }
      });
    });
  },

  /** SSE platform stream — plaza broadcast + personal DM/friend events. */
  streamPlatformEvents(onEvent, signal) {
    const headers = { Accept: "text/event-stream", ...authHeaders() };
    const cursor = localStorage.getItem(PLATFORM_SSE_CURSOR);
    if (cursor) headers["Last-Event-ID"] = cursor;
    return fetch(`${API_BASE}/platform/events/stream`, { headers, signal, credentials: "include" }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const error = new Error(err.error || err.message || `连接平台推送失败（${res.status}）`);
        error.status = res.status;
        throw error;
      }
      return consumeSseStream(res, {
        cursorKey: PLATFORM_SSE_CURSOR,
        onEvent: (eventType, msg) => {
          if (msg.type === "connected") { onEvent("__connected__", msg); return; }
          if (msg.type === "heartbeat") return;
          const { type, ...rest } = msg;
          if (type) onEvent(type, rest);
        }
      });
    });
  }
};
