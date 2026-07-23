import assert from "node:assert/strict";
import test from "node:test";
import {
  assertWorldReleaseSnapshot,
  hashWorldReleaseSnapshot,
  projectWorldRelease,
  summarizeWorldReleaseSnapshot
} from "../src/world-release-contract.js";
import { prepareWorldReleaseArtifact } from "../src/world-release-service.js";
import { createWorldReleaseSchema } from "../src/routes/schemas/world-release.js";

function validSnapshot(overrides = {}) {
  const empty = {
    scenes: [],
    clues: [],
    investigationPoints: [],
    items: [],
    edges: [],
    rules: [],
    segmentRefs: [],
    truthClaims: [],
    roleRelationships: [],
    roleArchives: [],
    foreshadowBeats: [],
    timelineEvents: [],
    tags: [],
    assetManifest: []
  };
  return {
    schemaVersion: 1,
    sourceRevision: 7,
    narrativeProfile: {
      version: 1,
      creationType: "murder_mystery",
      runFormat: "single_session",
      roleMode: "fixed",
      ruleset: { mode: "none", key: "", diceNotation: "" }
    },
    world: { id: "world-1", name: "测试世界" },
    chapters: [{ id: "chapter-1", title: "第一章", sequence: 1, metadata: { chapterKey: "ch1" } }],
    roles: [{ id: "role-1", name: "角色一", sequence: 1 }],
    sections: [{
      id: "section-1",
      role_slot_id: "role-1",
      title: "第一幕",
      body: "正文",
      sequence: 1,
      publication_status: "testing",
      metadata: { segmentKey: "ch1" }
    }],
    segments: [{
      id: "segment-1",
      segment_key: "ch1",
      title: "第一章",
      sequence: 1,
      operations: { flow: "依次推进", hostTruth: "主持人真相" }
    }],
    coreTrick: null,
    ...empty,
    ...overrides
  };
}

test("release digest is stable across object key insertion order", () => {
  const left = { world: { name: "A", id: "1" }, values: [{ z: 2, a: 1 }] };
  const right = { values: [{ a: 1, z: 2 }], world: { id: "1", name: "A" } };
  assert.deepEqual(hashWorldReleaseSnapshot(left), hashWorldReleaseSnapshot(right));
  const circular = [];
  circular.push(circular);
  assert.throws(() => hashWorldReleaseSnapshot(circular), /circular references/);
});

test("release route contract requires concurrency and idempotency headers", () => {
  assert.deepEqual(
    [...createWorldReleaseSchema.headers.required].sort(),
    ["idempotency-key", "if-match"]
  );
});

test("release snapshot summary counts every authored runtime collection", () => {
  const snapshot = validSnapshot();
  assert.doesNotThrow(() => assertWorldReleaseSnapshot(snapshot));
  const summary = summarizeWorldReleaseSnapshot(snapshot);
  assert.equal(summary.counts.roles, 1);
  assert.equal(summary.counts.sections, 1);
  assert.equal(summary.counts.segments, 1);
  assert.equal(summary.totalObjects, 4);
});

test("release preparation blocks readiness errors and accepts warning-only content", () => {
  const snapshot = validSnapshot();
  const artifact = prepareWorldReleaseArtifact(snapshot);
  assert.equal(artifact.readiness.summary.errorCount, 0);
  assert.ok(artifact.readiness.summary.warningCount > 0);
  assert.match(artifact.digest.sha256, /^[0-9a-f]{64}$/);

  const withRoomContext = prepareWorldReleaseArtifact(snapshot, {
    readinessSnapshot: { ...snapshot, rooms: [{ id: "room-1" }] }
  });
  assert.equal(
    withRoomContext.readiness.checks.some((check) => check.id === "rooms.missing"),
    false
  );
  assert.equal(withRoomContext.digest.sha256, artifact.digest.sha256);

  assert.throws(
    () => prepareWorldReleaseArtifact(validSnapshot({ sections: [] })),
    (error) => error.code === "WORLD_RELEASE_READINESS_BLOCKED" && error.statusCode === 422
  );
});

test("release API projection never exposes snapshot or idempotency internals", () => {
  const projected = projectWorldRelease({
    id: "release-1",
    world_id: "world-1",
    release_number: 2,
    label: "内测版",
    source_content_revision: 9,
    snapshot_schema_version: 1,
    narrative_profile: validSnapshot().narrativeProfile,
    readiness: { summary: { errorCount: 0 } },
    content_summary: { counts: {}, hasCoreTrick: false, totalObjects: 0 },
    content_sha256: "a".repeat(64),
    snapshot_bytes: 120,
    created_by_user_id: null,
    created_at: "2026-07-22T00:00:00.000Z",
    snapshot: { secret: true },
    idempotency_key: "private",
    request_hash: "b".repeat(64)
  });
  assert.equal(projected.releaseNumber, 2);
  assert.equal(projected.snapshot, undefined);
  assert.equal(projected.idempotencyKey, undefined);
  assert.equal(projected.requestHash, undefined);
});
