import { getRoomId, getSessionToken, getWorldId, setSessionToken } from "./session.js";

export { getSessionToken, setSessionToken };

const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN || "https://app.getzhimu.com").replace(/\/$/, "");
const PLAY_ORIGIN = (import.meta.env.VITE_PLAY_ORIGIN || "https://play.getzhimu.com").replace(/\/$/, "");
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, "")
  ?? (import.meta.env.DEV ? "" : APP_ORIGIN);
const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

function sseCursorKey(roomId) {
  return `zhimuHostSseCursor:${roomId}`;
}

function authHeaders() {
  const headers = {};
  const token = getSessionToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (import.meta.env.DEV && localStorage.getItem("zhimuDemoMode") === "true") {
    const demoUserId = localStorage.getItem("zhimuDemoUserId");
    if (demoUserId) headers["x-user-id"] = demoUserId;
  }
  return headers;
}

async function request(path, { method = "GET", body, idempotent = false, timeoutMs = 20000 } = {}) {
  const headers = { ...authHeaders() };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (idempotent) headers["idempotency-key"] = crypto.randomUUID();
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
      if (response.status === 401) setSessionToken("");
      const err = new Error(payload.error || payload.message || `请求失败 (${response.status})`);
      err.code = payload.code;
      err.status = response.status;
      throw err;
    }
    if (/^\/auth\/(login|register|guest|oauth\/complete)/.test(path) && payload.token) {
      setSessionToken(payload.token);
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

function roomPath(suffix) {
  const roomId = getRoomId();
  if (!roomId) throw Object.assign(new Error("请先选择平行房"), { code: "ROOM_REQUIRED" });
  return `/rooms/${roomId}${suffix}`;
}

export function getAppOrigin() {
  return APP_ORIGIN;
}

export function getPlayOrigin() {
  return PLAY_ORIGIN;
}

export function getHostOrigin() {
  return window.location.origin;
}

export function clearSession() {
  setSessionToken("");
}

export const api = {
  authConfig: () => request("/auth/config"),
  me: () => request("/auth/me"),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  register: (email, displayName, password) =>
    request("/auth/register", { method: "POST", body: { email, displayName, password } }),
  guest: (displayName) => request("/auth/guest", { method: "POST", body: { displayName } }),
  oauthStartUrl: (provider, returnOrigin) =>
    request(`/auth/oauth/${provider}/start-url`, {
      method: "POST",
      body: returnOrigin ? { returnOrigin } : {}
    }),
  oauthComplete: (code) => request("/auth/oauth/complete", { method: "POST", body: { code } }),

  getWorlds: () => request("/worlds"),
  getWorldRooms: (worldId = getWorldId()) => {
    if (!worldId) throw Object.assign(new Error("请先选择剧本世界"), { code: "WORLD_REQUIRED" });
    return request(`/worlds/${worldId}/rooms`);
  },
  createRoom: (payload, worldId = getWorldId()) => {
    if (!worldId) throw Object.assign(new Error("请先选择剧本世界"), { code: "WORLD_REQUIRED" });
    return request(`/worlds/${worldId}/rooms`, { method: "POST", body: payload });
  },
  getStudio: (worldId = getWorldId()) => request(`/worlds/${worldId}/studio`),
  getRules: (worldId = getWorldId()) => request(`/worlds/${worldId}/rules`),
  createRule: (payload, worldId = getWorldId()) => request(`/worlds/${worldId}/rules`, { method: "POST", body: payload }),
  updateRule: (ruleId, payload, worldId = getWorldId()) =>
    request(`/worlds/${worldId}/rules/${ruleId}`, { method: "PUT", body: payload }),
  deleteRule: (ruleId, worldId = getWorldId()) => request(`/worlds/${worldId}/rules/${ruleId}`, { method: "DELETE" }),
  validateRules: (worldId = getWorldId()) => request(`/worlds/${worldId}/rules/validate`, { method: "POST", body: {} }),
  validateRuleBody: (payload, worldId = getWorldId()) =>
    request(`/worlds/${worldId}/rules/validate-body`, { method: "POST", body: payload }),
  getWorldLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/worlds/${getWorldId()}/logs${qs ? `?${qs}` : ""}`);
  },

  getHostPlayers: () => request(roomPath("/host/players")),
  getHostPlayerDetail: (roleSlotId) => request(roomPath(`/host/players/${roleSlotId}`)),
  getHostEvents: () => request(roomPath("/host-events")),
  getHostClueMatrix: () => request(roomPath("/host/clue-matrix")),
  getHostAuditLog: (limit = 50) => request(`${roomPath("/host/audit-log")}?limit=${limit}`),
  previewRoomRules: () => request(roomPath("/rules/preview")),
  triggerManualRule: (ruleId) => request(roomPath(`/rules/${ruleId}/trigger`), { method: "POST", idempotent: true }),

  hostGrantClue: (payload) => request(roomPath("/host/grant-clue"), { method: "POST", body: payload, idempotent: true }),
  hostGrantItem: (payload) => request(roomPath("/host/grant-item"), { method: "POST", body: payload, idempotent: true }),
  hostUnlockSection: (payload) =>
    request(roomPath("/host/unlock-section"), { method: "POST", body: payload, idempotent: true }),
  hostUnlockScene: (sceneId) => request(roomPath(`/scenes/${sceneId}/unlock`), { method: "POST", idempotent: true }),
  hostAddLog: (payload) => request(roomPath("/host/log"), { method: "POST", body: payload }),
  hostNudgeWaiting: (payload) => request(roomPath("/host/nudge-waiting"), { method: "POST", body: payload }),
  hostSaveNotes: (roleSlotId, notes) =>
    request(roomPath(`/host/players/${roleSlotId}/notes`), { method: "PUT", body: { notes } }),
  hostKickPlayer: (roleSlotId) =>
    request(roomPath(`/host/players/${roleSlotId}/kick`), { method: "POST", idempotent: true }),
  hostClueNote: (clueId, payload) =>
    request(roomPath(`/host/clues/${clueId}/notes`), { method: "PUT", body: payload }),

  executeHostEvent: (eventId) =>
    request(roomPath(`/host-events/${eventId}/execute`), { method: "POST", idempotent: true }),
  dismissHostEvent: (eventId) =>
    request(roomPath(`/host-events/${eventId}/dismiss`), { method: "POST", idempotent: true }),
  delayHostEvent: (eventId, delayMinutes) =>
    request(roomPath(`/host-events/${eventId}/delay`), { method: "POST", body: { delayMinutes }, idempotent: true }),
  batchHostEvents: (action, eventIds) =>
    request(roomPath("/host-events/batch"), { method: "POST", body: { action, eventIds }, idempotent: true }),

  createCheckpoint: (payload) => request(roomPath("/checkpoints"), { method: "POST", body: payload }),
  createRecap: (payload) => request(roomPath("/recaps"), { method: "POST", body: payload }),

  streamRoomEvents(roomId, onEvent, signal) {
    const headers = { ...authHeaders(), accept: "text/event-stream" };
    const cursor = localStorage.getItem(sseCursorKey(roomId));
    if (cursor) headers["last-event-id"] = cursor;
    return fetch(`${API_BASE}/rooms/${roomId}/events/stream`, { headers, signal, credentials: "include" }).then(async (res) => {
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const err = new Error(payload.message || `SSE ${res.status}`);
        err.status = res.status;
        throw err;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      onEvent("__connected__", {});
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";
        for (const block of blocks) {
          let eventType = "message";
          let data = "";
          let eventId = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
            else if (line.startsWith("id:")) eventId = line.slice(3).trim();
          }
          if (eventId) localStorage.setItem(sseCursorKey(roomId), eventId);
          if (data) {
            try {
              onEvent(eventType, JSON.parse(data));
            } catch {
              /* ignore malformed SSE */
            }
          }
        }
      }
    });
  }
};

export function context() {
  return { worldId: getWorldId(), roomId: getRoomId() };
}
