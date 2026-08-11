import {
  createPortalApiClient,
  createPortalJsonError,
  resolveVitePortalApiBase
} from "../../shared/api-client.js";
import { createSessionTokenStore } from "../../shared/session-token.js";
import { scopedSseCursorKey } from "../../shared/sse-client.js";

const viteEnv = import.meta.env || {};
const APP_ORIGIN = (
  viteEnv.VITE_APP_ORIGIN
  || (viteEnv.DEV ? "http://127.0.0.1:4173" : "https://app.getzhimu.com")
).replace(/\/$/, "");
const API_BASE = resolveVitePortalApiBase({
  viteAppOrigin: APP_ORIGIN,
  viteApiOrigin: viteEnv.VITE_API_ORIGIN,
  dev: viteEnv.DEV
});

const sessionToken = createSessionTokenStore("zhimuSessionToken");

/** HttpOnly Cookie is authoritative; the Bearer fallback is scoped to this browser tab. */
function sseCursorKey(roomId, userId) {
  return scopedSseCursorKey("zhimuPlaySseCursor", roomId, userId);
}

function platformSseCursorKey(userId) {
  return scopedSseCursorKey("zhimuPlayPlatformSseCursor", userId);
}

const portal = createPortalApiClient({
  baseUrl: API_BASE,
  tokenStore: sessionToken,
  getDemoUserId: () => localStorage.getItem("zhimuDemoUserId"),
  mapHttpError: createPortalJsonError,
  clearTokenOn401: true
});

const { request } = portal;

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

export function subscribeSessionToken(listener) {
  return sessionToken.subscribe(listener);
}

export function hasSession() {
  return Boolean(sessionToken.get());
}

