const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN || "https://app.getzhimu.com").replace(/\/$/, "");
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, "")
  ?? (import.meta.env.DEV ? "" : APP_ORIGIN);
const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

const TOKEN_KEY = "zhimuSessionToken";
let cookieSessionActive = false;

function sseCursorKey(roomId) {
  return `zhimuPlaySseCursor:${roomId}`;
}

const PLATFORM_SSE_CURSOR = "zhimuPlayPlatformSseCursor";

function authHeaders() {
  const headers = {};
  const legacy = localStorage.getItem(TOKEN_KEY);
  if (legacy) headers.authorization = `Bearer ${legacy}`;
  return headers;
}

function markAuthenticated() {
  cookieSessionActive = true;
  localStorage.removeItem(TOKEN_KEY);
}

function markLoggedOut() {
  cookieSessionActive = false;
  localStorage.removeItem(TOKEN_KEY);
}

function isAuthenticated() {
  return cookieSessionActive || Boolean(localStorage.getItem(TOKEN_KEY));
}

async function request(path, { method = "GET", body, timeoutMs = 20000 } = {}) {
  const headers = { ...authHeaders() };
  if (body !== undefined) headers["content-type"] = "application/json";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: "include"
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(payload.error || payload.message || `请求失败 (${response.status})`);
      err.code = payload.code;
      err.status = response.status;
      err.details = payload.details;
      throw err;
    }
    if (/^\/auth\/(login|register|guest|upgrade|verify-email|oauth\/complete)/.test(path)) {
      markAuthenticated();
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      const err = new Error("请求超时");
      err.code = "REQUEST_TIMEOUT";
      throw err;
    }
    if (error instanceof TypeError) {
      const err = new Error("网络错误");
      err.code = "NETWORK_ERROR";
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function getAppOrigin() {
  return APP_ORIGIN;
}

export function getPlayOrigin() {
  return window.location.origin;
}

export function getSessionToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token) {
  if (token) markAuthenticated();
  else markLoggedOut();
}

export function clearSession() {
  markLoggedOut();
}

export function hasSession() {
  return isAuthenticated();
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
    const cursor = localStorage.getItem(sseCursorKey(roomId));
    if (cursor) headers["Last-Event-ID"] = cursor;

    return fetch(`${API_BASE}/rooms/${roomId}/events/stream`, { headers, signal }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const error = new Error(err.error || err.message || `连接实时推送失败（${res.status}）`);
        error.status = res.status;
        throw error;
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
          const idLine = block.split("\n").find((line) => line.startsWith("id: "));
          const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
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
            const { type, ...rest } = msg;
            if (type) onEvent(type, rest);
          } catch {
            /* ignore malformed SSE blocks */
          }
        }
      }
    });
  },

  /** SSE platform stream — plaza broadcast + personal DM/friend events. */
  streamPlatformEvents(onEvent, signal) {
    const headers = { Accept: "text/event-stream", ...authHeaders() };
    const cursor = localStorage.getItem(PLATFORM_SSE_CURSOR);
    if (cursor) headers["Last-Event-ID"] = cursor;

    return fetch(`${API_BASE}/platform/events/stream`, { headers, signal }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const error = new Error(err.error || err.message || `连接平台推送失败（${res.status}）`);
        error.status = res.status;
        throw error;
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
          const idLine = block.split("\n").find((line) => line.startsWith("id: "));
          const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
          if (idLine) {
            const eventId = idLine.slice(4).trim();
            if (eventId) localStorage.setItem(PLATFORM_SSE_CURSOR, eventId);
          }
          if (!dataLine) continue;
          try {
            const msg = JSON.parse(dataLine.slice(6));
            if (msg.type === "connected") {
              onEvent("__connected__", msg);
              continue;
            }
            if (msg.type === "heartbeat") continue;
            const { type, ...rest } = msg;
            if (type) onEvent(type, rest);
          } catch {
            /* ignore malformed SSE blocks */
          }
        }
      }
    });
  }
};
