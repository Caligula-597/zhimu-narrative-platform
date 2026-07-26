import { validateEventPayload } from "./event-schema-validator.js";

const id = Object.freeze({ type: "string", minLength: 1, maxLength: 200 });
const text = Object.freeze({ type: "string", minLength: 1, maxLength: 2000 });
const shortText = Object.freeze({ type: "string", minLength: 1, maxLength: 80 });
const tokenCode = Object.freeze({ type: "string", minLength: 1, maxLength: 64 });
const boolean = Object.freeze({ type: "boolean" });
const number = Object.freeze({ type: "number" });
const object = Object.freeze({ type: "object", additionalProperties: true });
const idList = Object.freeze({ type: "array", items: id, maxItems: 100 });
const source = Object.freeze({
  type: "string",
  enum: Object.freeze([
    "rule",
    "manual_rule",
    "host_manual",
    "host_event",
    "investigation",
    "shared_room",
    "shared_roles",
    "physical_token"
  ])
});

function enumString(values) {
  return Object.freeze({ type: "string", enum: Object.freeze(values) });
}

function schema(required, properties) {
  return Object.freeze({
    type: "object",
    required: Object.freeze(required),
    properties: Object.freeze(properties),
    additionalProperties: true
  });
}

/** Shared runtime and type-generation source for all production Room SSE payloads. */
export const ROOM_EVENT_SCHEMAS = Object.freeze({
  "room.host_event_pending": schema(["eventId"], {
    eventId: id,
    action: enumString(["delay_expired", "dismissed", "executed", "delayed"]),
    delayMinutes: number,
    title: text,
    source: shortText
  }),
  "room.host_nudge": schema(["message", "roleSlotIds"], { message: text, roleSlotIds: idList }),
  "room.host_log_created": schema(["logId", "eventType"], {
    logId: id,
    eventType: shortText,
    roleSlotId: id
  }),
  "room.host_player_notes_updated": schema(["roleSlotId", "updatedAt"], {
    roleSlotId: id,
    updatedAt: text
  }),
  "room.player_joined": schema(["roleSlotId", "roleName"], { roleSlotId: id, roleName: text }),
  "room.player_kicked": schema(["roleSlotId", "userId", "roleName"], {
    roleSlotId: id,
    userId: id,
    roleName: text
  }),
  "room.voice_message_created": schema(["voiceRoomId", "messageId"], {
    voiceRoomId: id,
    messageId: id,
    audience: enumString(["room", "restricted"]),
    audienceUserIds: idList
  }),
  "room.physical_token_event": schema(["tokenId", "tokenCode", "message"], {
    tokenId: id,
    tokenCode,
    message: text,
    visibility: enumString(["public", "host"])
  }),
  "room.physical_token_activated": schema(
    ["tokenId", "tokenCode", "contentType", "contentId", "roleSlotId", "effect"],
    {
      tokenId: id,
      tokenCode,
      contentType: enumString(["clue", "item", "script_section", "event"]),
      contentId: id,
      roleSlotId: id,
      effect: object
    }
  ),
  "room.scene_unlocked": schema(["sceneId", "source"], { sceneId: id, sceneName: text, source }),
  "room.section_unlocked": schema(["scriptSectionId", "source"], {
    scriptSectionId: id,
    roleSlotId: id,
    source
  }),
  "room.section_relocked": schema(["sectionId", "roleSlotId", "source"], {
    sectionId: id,
    roleSlotId: id,
    source
  }),
  "room.section_skipped": schema(["sectionId", "roleSlotId", "source"], {
    sectionId: id,
    roleSlotId: id,
    source
  }),
  "room.section_completed": schema(["sectionId", "roleSlotId"], { sectionId: id, roleSlotId: id }),
  "room.clue_granted": schema(["clueId"], {
    clueId: id,
    roleSlotId: id,
    source,
    clueName: text,
    pointId: id,
    ownerRoleSlotId: id
  }),
  "room.clue_revoked": schema(["clueId", "roleSlotId", "source"], {
    clueId: id,
    roleSlotId: id,
    clueName: text,
    source
  }),
  "room.clue_resent": schema(["clueId", "roleSlotId", "source"], {
    clueId: id,
    roleSlotId: id,
    clueName: text,
    source
  }),
  "room.item_granted": schema(["itemId", "roleSlotId", "source"], {
    itemId: id,
    roleSlotId: id,
    source,
    itemName: text
  }),
  "room.game_started": schema(["currentGame"], { currentGame: object }),
  "room.game_completed": schema(["currentGame"], { currentGame: object, forced: boolean, correct: boolean }),
  "room.game_updated": schema(["currentGame", "correct"], { currentGame: object, correct: boolean }),
  "room.checkpoint_restored": schema(["checkpointId", "restoreId", "sourceRoomId", "crossRoom"], {
    checkpointId: id,
    restoreId: id,
    sourceRoomId: id,
    crossRoom: boolean
  }),
  "room.content_release_changed": schema(["releaseId", "releaseNumber", "direction"], {
    previousReleaseId: id,
    releaseId: id,
    releaseNumber: number,
    direction: enumString(["bind", "upgrade", "downgrade"])
  }),
  "room.investigation_completed": schema(["pointId", "roleSlotId"], { pointId: id, roleSlotId: id }),
  "room.vote_created": schema(["voteId", "title", "status"], {
    voteId: id,
    title: text,
    status: enumString(["draft", "open", "closed", "published", "cancelled"])
  }),
  "room.vote_updated": schema(["voteId", "action"], { voteId: id, action: shortText }),
  "room.private_action_submitted": schema(["actionId", "actionType"], {
    actionId: id,
    actionType: enumString(["ask_host", "secret_action", "trade", "promise", "accusation_note"]),
    roleSlotIds: idList
  }),
  "room.private_action_updated": schema(["actionId", "status"], {
    actionId: id,
    status: enumString(["seen", "accepted", "rejected", "resolved", "cancelled"]),
    roleSlotIds: idList
  }),
  "room.role_state_updated": schema(["roleSlotId"], { roleSlotId: id }),
  "room.player_task_completed": schema(["taskId", "roleSlotId"], { taskId: id, roleSlotId: id }),
  "room.testimony_submitted": schema(["testimonyId", "roleSlotId"], { testimonyId: id, roleSlotId: id }),
  "room.segment_remedy_applied": schema(["remedyId", "segmentKey", "title"], {
    remedyId: id,
    segmentKey: shortText,
    title: text
  })
});

export const ROOM_EVENT_TYPES = Object.freeze(Object.keys(ROOM_EVENT_SCHEMAS));

export function isRoomEventType(type) {
  return Object.hasOwn(ROOM_EVENT_SCHEMAS, type);
}

export function listRoomEventTypes() {
  return [...ROOM_EVENT_TYPES].sort();
}

export function getRoomEventSchema(type) {
  return ROOM_EVENT_SCHEMAS[type] ?? null;
}

export function validateRoomEvent(type, data) {
  return validateEventPayload(ROOM_EVENT_SCHEMAS, "room", type, data);
}
