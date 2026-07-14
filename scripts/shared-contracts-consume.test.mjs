import assert from "node:assert/strict";
import test from "node:test";
import { isKnownApiErrorCode, API_ERROR_CODES } from "../shared/contracts/error-codes.js";
import { isRoomEventType, ROOM_EVENT_TYPES, validateRoomEvent } from "../shared/contracts/room-events.js";
import {
  isPlatformEventType,
  PLATFORM_EVENT_TYPES,
  validatePlatformEvent
} from "../shared/contracts/platform-events.js";
import { defaultHttpError } from "../shared/api-fetch.js";

test("API_ERROR_CODES is consumed by defaultHttpError.known", () => {
  const err = defaultHttpError({ status: 429 }, { code: API_ERROR_CODES.RATE_LIMITED, error: "slow" }, "GET", "/x");
  assert.equal(err.known, true);
  assert.equal(isKnownApiErrorCode("NOT_A_CODE"), false);
});

test("ROOM_EVENT_TYPES is consumed by isRoomEventType", () => {
  assert.equal(isRoomEventType(ROOM_EVENT_TYPES[0]), true);
  assert.equal(isRoomEventType("room.not_registered"), false);
  assert.equal(validateRoomEvent("room.player_joined", { roleSlotId: "role-1", roleName: "A" }).ok, true);
  assert.equal(validateRoomEvent("room.player_joined", { roleSlotId: "role-1" }).ok, false);
});

test("platform event contract validates both type and required payload", () => {
  assert.equal(isPlatformEventType(PLATFORM_EVENT_TYPES[0]), true);
  assert.equal(validatePlatformEvent("plaza.post_created", { postId: "post-1" }).ok, true);
  assert.equal(validatePlatformEvent("plaza.post_created", {}).ok, false);
});
