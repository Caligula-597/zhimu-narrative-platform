/**
 * Drift check: shared/contracts/room-events.js must match backend room-event-schemas registry.
 * Usage: node scripts/check-contracts-drift.mjs
 */
import assert from "node:assert/strict";
import { ROOM_EVENT_TYPES } from "../shared/contracts/room-events.js";
import { API_ERROR_CODES } from "../shared/contracts/error-codes.js";
import { listRegisteredEventTypes } from "../backend/src/room-event-schemas.js";

const backendTypes = listRegisteredEventTypes();
const sharedTypes = [...ROOM_EVENT_TYPES].sort();

const missingInShared = backendTypes.filter((type) => !ROOM_EVENT_TYPES.includes(type));
const extraInShared = sharedTypes.filter((type) => !backendTypes.includes(type));

if (missingInShared.length || extraInShared.length) {
  console.error("Room event contract drift detected:");
  if (missingInShared.length) console.error(`  missing in shared: ${missingInShared.join(", ")}`);
  if (extraInShared.length) console.error(`  extra in shared: ${extraInShared.join(", ")}`);
  process.exit(1);
}

assert.ok(Object.keys(API_ERROR_CODES).length >= 5, "API_ERROR_CODES should list core client-facing codes");

console.log(`✓ contracts drift OK (${sharedTypes.length} room event types, ${Object.keys(API_ERROR_CODES).length} error codes)`);
