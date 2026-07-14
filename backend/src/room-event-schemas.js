import {
  getRoomEventSchema,
  listRoomEventTypes,
  ROOM_EVENT_SCHEMAS,
  validateRoomEvent as validateSharedRoomEvent
} from "../../shared/contracts/room-events.js";

const TEST_TYPE_PREFIXES = ["room.test_", "room.dev_"];

/** Production contracts are shared; test/dev probes remain backend-only. */
export function validateRoomEvent(type, data) {
  if (typeof type !== "string" || type.length === 0) {
    return { ok: false, errors: ["Event type must be a non-empty string"] };
  }
  if (TEST_TYPE_PREFIXES.some((prefix) => type.startsWith(prefix))) {
    if (data != null && (typeof data !== "object" || Array.isArray(data))) {
      return { ok: false, errors: [`Event data for ${type} must be an object`] };
    }
    return { ok: true, errors: [] };
  }
  return validateSharedRoomEvent(type, data);
}

export function listRegisteredEventTypes() {
  return listRoomEventTypes();
}

export { getRoomEventSchema, ROOM_EVENT_SCHEMAS };
