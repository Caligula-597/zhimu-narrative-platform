import {
  createPortalApiClient,
  createPortalJsonError,
  resolveVitePortalApiBase
} from "../../shared/api-client.js";
import { createSessionTokenStore } from "../../shared/session-token.js";

const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN || "https://app.getzhimu.com").replace(/\/$/, "");
const API_BASE = resolveVitePortalApiBase({
  viteAppOrigin: APP_ORIGIN,
  viteApiOrigin: import.meta.env.VITE_API_ORIGIN,
  dev: import.meta.env.DEV
});

const sessionToken = createSessionTokenStore("zhimuSessionToken");

/** Play 部署在 play.*，API 在 app.*；SameSite=Lax 的 HttpOnly Cookie 不会随跨站 fetch 发送，故始终用 Bearer。 */
function sseCursorKey(roomId) {
  return `zhimuPlaySseCursor:${roomId}`;
}

const PLATFORM_SSE_CURSOR = "zhimuPlayPlatformSseCursor";

const portal = createPortalApiClient({
  baseUrl: API_BASE,
  tokenStore: sessionToken,
  getDemoUserId: () => localStorage.getItem("zhimuDemoUserId"),
  mapHttpError: createPortalJsonError
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
  playerHomeCore: (roomId) => request(`/rooms/${roomId}/player-home/core`),
  playerHomeSocial: (roomId, currentActKey = "ch1") =>
    request(`/rooms/${roomId}/player-home/social?currentActKey=${encodeURIComponent(currentActKey)}`),
  playerVotes: (roomId) => request(`/rooms/${roomId}/votes`),
  submitVoteBallot: (roomId, voteId, payload) =>
    request(`/rooms/${roomId}/votes/${voteId}/ballots`, { method: "POST", body: payload }),
  privateActions: (roomId) => request(`/rooms/${roomId}/private-actions`),
  createPrivateAction: (roomId, payload) =>
    request(`/rooms/${roomId}/private-actions`, { method: "POST", body: payload }),
  startSection: (roomId, sectionId) =>
    request(`/rooms/${roomId}/sections/${sectionId}/start`, { method: "POST", body: {} }),
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
  myTimeline: (roomId) => request(`/rooms/${roomId}/my-timeline`),
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

  streamRoomEvents(roomId, onEvent, signal) {
    return portal.streamRoomEvents({ roomId, onEvent, signal, cursorKey: sseCursorKey(roomId) });
  },

  streamPlatformEvents(onEvent, signal) {
    return portal.streamPlatformEvents({ onEvent, signal, cursorKey: PLATFORM_SSE_CURSOR });
  }
};
