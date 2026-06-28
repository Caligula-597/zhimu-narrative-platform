/**
 * Host domain — in-room host operations: players, clues, events, mini-games, rules.
 */
import { demoContext, request } from "./client.js";

export function getHostProgress() {
  return request(`/rooms/${demoContext.roomId}/host-progress`, { userId: demoContext.hostUserId });
}

export function getHostPlayers() {
  return request(`/rooms/${demoContext.roomId}/host/players`, { userId: demoContext.hostUserId });
}

export function getHostPlayerDetail(roleSlotId) {
  return request(`/rooms/${demoContext.roomId}/host/players/${roleSlotId}`, { userId: demoContext.hostUserId });
}

export function hostGrantClue(payload) {
  return request(`/rooms/${demoContext.roomId}/host/grant-clue`, { userId: demoContext.hostUserId, method: "POST", body: payload, idempotent: true });
}

export function hostGrantItem(payload) {
  return request(`/rooms/${demoContext.roomId}/host/grant-item`, { userId: demoContext.hostUserId, method: "POST", body: payload, idempotent: true });
}

export function hostUnlockSection(payload) {
  return request(`/rooms/${demoContext.roomId}/host/unlock-section`, { userId: demoContext.hostUserId, method: "POST", body: payload, idempotent: true });
}

export function hostUnlockScene(sceneId) {
  return request(`/rooms/${demoContext.roomId}/scenes/${sceneId}/unlock`, { userId: demoContext.hostUserId, method: "POST" });
}

export function hostAddLog(payload) {
  return request(`/rooms/${demoContext.roomId}/host/log`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function hostNudgeWaiting(payload) {
  return request(`/rooms/${demoContext.roomId}/host/nudge-waiting`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function hostSaveNotes(roleSlotId, notes) {
  return request(`/rooms/${demoContext.roomId}/host/players/${roleSlotId}/notes`, { userId: demoContext.hostUserId, method: "PUT", body: { notes } });
}

export function hostKickPlayer(roleSlotId) {
  return request(`/rooms/${demoContext.roomId}/host/players/${roleSlotId}/kick`, { userId: demoContext.hostUserId, method: "POST", idempotent: true });
}

export function getHostClueMatrix() {
  return request(`/rooms/${demoContext.roomId}/host/clue-matrix`, { userId: demoContext.hostUserId });
}

export function hostClueNote(clueId, payload) {
  return request(`/rooms/${demoContext.roomId}/host/clues/${clueId}/notes`, { userId: demoContext.hostUserId, method: "PUT", body: payload });
}

export function getHostEvents() {
  return request(`/rooms/${demoContext.roomId}/host-events`, { userId: demoContext.hostUserId });
}

export function getHostAuditLog(limit = 50) {
  return request(`/rooms/${demoContext.roomId}/host/audit-log?limit=${limit}`, { userId: demoContext.hostUserId });
}

export function hostStartMiniGame(payload) {
  return request(`/rooms/${demoContext.roomId}/host/mini-games`, { userId: demoContext.hostUserId, method: "POST", body: payload, idempotent: true });
}

export function hostForceCompleteMiniGame(gameId) {
  return request(`/rooms/${demoContext.roomId}/host/mini-games/${gameId}/force-complete`, { userId: demoContext.hostUserId, method: "POST", body: {} });
}

export function executeHostEvent(eventId) {
  return request(`/rooms/${demoContext.roomId}/host-events/${eventId}/execute`, { userId: demoContext.hostUserId, method: "POST", idempotent: true });
}

export function dismissHostEvent(eventId) {
  return request(`/rooms/${demoContext.roomId}/host-events/${eventId}/dismiss`, { userId: demoContext.hostUserId, method: "POST", idempotent: true });
}

export function delayHostEvent(eventId, delayMinutes) {
  return request(`/rooms/${demoContext.roomId}/host-events/${eventId}/delay`, { userId: demoContext.hostUserId, method: "POST", body: { delayMinutes }, idempotent: true });
}

export function batchHostEvents(action, eventIds) {
  return request(`/rooms/${demoContext.roomId}/host-events/batch`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: { action, eventIds },
    idempotent: true
  });
}

export function previewRoomRules(roomId = demoContext.roomId) {
  return request(`/rooms/${roomId}/rules/preview`, { userId: demoContext.hostUserId });
}

export function triggerManualRule(ruleId, roomId = demoContext.roomId) {
  return request(`/rooms/${roomId}/rules/${ruleId}/trigger`, { userId: demoContext.hostUserId, method: "POST", idempotent: true });
}
