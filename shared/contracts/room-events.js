/**
 * Room SSE event type constants — keep in sync with backend/src/room-event-schemas.js.
 * Used by app / play / host clients for switch/case exhaustiveness checks.
 */
export const ROOM_EVENT_TYPES = Object.freeze([
  "room.host_event_pending",
  "room.host_nudge",
  "room.player_joined",
  "room.player_kicked",
  "room.voice_message_created",
  "room.physical_token_event",
  "room.physical_token_activated",
  "room.scene_unlocked",
  "room.section_unlocked",
  "room.section_completed",
  "room.clue_granted",
  "room.item_granted",
  "room.game_started",
  "room.game_completed",
  "room.game_updated",
  "room.checkpoint_restored",
  "room.investigation_completed",
  "room.vote_created",
  "room.vote_updated",
  "room.private_action_submitted",
  "room.private_action_updated",
  "room.role_state_updated"
]);

/** @param {string} type */
export function isRoomEventType(type) {
  return ROOM_EVENT_TYPES.includes(type);
}
