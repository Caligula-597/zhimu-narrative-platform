/**
 * Room event type registry + payload validation.
 *
 * Every event published via publishRoomEvent must match a registered type and
 * carry its required fields. This catches event-type typos and missing payload
 * data before the event reaches SSE subscribers or the journal.
 *
 * Test-only types use the `room.test_*` / `room.dev_*` prefix and bypass
 * field-level validation (only the data object shape is checked).
 */

const uuidLike = { type: "string", minLength: 1, maxLength: 200 };
const nonEmptyString = { type: "string", minLength: 1, maxLength: 2000 };
const stringList = { type: "array", items: uuidLike, maxItems: 100 };
const sourceEnum = {
  type: "string",
  enum: [
    "rule",
    "manual_rule",
    "host_manual",
    "host_event",
    "investigation",
    "shared_room",
    "shared_roles",
    "physical_token"
  ]
};

/**
 * Each entry declares:
 * - required: fields that MUST be present and non-null
 * - optional: fields that MAY be present (documented for completeness)
 * - types: field → type-spec for basic runtime type checks
 */
const EVENT_SCHEMAS = {
  "room.host_event_pending": {
    required: ["eventId"],
    optional: ["action", "delayMinutes", "title", "source"],
    types: {
      eventId: uuidLike,
      action: { type: "string", enum: ["delay_expired", "dismissed", "executed", "delayed"] },
      delayMinutes: { type: "number" },
      title: nonEmptyString,
      source: { type: "string", maxLength: 80 }
    }
  },
  "room.host_nudge": {
    required: ["message", "roleSlotIds"],
    optional: [],
    types: {
      message: nonEmptyString,
      roleSlotIds: stringList
    }
  },
  "room.player_joined": {
    required: ["roleSlotId", "roleName"],
    optional: [],
    types: {
      roleSlotId: uuidLike,
      roleName: nonEmptyString
    }
  },
  "room.player_kicked": {
    required: ["roleSlotId", "userId", "roleName"],
    optional: [],
    types: {
      roleSlotId: uuidLike,
      userId: uuidLike,
      roleName: nonEmptyString
    }
  },
  "room.voice_message_created": {
    required: ["voiceRoomId", "messageId"],
    optional: [],
    types: {
      voiceRoomId: uuidLike,
      messageId: uuidLike
    }
  },
  "room.physical_token_event": {
    required: ["tokenId", "tokenCode", "message"],
    optional: [],
    types: {
      tokenId: uuidLike,
      tokenCode: { type: "string", minLength: 1, maxLength: 64 },
      message: nonEmptyString
    }
  },
  "room.physical_token_activated": {
    required: ["tokenId", "tokenCode", "contentType", "contentId", "roleSlotId", "effect"],
    optional: [],
    types: {
      tokenId: uuidLike,
      tokenCode: { type: "string", minLength: 1, maxLength: 64 },
      contentType: { type: "string", enum: ["clue", "item", "script_section", "event"] },
      contentId: uuidLike,
      roleSlotId: uuidLike,
      effect: { type: "object" }
    }
  },
  "room.scene_unlocked": {
    required: ["sceneId", "source"],
    optional: ["sceneName"],
    types: {
      sceneId: uuidLike,
      sceneName: nonEmptyString,
      source: sourceEnum
    }
  },
  "room.section_unlocked": {
    required: ["scriptSectionId", "source"],
    optional: ["roleSlotId"],
    types: {
      scriptSectionId: uuidLike,
      roleSlotId: uuidLike,
      source: sourceEnum
    }
  },
  "room.section_completed": {
    required: ["sectionId", "roleSlotId"],
    optional: [],
    types: {
      sectionId: uuidLike,
      roleSlotId: uuidLike
    }
  },
  "room.clue_granted": {
    required: ["clueId"],
    optional: ["roleSlotId", "source", "clueName", "pointId", "ownerRoleSlotId"],
    types: {
      clueId: uuidLike,
      roleSlotId: uuidLike,
      source: sourceEnum,
      clueName: nonEmptyString,
      pointId: uuidLike,
      ownerRoleSlotId: uuidLike
    }
  },
  "room.item_granted": {
    required: ["itemId", "roleSlotId", "source"],
    optional: ["itemName"],
    types: {
      itemId: uuidLike,
      roleSlotId: uuidLike,
      source: sourceEnum,
      itemName: nonEmptyString
    }
  },
  "room.game_started": {
    required: ["currentGame"],
    optional: [],
    types: {
      currentGame: { type: "object" }
    }
  },
  "room.game_completed": {
    required: ["currentGame"],
    optional: ["forced", "correct"],
    types: {
      currentGame: { type: "object" },
      forced: { type: "boolean" },
      correct: { type: "boolean" }
    }
  },
  "room.game_updated": {
    required: ["currentGame", "correct"],
    optional: [],
    types: {
      currentGame: { type: "object" },
      correct: { type: "boolean" }
    }
  },
  "room.checkpoint_restored": {
    required: ["checkpointId", "restoreId", "sourceRoomId", "crossRoom"],
    optional: [],
    types: {
      checkpointId: uuidLike,
      restoreId: uuidLike,
      sourceRoomId: uuidLike,
      crossRoom: { type: "boolean" }
    }
  },
  "room.investigation_completed": {
    required: ["pointId", "roleSlotId"],
    optional: [],
    types: {
      pointId: uuidLike,
      roleSlotId: uuidLike
    }
  },
  "room.vote_created": {
    required: ["voteId", "title", "status"],
    optional: [],
    types: {
      voteId: uuidLike,
      title: nonEmptyString,
      status: { type: "string", enum: ["draft", "open", "closed", "published", "cancelled"] }
    }
  },
  "room.vote_updated": {
    required: ["voteId", "action"],
    optional: [],
    types: {
      voteId: uuidLike,
      action: { type: "string", minLength: 1, maxLength: 80 }
    }
  },
  "room.private_action_submitted": {
    required: ["actionId", "actionType"],
    optional: [],
    types: {
      actionId: uuidLike,
      actionType: { type: "string", enum: ["ask_host", "secret_action", "trade", "promise", "accusation_note"] }
    }
  },
  "room.private_action_updated": {
    required: ["actionId", "status"],
    optional: [],
    types: {
      actionId: uuidLike,
      status: { type: "string", enum: ["seen", "accepted", "rejected", "resolved", "cancelled"] }
    }
  },
  "room.role_state_updated": {
    required: ["roleSlotId"],
    optional: [],
    types: {
      roleSlotId: uuidLike
    }
  }
};

