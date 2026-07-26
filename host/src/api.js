import { getRoomId, getSessionToken, getWorldId, setSessionToken } from "./session.js";
import {
  createPortalApiClient,
  createPortalJsonError,
  resolveDemoUserId,
  resolveVitePortalApiBase
} from "../../shared/api-client.js";
import { defaultSessionTokenStore } from "../../shared/session-token.js";
import { scopedSseCursorKey } from "../../shared/sse-client.js";

export { getSessionToken, setSessionToken };

const viteEnv = import.meta.env || {};
const APP_ORIGIN = (viteEnv.VITE_APP_ORIGIN || "https://app.getzhimu.com").replace(/\/$/, "");
const PLAY_ORIGIN = (viteEnv.VITE_PLAY_ORIGIN || "https://play.getzhimu.com").replace(/\/$/, "");
const API_BASE = resolveVitePortalApiBase({
  viteAppOrigin: APP_ORIGIN,
  viteApiOrigin: viteEnv.VITE_API_ORIGIN,
  dev: viteEnv.DEV
});

function sseCursorKey(roomId, userId) {
  return scopedSseCursorKey("zhimuHostSseCursor", roomId, userId);
}

const portal = createPortalApiClient({
  baseUrl: API_BASE,
  tokenStore: defaultSessionTokenStore,
  getDemoUserId: () => resolveDemoUserId(localStorage, { requireDemoFlag: viteEnv.DEV }),
  mapHttpError: createPortalJsonError,
  clearTokenOn401: true
});

const { request } = portal;

function roomPath(suffix) {
  return roomPathFor(getRoomId(), suffix);
}

