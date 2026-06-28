/**
 * Voice room domain — voice rooms and messages.
 */
import { demoContext, request } from "./client.js";

export function getVoiceMessages(voiceRoomId) {
  return request(`/voice-rooms/${voiceRoomId}/messages`, { userId: demoContext.playerUserId });
}

export function getVoiceRoomToken(voiceRoomId, userId = demoContext.playerUserId) {
  return request(`/rooms/${demoContext.roomId}/voice-rooms/${voiceRoomId}/token`, { userId, method: "POST", body: {} });
}

export function sendVoiceMessage(voiceRoomId, body) {
  return request(`/voice-rooms/${voiceRoomId}/messages`, { userId: demoContext.playerUserId, method: "POST", body: { body } });
}

export function createVoiceRoom(payload) {
  return request(`/rooms/${demoContext.roomId}/voice-rooms`, { userId: demoContext.playerUserId, method: "POST", body: payload });
}

export function inviteVoiceRoomMembers(voiceRoomId, inviteUserIds) {
  return request(`/voice-rooms/${voiceRoomId}/members`, { userId: demoContext.playerUserId, method: "POST", body: { inviteUserIds } });
}
