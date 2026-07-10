/**
 * Player domain — exploration, clues, notebook, room join.
 */
import { demoContext, request } from "./client.js";

export function getPlayerHome() {
  return request(`/rooms/${demoContext.roomId}/player-home`, { userId: demoContext.playerUserId });
}

export function getRoomInvite(inviteCode) {
  return request(`/rooms/invite/${encodeURIComponent(inviteCode)}`, { userId: demoContext.playerUserId });
}

export function joinRoom(inviteCode, roleSlotId) {
  return request("/rooms/join", { userId: demoContext.playerUserId, method: "POST", body: { inviteCode, roleSlotId } });
}

export function completeSection(sectionId) {
  return request(`/rooms/${demoContext.roomId}/sections/${sectionId}/complete`, { userId: demoContext.playerUserId, method: "POST", idempotent: true });
}

export function startSection(sectionId) {
  return request(`/rooms/${demoContext.roomId}/sections/${sectionId}/start`, { userId: demoContext.playerUserId, method: "POST", idempotent: true });
}

export function addNotebookEntry(entry) {
  return request(`/rooms/${demoContext.roomId}/notebook`, { userId: demoContext.playerUserId, method: "POST", body: entry });
}

export function deleteNotebookEntry(entryId) {
  return request(`/rooms/${demoContext.roomId}/notebook/${entryId}`, { userId: demoContext.playerUserId, method: "DELETE" });
}

export function getExploration() {
  return request(`/rooms/${demoContext.roomId}/exploration`, { userId: demoContext.playerUserId });
}

export function investigate(pointId) {
  return request(`/rooms/${demoContext.roomId}/investigation-points/${pointId}/investigate`, { userId: demoContext.playerUserId, method: "POST", idempotent: true });
}

export function readClue(clueId) {
  return request(`/rooms/${demoContext.roomId}/clues/${clueId}/read`, { userId: demoContext.playerUserId, method: "POST" });
}

export function shareClueToRoom(clueId, shared = true) {
  return request(`/rooms/${demoContext.roomId}/clues/${clueId}/share-room`, { userId: demoContext.playerUserId, method: "POST", body: { shared }, idempotent: true });
}

export function shareClueToRoles(clueId, roleSlotIds) {
  return request(`/rooms/${demoContext.roomId}/clues/${clueId}/share-roles`, { userId: demoContext.playerUserId, method: "POST", body: { roleSlotIds }, idempotent: true });
}

export function updateCluePlayerNote(clueId, note) {
  return request(`/rooms/${demoContext.roomId}/clues/${clueId}/player-note`, { userId: demoContext.playerUserId, method: "PATCH", body: { note } });
}

export function getPlayerVotes(roomId = demoContext.roomId) {
  return request(`/rooms/${roomId}/votes`, { userId: demoContext.playerUserId });
}

export function submitVoteBallot(voteId, payload, roomId = demoContext.roomId) {
  return request(`/rooms/${roomId}/votes/${voteId}/ballots`, {
    userId: demoContext.playerUserId,
    method: "POST",
    body: payload
  });
}

export function getPrivateActions(roomId = demoContext.roomId) {
  return request(`/rooms/${roomId}/private-actions`, { userId: demoContext.playerUserId });
}

export function createPrivateAction(payload, roomId = demoContext.roomId) {
  return request(`/rooms/${roomId}/private-actions`, {
    userId: demoContext.playerUserId,
    method: "POST",
    body: payload
  });
}

export function updateSuspicion(targetRoleSlotId, payload, roomId = demoContext.roomId) {
  return request(`/rooms/${roomId}/suspicions/${targetRoleSlotId}`, {
    userId: demoContext.playerUserId,
    method: "PUT",
    body: { level: payload?.level, reason: payload?.reason ?? "" }
  });
}
