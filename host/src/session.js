import { defaultSessionTokenStore } from "../../shared/session-token.js";

const WORLD_KEY = "zhimuHostWorldId";
const ROOM_PREFIX = "zhimuHostRoomId:";

export function getSessionToken() {
  return defaultSessionTokenStore.get();
}

export function setSessionToken(token) {
  defaultSessionTokenStore.set(token || "");
}

export function subscribeSessionToken(listener) {
  return defaultSessionTokenStore.subscribe(listener);
}

export function getWorldId() {
  return localStorage.getItem(WORLD_KEY) || "";
}

export function setWorldId(worldId) {
  if (worldId) localStorage.setItem(WORLD_KEY, worldId);
  else localStorage.removeItem(WORLD_KEY);
}

export function getRoomId(worldId = getWorldId()) {
  if (!worldId) return "";
  return localStorage.getItem(`${ROOM_PREFIX}${worldId}`) || "";
}

export function setRoomId(worldId, roomId) {
  if (!worldId) return;
  if (roomId) localStorage.setItem(`${ROOM_PREFIX}${worldId}`, roomId);
  else localStorage.removeItem(`${ROOM_PREFIX}${worldId}`);
}
