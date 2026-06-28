/**
 * Recap & checkpoint domain — room checkpoints and recaps.
 */
import { demoContext, request } from "./client.js";

export function getCheckpoints() {
  return request(`/rooms/${demoContext.roomId}/checkpoints`, { userId: demoContext.hostUserId });
}

export function getCheckpoint(checkpointId) {
  return request(`/rooms/${demoContext.roomId}/checkpoints/${checkpointId}`, { userId: demoContext.hostUserId });
}

export function getCheckpointRestores(checkpointId) {
  return request(`/rooms/${demoContext.roomId}/checkpoints/${checkpointId}/restores`, { userId: demoContext.hostUserId });
}

export function createCheckpoint(payload) {
  return request(`/rooms/${demoContext.roomId}/checkpoints`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function restoreCheckpoint(checkpointId, { scope, targetRoomId } = {}) {
  return request(`/rooms/${targetRoomId || demoContext.roomId}/checkpoints/${checkpointId}/restore`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: { scope },
    idempotent: true
  });
}

export function getRecaps() {
  return request(`/rooms/${demoContext.roomId}/recaps`, { userId: demoContext.hostUserId });
}

export function getRecap(recapId, asPlayer = false) {
  return request(`/rooms/${demoContext.roomId}/recaps/${recapId}`, { userId: asPlayer ? demoContext.playerUserId : demoContext.hostUserId });
}

export function getLatestRecap(asPlayer = false) {
  return request(`/rooms/${demoContext.roomId}/recap/latest`, { userId: asPlayer ? demoContext.playerUserId : demoContext.hostUserId });
}

export function createRecap(payload) {
  return request(`/rooms/${demoContext.roomId}/recaps`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}
