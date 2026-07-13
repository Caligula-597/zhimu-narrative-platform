const PLATFORM_EVENT_TYPES = new Set([
  "plaza.post_created",
  "plaza.post_deleted",
  "plaza.reply_created",
  "plaza.reply_deleted",
  "social.friend_request",
  "social.friend_accepted",
  "social.friend_declined",
  "dm.message_created"
]);

export function isPlatformEventType(type) {
  return PLATFORM_EVENT_TYPES.has(type);
}

export function listPlatformEventTypes() {
  return [...PLATFORM_EVENT_TYPES].sort();
}
