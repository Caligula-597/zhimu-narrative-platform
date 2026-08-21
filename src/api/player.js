/** Creator-side handoff into the standalone Player portal. */
import { demoContext, request } from "./client.js";

export function getRoomInvite(inviteCode) {
  return request(`/rooms/invite/${encodeURIComponent(inviteCode)}`, { userId: demoContext.playerUserId });
}

export function joinRoom(inviteCode, roleSlotId) {
  return request("/rooms/join", { userId: demoContext.playerUserId, method: "POST", body: { inviteCode, roleSlotId } });
}