function roomPathFor(roomId, suffix) {
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
  logout: () => request("/auth/logout", { method: "POST", body: {} }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  register: (email, displayName, password) =>
    request("/auth/register", { method: "POST", body: { email, displayName, password } }),
  resendVerification: () =>
    request("/auth/resend-verification", { method: "POST", body: {} }),
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
  createRoom: (payload, worldId = getWorldId(), idempotencyKey = "") => {
    if (!worldId) throw Object.assign(new Error("请先选择剧本世界"), { code: "WORLD_REQUIRED" });
    return request(`/worlds/${worldId}/rooms`, {
      method: "POST",
      body: payload,
      idempotent: true,
      idempotencyKey
    });
  },
  getStudio: (worldId = getWorldId()) => request(`/worlds/${worldId}/studio`),
  getWorldSegments: (worldId = getWorldId()) => request(`/worlds/${worldId}/segments`),
  getRules: (worldId = getWorldId()) => request(`/worlds/${worldId}/rules`),
  getRuntimeContent: () => request(roomPath("/runtime-content")),
  getHostCurrentState: () => request(roomPath("/host/current-state")),
  getHostPlayerKnowledge: (roleSlotId) =>
    request(roomPath(`/host/players/${roleSlotId}/knowledge`)),
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
  hostCreateVote: (payload, roomId = getRoomId(), idempotencyKey = "") =>
    request(roomPathFor(roomId, "/host/votes"), {
      method: "POST",
      body: payload,
      idempotent: true,
      idempotencyKey
    }),
  hostUpdateVoteStatus: (voteId, status) =>
    request(roomPath(`/host/votes/${voteId}`), { method: "PATCH", body: { status } }),
  getHostPrivateActions: () => request(roomPath("/host/private-actions")),
  getHostMiniGames: () => request(roomPath("/host/mini-games")),
  startHostMiniGame: (payload) =>
    request(roomPath("/host/mini-games"), { method: "POST", body: payload, idempotent: true }),
  forceCompleteHostMiniGame: (gameId) =>
    request(roomPath(`/host/mini-games/${gameId}/force-complete`), { method: "POST", body: {}, idempotent: true }),
  hostUpdatePrivateAction: (actionId, payload) =>
    request(roomPath(`/host/private-actions/${actionId}`), { method: "PATCH", body: payload }),
  hostUpdateRoleState: (roleSlotId, payload) =>
    request(roomPath(`/host/players/${roleSlotId}/state`), { method: "PATCH", body: payload }),
  getRoomRunReport: () => request(roomPath("/run-report")),
  previewRoomRules: () => request(roomPath("/rules/preview")),
  triggerManualRule: (ruleId) => request(roomPath(`/rules/${ruleId}/trigger`), { method: "POST", idempotent: true }),

  hostGrantClue: (payload) => request(roomPath("/host/grant-clue"), { method: "POST", body: payload, idempotent: true }),
  hostRevokeClue: (payload) => request(roomPath("/host/revoke-clue"), { method: "POST", body: payload, idempotent: true }),
  hostResendClue: (payload) => request(roomPath("/host/resend-clue"), { method: "POST", body: payload, idempotent: true }),
  hostGrantItem: (payload) => request(roomPath("/host/grant-item"), { method: "POST", body: payload, idempotent: true }),
  hostUnlockSection: (payload) =>
    request(roomPath("/host/unlock-section"), { method: "POST", body: payload, idempotent: true }),
  hostRelockSection: (payload) =>
    request(roomPath("/host/relock-section"), { method: "POST", body: payload, idempotent: true }),
  hostSkipSection: (payload) =>
    request(roomPath("/host/skip-section"), { method: "POST", body: payload, idempotent: true }),
  hostUnlockScene: (sceneId) => request(roomPath(`/scenes/${sceneId}/unlock`), { method: "POST", idempotent: true }),
  hostAddLog: (payload) => request(roomPath("/host/log"), { method: "POST", body: payload, idempotent: true }),
  hostNudgeWaiting: (payload) => request(roomPath("/host/nudge-waiting"), { method: "POST", body: payload, idempotent: true }),
  hostSaveNotes: (roleSlotId, notes) =>
    request(roomPath(`/host/players/${roleSlotId}/notes`), { method: "PUT", body: { notes }, idempotent: true }),
  hostKickPlayer: (roleSlotId) =>
    request(roomPath(`/host/players/${roleSlotId}/kick`), { method: "POST", idempotent: true }),
  hostClueNote: (clueId, payload) =>
    request(roomPath(`/host/clues/${clueId}/notes`), { method: "PUT", body: payload, idempotent: true }),

  executeHostEvent: (eventId, roomId = getRoomId(), idempotencyKey = "") =>
    request(roomPathFor(roomId, `/host-events/${eventId}/execute`), {
      method: "POST",
      idempotent: true,
      idempotencyKey
    }),
  dismissHostEvent: (eventId, roomId = getRoomId(), idempotencyKey = "") =>
    request(roomPathFor(roomId, `/host-events/${eventId}/dismiss`), {
      method: "POST",
      idempotent: true,
      idempotencyKey
    }),
  delayHostEvent: (eventId, delayMinutes, roomId = getRoomId(), idempotencyKey = "") =>
    request(roomPathFor(roomId, `/host-events/${eventId}/delay`), {
      method: "POST",
      body: { delayMinutes },
      idempotent: true,
      idempotencyKey
    }),
  batchHostEvents: (action, eventIds) =>
    request(roomPath("/host-events/batch"), { method: "POST", body: { action, eventIds }, idempotent: true }),

  getRoomCheckpoints: (roomId = getRoomId()) => request(roomPathFor(roomId, "/checkpoints")),
  getRoomRecaps: (roomId = getRoomId()) => request(roomPathFor(roomId, "/recaps")),
  createCheckpoint: (payload, roomId = getRoomId(), idempotencyKey = "") =>
    request(roomPathFor(roomId, "/checkpoints"), {
      method: "POST",
      body: payload,
      idempotent: true,
      idempotencyKey,
      timeoutMs: 45_000
    }),
  createRecap: (payload, roomId = getRoomId(), idempotencyKey = "") =>
    request(roomPathFor(roomId, "/recaps"), {
      method: "POST",
      body: payload,
      idempotent: true,
      idempotencyKey,
      timeoutMs: 45_000
    }),

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

  streamRoomEvents(roomId, onEvent, signal, userId) {
    return portal.streamRoomEvents({
      roomId,
      onEvent,
      signal,
      cursorKey: sseCursorKey(roomId, userId)
    });
  }
};

export function context() {
  return { worldId: getWorldId(), roomId: getRoomId() };
}
