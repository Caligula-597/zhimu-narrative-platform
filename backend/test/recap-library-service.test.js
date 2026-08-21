import assert from "node:assert/strict";
import test from "node:test";
import { mapRecapLibraryRow } from "../src/recap-library-service.js";
import {
  ROOM_EXPERIENCE_STATE_KINDS,
  normalizeRoomExperiencePayload,
} from "../src/room-experience-state.js";

test("recap library summaries expose grouping metadata without snapshots", () => {
  const result = mapRecapLibraryRow({
    id: "recap-1",
    room_id: "room-1",
    room_name: "雨夜局",
    world_id: "world-1",
    world_name: "旧港",
    role_slot_id: "role-1",
    role_name: "记者",
    label: "终局复盘",
    description: "",
    created_at: "2026-08-11T00:00:00.000Z",
    retention_days: 90,
    stats: { joinedPlayers: 4, cluesDiscovered: 8 },
    snapshot: { mustNotLeak: true },
  });
  assert.equal(result.worldName, "旧港");
  assert.equal(result.roleName, "记者");
  assert.equal(result.retentionDays, 90);
  assert.equal("snapshot" in result, false);
});

test("recap library preferences are bounded and deduplicated", () => {
  const payload = normalizeRoomExperiencePayload(
    ROOM_EXPERIENCE_STATE_KINDS.RECAP_LIBRARY,
    { hiddenRecapIds: ["recap-1", "recap-1"], retentionDays: 365 },
  );
  assert.deepEqual(payload, { hiddenRecapIds: ["recap-1"], retentionDays: 365 });
  assert.throws(() => normalizeRoomExperiencePayload(
    ROOM_EXPERIENCE_STATE_KINDS.RECAP_LIBRARY,
    { hiddenRecapIds: [], retentionDays: 3651 },
  ), /retentionDays/);
});

test("player recap projection strips host-only and idempotency fields", async () => {
  const { filterRecapForPlayer } = await import("../src/recap-projection-service.js");
  const projected = filterRecapForPlayer({
    rolePerformances: [
      { roleSlotId: "role-1", narrativeSummary: "mine" },
      { roleSlotId: "role-2", narrativeSummary: "other" },
    ],
    privateActions: [
      { roleSlotId: "role-1", title: "mine" },
      { roleSlotId: "role-2", title: "other" },
    ],
    conclusion: { endingId: "ending-1", idempotencyKey: "private-key" },
    hostOnly: { notes: "secret" },
  }, "role-1");
  assert.deepEqual(projected.conclusion, { endingId: "ending-1" });
  assert.equal(projected.privateActions.length, 1);
  assert.equal(projected.privateActions[0].title, "mine");
  assert.equal(projected.conclusion.idempotencyKey, undefined);
  assert.equal(projected.hostOnly, undefined);
});
