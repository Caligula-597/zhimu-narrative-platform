import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRoomReleaseImpact } from "../src/room-release-service.js";
import { resolveRoomReleasePolicy } from "../src/room-release-policy.js";

const roleOne = "11111111-2222-4333-8444-555555550001";
const roleTwo = "11111111-2222-4333-8444-555555550002";

function snapshot(roles = [{ id: roleOne, name: "角色一" }]) {
  return {
    world: { id: "world", name: "测试世界" },
    roles,
    chapters: [],
    sections: [],
    scenes: [],
    clues: [],
    investigationPoints: [],
    items: [],
    edges: [],
    rules: [],
    segments: [],
    segmentRefs: [],
    truthClaims: [],
    roleRelationships: [],
    roleArchives: [],
    foreshadowBeats: [],
    timelineEvents: [],
    playerTasks: [],
    assetManifest: [],
    tags: [],
    coreTrick: null
  };
}

function room(overrides = {}) {
  return {
    id: "11111111-2222-4333-8444-555555550099",
    release_id: null,
    release_number: null,
    current_content_revision: 10,
    status: "testing",
    started_at: null,
    assigned_role_ids: [roleOne],
    runtime_evidence: {
      readingProgress: 0,
      clueOwnership: 0
    },
    ...overrides
  };
}

function release(overrides = {}) {
  return {
    id: "11111111-2222-4333-8444-555555550088",
    release_number: 2,
    source_content_revision: 9,
    content_sha256: "a".repeat(64),
    is_latest: true,
    ...overrides
  };
}

test("room release policy is fail-safe and only enables recognized values", () => {
  assert.equal(resolveRoomReleasePolicy({}).defaultMode, "live_draft");
  assert.equal(
    resolveRoomReleasePolicy({ ROOM_DEFAULT_CONTENT_BINDING: "latest_release" }).defaultMode,
    "latest_release"
  );
  assert.equal(
    resolveRoomReleasePolicy({ ROOM_DEFAULT_CONTENT_BINDING: "unexpected" }).defaultMode,
    "live_draft"
  );
});

test("an unstarted room with compatible role assignments can bind a Release", () => {
  const impact = evaluateRoomReleaseImpact({
    room: room(),
    targetRelease: release(),
    sourceSnapshot: snapshot(),
    targetSnapshot: snapshot()
  });
  assert.equal(impact.direction, "bind");
  assert.equal(impact.allowed, true);
  assert.equal(impact.runtimeImpact.hasStarted, false);
  assert.match(impact.fingerprint, /^[0-9a-f]{64}$/);
});

test("runtime evidence blocks an in-place version change", () => {
  const impact = evaluateRoomReleaseImpact({
    room: room({ runtime_evidence: { readingProgress: 1 } }),
    targetRelease: release(),
    sourceSnapshot: snapshot(),
    targetSnapshot: snapshot()
  });
  assert.equal(impact.allowed, false);
  assert.equal(impact.runtimeImpact.hasStarted, true);
  assert.ok(
    impact.runtimeImpact.blockers.some((item) => item.code === "ROOM_RELEASE_CHANGE_AFTER_START")
  );
});

test("a target Release missing an assigned player role is blocked", () => {
  const impact = evaluateRoomReleaseImpact({
    room: room({ assigned_role_ids: [roleOne, roleTwo] }),
    targetRelease: release(),
    sourceSnapshot: snapshot([{ id: roleOne }, { id: roleTwo }]),
    targetSnapshot: snapshot([{ id: roleOne }])
  });
  assert.equal(impact.allowed, false);
  assert.deepEqual(impact.runtimeImpact.missingAssignedRoleIds, [roleTwo]);
});

test("impact fingerprints change when live draft or room evidence changes", () => {
  const baseArgs = {
    targetRelease: release(),
    sourceSnapshot: snapshot(),
    targetSnapshot: snapshot()
  };
  const first = evaluateRoomReleaseImpact({ ...baseArgs, room: room() });
  const draftChanged = evaluateRoomReleaseImpact({
    ...baseArgs,
    room: room({ current_content_revision: 11 })
  });
  const evidenceChanged = evaluateRoomReleaseImpact({
    ...baseArgs,
    room: room({ runtime_evidence: { readingProgress: 1 } })
  });
  assert.notEqual(first.fingerprint, draftChanged.fingerprint);
  assert.notEqual(first.fingerprint, evidenceChanged.fingerprint);
});
