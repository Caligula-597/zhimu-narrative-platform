import { validateEventPayload } from "./event-schema-validator.js";

const id = Object.freeze({ type: "string", minLength: 1, maxLength: 200 });
const reason = Object.freeze({ type: "string", minLength: 1, maxLength: 80 });

function schema(required, properties) {
  return Object.freeze({
    type: "object",
    required: Object.freeze(required),
    properties: Object.freeze(properties),
    additionalProperties: true
  });
}

/** Shared runtime and type-generation source for platform SSE payloads. */
export const PLATFORM_EVENT_SCHEMAS = Object.freeze({
  "plaza.post_created": schema(["postId"], { postId: id }),
  "plaza.post_deleted": schema(["postId"], { postId: id, reason }),
  "plaza.reply_created": schema(["postId", "replyId"], { postId: id, replyId: id }),
  "plaza.reply_deleted": schema(["postId", "replyId"], { postId: id, replyId: id }),
  "social.friend_request": schema(["fromUserId"], { fromUserId: id }),
  "social.friend_accepted": schema(["fromUserId"], { fromUserId: id }),
  "social.friend_declined": schema(["fromUserId"], { fromUserId: id }),
  "dm.message_created": schema(
    ["conversationId", "messageId"],
    { conversationId: id, messageId: id }
  )
});

export const PLATFORM_EVENT_TYPES = Object.freeze(Object.keys(PLATFORM_EVENT_SCHEMAS));

export function isPlatformEventType(type) {
  return Object.hasOwn(PLATFORM_EVENT_SCHEMAS, type);
}

export function listPlatformEventTypes() {
  return [...PLATFORM_EVENT_TYPES].sort();
}

export function validatePlatformEvent(type, data) {
  return validateEventPayload(PLATFORM_EVENT_SCHEMAS, "platform", type, data);
}