const TEST_TYPE_PREFIXES = ["room.test_", "room.dev_"];

/**
 * Validate a room event before publishing.
 *
 * @param {string} type - Event type (e.g. "room.player_joined")
 * @param {*} data - Event payload object
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateRoomEvent(type, data) {
  const errors = [];

  if (typeof type !== "string" || type.length === 0) {
    return { ok: false, errors: ["Event type must be a non-empty string"] };
  }

  // Test/dev-prefixed types bypass field validation but must carry an object payload.
  if (TEST_TYPE_PREFIXES.some((prefix) => type.startsWith(prefix))) {
    if (data != null && typeof data !== "object") {
      return { ok: false, errors: [`Event data for ${type} must be an object`] };
    }
    return { ok: true, errors: [] };
  }

  const schema = EVENT_SCHEMAS[type];
  if (!schema) {
    return { ok: false, errors: [`Unknown room event type: ${type}`] };
  }

  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, errors: [`Event data for ${type} must be a plain object`] };
  }

  for (const field of schema.required) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Basic runtime type checks for declared fields (required + optional).
  const declared = { ...schema.types };
  for (const [field, spec] of Object.entries(declared)) {
    const value = data[field];
    if (value === undefined || value === null) continue;
    const typeError = checkFieldType(field, value, spec);
    if (typeError) errors.push(typeError);
  }

  return { ok: errors.length === 0, errors };
}

function checkFieldType(field, value, spec) {
  if (spec.type === "string") {
    if (typeof value !== "string") return `Field ${field} must be a string`;
    if (spec.minLength != null && value.length < spec.minLength) {
      return `Field ${field} is too short (min ${spec.minLength})`;
    }
    if (spec.maxLength != null && value.length > spec.maxLength) {
      return `Field ${field} is too long (max ${spec.maxLength})`;
    }
    if (spec.enum && !spec.enum.includes(value)) {
      return `Field ${field} must be one of: ${spec.enum.join(", ")}`;
    }
    return null;
  }
  if (spec.type === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return `Field ${field} must be a number`;
    }
    return null;
  }
  if (spec.type === "boolean") {
    if (typeof value !== "boolean") return `Field ${field} must be a boolean`;
    return null;
  }
  if (spec.type === "array") {
    if (!Array.isArray(value)) return `Field ${field} must be an array`;
    if (spec.maxItems != null && value.length > spec.maxItems) {
      return `Field ${field} exceeds max items (${spec.maxItems})`;
    }
    return null;
  }
  if (spec.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return `Field ${field} must be an object`;
    }
    return null;
  }
  return null;
}

/**
 * List all registered event types (for documentation / ops introspection).
 */
export function listRegisteredEventTypes() {
  return Object.keys(EVENT_SCHEMAS).sort();
}

/**
 * Get the schema definition for a specific event type.
 */
export function getRoomEventSchema(type) {
  return EVENT_SCHEMAS[type] ?? null;
}
