export const PLATFORM_EVENT_TYPES = Object.freeze([
  "plaza.post_created",
  "plaza.post_deleted",
  "plaza.reply_created",
  "plaza.reply_deleted",
  "social.friend_request",
  "social.friend_accepted",
  "social.friend_declined",
  "dm.message_created"
]);

const PLATFORM_EVENT_TYPE_SET = new Set(PLATFORM_EVENT_TYPES);

export function isPlatformEventType(type) {
  return PLATFORM_EVENT_TYPE_SET.has(type);
}
