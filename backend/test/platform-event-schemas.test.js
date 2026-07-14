import assert from "node:assert/strict";
import test from "node:test";
import {
  listPlatformEventTypes,
  PLATFORM_EVENT_SCHEMAS,
  validatePlatformEvent
} from "../src/platform-event-schemas.js";

const validPayloads = {
  "plaza.post_created": { postId: "post-1" },
  "plaza.post_deleted": { postId: "post-1", reason: "reported" },
  "plaza.reply_created": { postId: "post-1", replyId: "reply-1" },
  "plaza.reply_deleted": { postId: "post-1", replyId: "reply-1" },
  "social.friend_request": { fromUserId: "user-1" },
  "social.friend_accepted": { fromUserId: "user-1" },
  "social.friend_declined": { fromUserId: "user-1" },
  "dm.message_created": { conversationId: "conversation-1", messageId: "message-1" }
};

test("all registered platform event schemas accept their required payload", () => {
  assert.deepEqual(listPlatformEventTypes(), Object.keys(validPayloads).sort());
  for (const [type, payload] of Object.entries(validPayloads)) {
    assert.deepEqual(validatePlatformEvent(type, payload), { ok: true, errors: [] }, type);
  }
});

test("platform event schemas reject unknown, missing and malformed fields", () => {
  assert.match(validatePlatformEvent("platform.unknown", {}).errors[0], /Unknown platform event type/);
  assert.match(validatePlatformEvent("plaza.post_created", {}).errors[0], /postId/);
  assert.match(validatePlatformEvent("plaza.post_created", { postId: 123 }).errors[0], /string/);
  assert.match(validatePlatformEvent("dm.message_created", []).errors[0], /plain object/);
});

test("platform schemas remain JSON-Schema-shaped and additive during migration", () => {
  for (const schema of Object.values(PLATFORM_EVENT_SCHEMAS)) {
    assert.equal(schema.type, "object");
    assert.equal(schema.additionalProperties, true);
    assert.ok(Array.isArray(schema.required));
    assert.equal(typeof schema.properties, "object");
  }
  assert.equal(
    validatePlatformEvent("plaza.post_created", { postId: "post-1", futureField: true }).ok,
    true
  );
});
