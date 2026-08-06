import assert from "node:assert/strict";
import test from "node:test";
import {
  createRuntimeContentProvider,
  projectPlayerRuntimeContent
} from "../src/runtime-content-provider.js";
import { fetchRuntimePlayerTasksForRoom } from "../src/player-tasks.js";

const roleId = "10000000-0000-4000-8000-000000000001";
const sectionOneId = "10000000-0000-4000-8000-000000000002";
const sectionTwoId = "10000000-0000-4000-8000-000000000003";

function releaseSnapshot() {
  return {
    schemaVersion: 1,
    sourceRevision: 7,
    narrativeProfile: { kind: "mystery" },
    world: { id: "10000000-0000-4000-8000-000000000010", name: "Frozen world" },
    chapters: [],
    roles: [{
      id: roleId,
      name: "Frozen role",
      public_profile: "public",
      private_profile: "private",
      sequence: 1
    }],
    sections: [
      {
        id: sectionOneId,
        role_slot_id: roleId,
        title: "Frozen first",
        body: "release body one",
        sequence: 1,
        publication_status: "published"
      },
      {
        id: sectionTwoId,
        role_slot_id: roleId,
        title: "Frozen second",
        body: "release body two",
        sequence: 2,
        publication_status: "published"
      }
    ],
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
    tags: [],
    assetManifest: []
  };
}

function releaseRecord() {
  return {
    room_id: "10000000-0000-4000-8000-000000000020",
    world_id: "10000000-0000-4000-8000-000000000010",
    room_name: "Release room",
    room_status: "active",
    release_id: "10000000-0000-4000-8000-000000000030",
    release_number: 2,
    release_label: "Opening night",
    release_source_revision: 7,
    release_snapshot: releaseSnapshot(),
    release_created_at: "2026-07-24T00:00:00.000Z",
    current_content_revision: 12
  };
}

test("release provider is frozen and never reads a newer draft object", () => {
  const provider = createRuntimeContentProvider(releaseRecord());
  assert.equal(provider.isFrozen, true);
  assert.equal(provider.runtimeSource, "release_snapshot");
  assert.equal(provider.find("roles", roleId).name, "Frozen role");
  assert.equal(provider.contentBinding.hasNewerDraft, true);
  assert.equal(provider.contentBinding.compatibilityStatus, "frozen_release");
  assert.equal(provider.toResponse().content.sourceRevision, 7);
});

test("player projection combines frozen authored text with mutable room progress", () => {
  const provider = createRuntimeContentProvider(releaseRecord());
  const projected = projectPlayerRuntimeContent(provider, {
    roleSlotId: roleId,
    unlockedSectionIds: [sectionTwoId],
    progress: [{
      script_section_id: sectionOneId,
      started_at: "2026-07-24T01:00:00.000Z",
      completed_at: "2026-07-24T01:05:00.000Z"
    }]
  });
  assert.equal(projected.role.name, "Frozen role");
  assert.deepEqual(projected.sections.map((section) => section.title), [
    "Frozen first",
    "Frozen second"
  ]);
  assert.equal(projected.sections[0].completed, true);
  assert.equal(projected.sections[1].completed, false);
});

test("live provider preserves the legacy draft source contract", () => {
  const record = {
    ...releaseRecord(),
    release_id: null,
    release_snapshot: null
  };
  const snapshot = {
    world: { id: record.world_id, name: "Live world", settings: {} },
    roles: [{ id: roleId, name: "Live role" }],
    sections: [],
    segments: [],
    mechanismPackage: { schemaVersion: 1, source: "test" }
  };
  const provider = createRuntimeContentProvider(record, { liveSnapshot: snapshot });
  assert.equal(provider.isFrozen, false);
  assert.equal(provider.runtimeSource, "live_draft");
  assert.equal(provider.find("roles", roleId).name, "Live role");
  assert.equal(provider.toResponse().content.mechanismPackage.schemaVersion, 1);
  assert.equal(projectPlayerRuntimeContent(provider, { roleSlotId: roleId }).mechanismPackage, undefined);
});

test("legacy releases without frozen tasks never fall through to live task rows", async () => {
  const provider = createRuntimeContentProvider(releaseRecord());
  const tasks = await fetchRuntimePlayerTasksForRoom(
    async () => {
      throw new Error("live task query must not run");
    },
    provider,
    provider.room.id,
    roleId,
    "ch1"
  );
  assert.deepEqual(tasks, []);
});
