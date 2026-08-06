/** Verify producer, shared contract and dedicated portal consumers stay aligned. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { ROOM_EVENT_TYPES } from "../shared/contracts/room-events.js";
import { API_ERROR_CODES } from "../shared/contracts/error-codes.js";
import { PLATFORM_EVENT_TYPES } from "../shared/contracts/platform-events.js";
import { listRegisteredEventTypes } from "../backend/src/room-event-schemas.js";
import { listPlatformEventTypes } from "../backend/src/platform-event-schemas.js";

const backendTypes = listRegisteredEventTypes();
const sharedTypes = [...ROOM_EVENT_TYPES].sort();
const missingInShared = backendTypes.filter((type) => !ROOM_EVENT_TYPES.includes(type));
const extraInShared = sharedTypes.filter((type) => !backendTypes.includes(type));
const backendPlatformTypes = listPlatformEventTypes();

if (missingInShared.length || extraInShared.length) {
  console.error("Room event contract drift detected:");
  if (missingInShared.length) console.error(`  missing in shared: ${missingInShared.join(", ")}`);
  if (extraInShared.length) console.error(`  extra in shared: ${extraInShared.join(", ")}`);
  process.exit(1);
}

assert.deepEqual(
  [...PLATFORM_EVENT_TYPES].sort(),
  backendPlatformTypes,
  "platform event contract drift between backend and shared"
);

function handledRoomEvents(file) {
  const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  return new Set([...source.matchAll(/case\s+["'](room\.[a-z0-9_]+)["']/g)].map((match) => match[1]));
}

// Creator authors mechanism packages but never operates room mechanism state;
// that live event belongs to the canonical Host and Player portals.
for (const [surface, file, exclusions = []] of [
  ["app", "../src/runtime/room-events.js", ["room.mechanism_state_updated"]],
  ["host", "../host/src/runtime/room-events.js"],
  ["play", "../play/src/room-events.js"]
]) {
  const handled = handledRoomEvents(file);
  const excluded = new Set(exclusions);
  const missing = sharedTypes.filter((type) => !handled.has(type) && !excluded.has(type));
  assert.deepEqual(missing, [], `${surface} room-event consumer missing: ${missing.join(", ")}`);
}

const platformSource = fs.readFileSync(new URL("../play/src/platform-events.js", import.meta.url), "utf8");
const handledPlatformTypes = new Set(
  [...platformSource.matchAll(/case\s+["']((?:plaza|social|dm)\.[a-z0-9_]+)["']/g)].map((match) => match[1])
);
const missingPlatformTypes = PLATFORM_EVENT_TYPES.filter((type) => !handledPlatformTypes.has(type));
assert.deepEqual(missingPlatformTypes, [], `play platform-event consumer missing: ${missingPlatformTypes.join(", ")}`);

assert.ok(Object.keys(API_ERROR_CODES).length >= 5, "API_ERROR_CODES should list core client-facing codes");
console.log(`✓ contracts drift OK (${sharedTypes.length} room events, ${PLATFORM_EVENT_TYPES.length} platform events, consumers complete, ${Object.keys(API_ERROR_CODES).length} error codes)`);
