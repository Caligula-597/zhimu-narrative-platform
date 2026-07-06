import { getRoomId, getSessionToken, getWorldId, setSessionToken } from "./session.js";
import { consumeSseStream } from "../../shared/sse.js";
import { createApiFetch, extractAuthToken } from "../../shared/api-fetch.js";
import { defaultSessionTokenStore } from "../../shared/session-token.js";

export { getSessionToken, setSessionToken };

const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN || "https://app.getzhimu.com").replace(/\/$/, "");
const PLAY_ORIGIN = (import.meta.env.VITE_PLAY_ORIGIN || "https://play.getzhimu.com").replace(/\/$/, "");
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, "")
  ?? (import.meta.env.DEV ? "" : APP_ORIGIN);
const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

function sseCursorKey(roomId) {
  return `zhimuHostSseCursor:${roomId}`;
}

const { request } = createApiFetch({
  baseUrl: API_BASE,
  getHeaders() {
    const headers = { ...defaultSessionTokenStore.bearerHeaders() };
    if (import.meta.env.DEV && localStorage.getItem("zhimuDemoMode") === "true") {
      const demoUserId = localStorage.getItem("zhimuDemoUserId");
      if (demoUserId) headers["x-user-id"] = demoUserId;
    }
    return headers;
  },
  mapHttpError(response, payload) {
    if (response.status === 401) defaultSessionTokenStore.clear();
    const err = new Error(payload.error || payload.message || `请求失败 (${response.status})`);
    err.code = payload.code;
    err.status = response.status;
    return err;
  },
  afterSuccess(path, payload) {
    const token = extractAuthToken(path, payload);
    if (token) defaultSessionTokenStore.set(token);
  }
});

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
  getWorldSegments: (worldId = getWorldId()) => request(`/worlds/${worldId}/segments`),
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
  getHostVotes: () => request(roomPath("/host/votes")),
  hostCreateVote: (payload) => request(roomPath("/host/votes"), { method: "POST", body: payload }),
  hostUpdateVoteStatus: (voteId, status) =>
    request(roomPath(`/host/votes/${voteId}`), { method: "PATCH", body: { status } }),
  getHostPrivateActions: () => request(roomPath("/host/private-actions")),
  hostUpdatePrivateAction: (actionId, payload) =>
    request(roomPath(`/host/private-actions/${actionId}`), { method: "PATCH", body: payload }),
  hostUpdateRoleState: (roleSlotId, payload) =>
    request(roomPath(`/host/players/${roleSlotId}/state`), { method: "PATCH", body: payload }),
  getRoomRunReport: () => request(roomPath("/run-report")),
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

  getHostTestimonies: () => request(roomPath("/host/testimonies")),
  reviewHostTestimony: (testimonyId, payload) =>
    request(roomPath(`/host/testimonies/${testimonyId}`), { method: "PATCH", body: payload }),
  getHostSuspicions: () => request(roomPath("/host/suspicions")),
  getHostSegmentRemedies: (segmentKey) => {
    const qs = segmentKey ? `?segmentKey=${encodeURIComponent(segmentKey)}` : "";
    return request(roomPath(`/host/segment-remedies${qs}`));
  },
  applyHostSegmentRemedy: (remedyId) =>
    request(roomPath(`/host/segment-remedies/${remedyId}/apply`), { method: "POST", body: {} }),

  streamRoomEvents(roomId, onEvent, signal) {
    const headers = { ...defaultSessionTokenStore.bearerHeaders(), accept: "text/event-stream" };
    if (import.meta.env.DEV && localStorage.getItem("zhimuDemoMode") === "true") {
      const demoUserId = localStorage.getItem("zhimuDemoUserId");
      if (demoUserId) headers["x-user-id"] = demoUserId;
    }
    const cursorKey = sseCursorKey(roomId);
    const cursor = localStorage.getItem(cursorKey);
    if (cursor) headers["last-event-id"] = cursor;
    return fetch(`${API_BASE}/rooms/${roomId}/events/stream`, { headers, signal, credentials: "include" }).then(async (res) => {
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const err = new Error(payload.message || `SSE ${res.status}`);
        err.status = res.status;
        throw err;
      }
      onEvent("__connected__", {});
      return consumeSseStream(res, {
        cursorKey,
        onEvent: (eventType, data) => onEvent(eventType, data)
      });
    });
  }
};

export function context() {
  return { worldId: getWorldId(), roomId: getRoomId() };
}
