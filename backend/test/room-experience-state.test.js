import assert from "node:assert/strict";
import test from "node:test";
import {
  ROOM_EXPERIENCE_STATE_KINDS,
  RoomExperienceStateError,
  normalizeRoomExperienceIdentity,
  normalizeRoomExperiencePayload,
} from "../src/room-experience-state.js";

const now = new Date("2026-08-11T10:00:00.000Z");

test("experience identity rejects unregistered JSON buckets", () => {
  assert.throws(
    () => normalizeRoomExperienceIdentity({ stateKind: "future_blob", scopeKey: "room" }),
    (error) => error instanceof RoomExperienceStateError && error.code === "unsupported_state_kind",
  );
  assert.deepEqual(
    normalizeRoomExperienceIdentity({
      stateKind: ROOM_EXPERIENCE_STATE_KINDS.PACE_CLOCK,
      scopeKey: "main",
      visibility: "room",
    }),
    {
      stateKind: "pace_clock",
      scopeKey: "main",
      subjectKey: "room",
      schemaVersion: 1,
      visibility: "room",
    },
  );
});

test("location discovery contract keeps only durable progress fields", () => {
  const result = normalizeRoomExperiencePayload(
    ROOM_EXPERIENCE_STATE_KINDS.LOCATION_DISCOVERY,
    {
      locationId: "location-library",
      segmentKey: "act-1-library",
      phase: "drawing",
      drawnClueIds: ["clue-a", "clue-a", "clue-b"],
      remainingClueIds: ["clue-c", "clue-a"],
      remainingCount: 1,
      scanStartedAt: "2026-08-11T09:59:00Z",
      leakedSecret: "must not persist",
    },
    { now },
  );
  assert.deepEqual(result.drawnClueIds, ["clue-a", "clue-b"]);
  assert.deepEqual(result.remainingClueIds, ["clue-c"]);
  assert.equal(result.updatedAt, now.toISOString());
  assert.equal("leakedSecret" in result, false);
});

test("pace clock requires a useful countdown and conclusion requires idempotency", () => {
  assert.throws(
    () => normalizeRoomExperiencePayload(ROOM_EXPERIENCE_STATE_KINDS.PACE_CLOCK, {
      mode: "countdown",
      durationMs: 250,
    }, { now }),
    /at least 1000/,
  );
  assert.throws(
    () => normalizeRoomExperiencePayload(ROOM_EXPERIENCE_STATE_KINDS.SESSION_CONCLUSION, {
      status: "publishing",
    }, { now }),
    /idempotencyKey is required/,
  );
});

test("room state payloads have a hard persistence size budget", () => {
  assert.throws(
    () => normalizeRoomExperiencePayload(ROOM_EXPERIENCE_STATE_KINDS.INTERACTION, {
      value: "x".repeat(70 * 1024),
    }),
    (error) => error.code === "payload_too_large",
  );
});