export const api = {
  authConfig: () => request("/auth/config"),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST", body: {} }),
  guest: (displayName) => request("/auth/guest", { method: "POST", body: { displayName } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  register: (email, displayName, password) =>
    request("/auth/register", { method: "POST", body: { email, displayName, password } }),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token, password) =>
    request("/auth/reset-password", { method: "POST", body: { token, password } }),
  verifyEmail: (token) => request("/auth/verify-email", { method: "POST", body: { token } }),
  verifyEmailCode: (challengeId, code) =>
    request("/auth/verify-email-code", { method: "POST", body: { challengeId, code } }),
  resendVerificationCode: (challengeId) =>
    request("/auth/resend-verification-code", {
      method: "POST",
      body: challengeId ? { challengeId } : {}
    }),
  resendVerification: () => request("/auth/resend-verification", { method: "POST", body: {} }),
  oauthStartUrl: (provider, returnOrigin) =>
    request(`/auth/oauth/${provider}/start-url`, {
      method: "POST",
      body: returnOrigin ? { returnOrigin } : {}
    }),
  oauthComplete: (code) => request("/auth/oauth/complete", { method: "POST", body: { code } }),
  getPortalProfile: (portal = "player") => request(`/account/portal-profiles/${portal}`),
  checkPortalProfileName: (portal, displayName) =>
    request(`/account/portal-profiles/${portal}/name-availability?${new URLSearchParams({ displayName })}`),
  updatePortalProfileName: (portal, displayName) =>
    request(`/account/portal-profiles/${portal}/name`, {
      method: "PUT",
      body: { displayName }
    }),
  createPortalAvatarUpload: (portal, payload) =>
    request(`/account/portal-profiles/${portal}/avatar-upload-url`, {
      method: "POST",
      body: payload
    }),
  confirmPortalAvatar: (portal, uploadId) =>
    request(`/account/portal-profiles/${portal}/avatar/confirm`, {
      method: "POST",
      body: { uploadId }
    }),
  removePortalAvatar: (portal) =>
    request(`/account/portal-profiles/${portal}/avatar`, { method: "DELETE" }),
  lookupInvite: (inviteCode) => request(`/rooms/invite/${encodeURIComponent(inviteCode)}`),
  joinRoom: (inviteCode, roleSlotId) =>
    request("/rooms/join", { method: "POST", body: { inviteCode, roleSlotId } }),
  playerHome: (roomId) => request(`/rooms/${roomId}/player-home`),
  playerHomeCore: (roomId) => request(`/rooms/${roomId}/player-home/core`),
  playerHomeSocial: (roomId, currentActKey = "ch1") =>
    request(`/rooms/${roomId}/player-home/social?currentActKey=${encodeURIComponent(currentActKey)}`),
  playerCurrentState: (roomId) => request(`/rooms/${roomId}/current-state`),
  submitVoteBallot: (roomId, voteId, payload) =>
    request(`/rooms/${roomId}/votes/${voteId}/ballots`, { method: "POST", body: payload }),
  submitMechanismDecision: (roomId, decisionKey, payload) =>
    request(`/rooms/${roomId}/player/mechanism-decisions/${encodeURIComponent(decisionKey)}/submissions`, {
      method: "POST",
      body: payload,
      idempotent: true
    }),
  createPrivateAction: (roomId, payload) =>
    request(`/rooms/${roomId}/private-actions`, { method: "POST", body: payload }),
  startSection: (roomId, sectionId) =>
    request(`/rooms/${roomId}/sections/${sectionId}/start`, { method: "POST", body: {} }),
  completeSection: (roomId, sectionId) =>
    request(`/rooms/${roomId}/sections/${sectionId}/complete`, { method: "POST", body: {} }),
  exploration: (roomId) => request(`/rooms/${roomId}/exploration`),
  discoverySessions: (roomId) => request(`/rooms/${roomId}/discovery-sessions`),
  discoveryAction: (roomId, locationId, payload) =>
    request(`/rooms/${roomId}/discovery-sessions/${encodeURIComponent(locationId)}/actions`, {
      method: "POST",
      body: payload
    }),
  paceClock: (roomId) => request(`/rooms/${roomId}/pace-clock`),
  roomConclusion: (roomId) => request(`/rooms/${roomId}/conclusion`),
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
  myTimeline: (roomId) => request(`/rooms/${roomId}/my-timeline`),
  getVoiceMessages: (voiceRoomId) => request(`/voice-rooms/${voiceRoomId}/messages`),
  getVoiceSession: (roomId) => request(`/rooms/${roomId}/voice-session`),
  getVoiceRoomToken: (roomId, voiceRoomId) =>
    request(`/rooms/${roomId}/voice-rooms/${voiceRoomId}/token`, { method: "POST", body: {} }),
  sendVoiceMessage: (voiceRoomId, body) =>
    request(`/voice-rooms/${voiceRoomId}/messages`, { method: "POST", body: { body } }),
  createVoiceRoom: (roomId, payload) =>
    request(`/rooms/${roomId}/voice-rooms`, { method: "POST", body: payload, idempotent: true }),
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
  joinOfficialExample: () => request("/platform/official-example/join", { method: "POST", body: {} }),
  latestRecap: (roomId) => request(`/rooms/${roomId}/recap/latest`),
  getRecap: (roomId, recapId) => request(`/rooms/${roomId}/recaps/${recapId}`),
  recapLibrary: (filters = {}) => {
    const query = new URLSearchParams();
    if (filters.worldId) query.set("worldId", filters.worldId);
    if (filters.roleSlotId) query.set("roleSlotId", filters.roleSlotId);
    return request(`/account/recaps${query.size ? `?${query}` : ""}`);
  },
  recapLibraryDetail: (recapId) => request(`/account/recaps/${recapId}`),
  hideRecapLibraryEntry: (recapId) => request(`/account/recaps/${recapId}`, { method: "DELETE" }),
  updateRecapLibraryPreferences: (roomId, retentionDays) =>
    request(`/account/recaps/preferences/${roomId}`, {
      method: "PUT",
      body: { retentionDays }
    }),
  completePlayerTask: (roomId, taskId) =>
    request(`/rooms/${roomId}/player-tasks/${taskId}/complete`, { method: "POST", body: {} }),
  setSuspicion: (roomId, targetRoleSlotId, payload) =>
    request(`/rooms/${roomId}/suspicions/${targetRoleSlotId}`, { method: "PUT", body: payload }),
  submitTestimony: (roomId, payload) =>
    request(`/rooms/${roomId}/testimonies`, { method: "POST", body: payload }),
  submitSatisfaction: (payload) =>
    request("/feedback", {
      method: "POST",
      body: {
        kind: "satisfaction",
        subject: payload.subject,
        body: payload.body,
        roomId: payload.roomId
      }
    }),

  streamRoomEvents(roomId, onEvent, signal, userId) {
    return portal.streamRoomEvents({ roomId, onEvent, signal, cursorKey: sseCursorKey(roomId, userId) });
  },

  streamPlatformEvents(onEvent, signal, userId) {
    return portal.streamPlatformEvents({ onEvent, signal, cursorKey: platformSseCursorKey(userId) });
  }
};
