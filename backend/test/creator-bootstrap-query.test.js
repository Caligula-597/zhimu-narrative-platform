import assert from "node:assert/strict";
import test from "node:test";
import { loadBibleSummary } from "../src/creator-bible.js";
import {
  CREATOR_BOOTSTRAP_DATA_SQL,
  CREATOR_COCKPIT_CONTENT_SQL,
  creatorWorkspacePreview,
  loadCreatorBootstrapData,
  loadCreatorCockpitContent
} from "../src/creator-bootstrap.js";

test("loadBibleSummary preserves its contract in one database round trip", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          core_summary: "真相",
          archives_total: 2,
          archives_filled: 1,
          foreshadow_count: 3,
          timeline_count: 4,
          claims_count: 5,
          relationships_count: 6,
          segments_total: 7,
          segments_with_flow: 2,
          clues_by_kind: { physical: 8 },
          world_summary: "一句话梗概",
          world_settings: {
            creatorBrief: {
              sparks: ["火花"],
              sellingPoints: ["卖点", ""],
              target: "核心玩家"
            }
          }
        }]
      };
    }
  };

  const summary = await loadBibleSummary("world-1", client);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ["world-1"]);
  assert.deepEqual(summary.counts, {
    sparks: 1,
    loglineChars: 5,
    sellingFilled: 1,
    positioningFilled: 1,
    coreTrick: 1,
    truthClaims: 5,
    relationships: 6,
    timelineEvents: 4,
    roleArchives: 2,
    roleArchivesFilled: 1,
    roleArcs: 2,
    foreshadowBeats: 3,
    segments: 7,
    segmentsWithFlow: 2,
    cluesByKind: { physical: 8 }
  });
});

test("loadCreatorCockpitContent loads all three content domains in one round trip", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          segments: [{
            id: "segment-1",
            world_id: "world-1",
            segment_key: "opening",
            title: "开场",
            sequence: 1,
            operations: { flow: "进入大厅" },
            refs: [{ refType: "chapter", refId: "chapter-1" }]
          }],
          truth_claims: [{ id: "claim-1" }],
          role_relationships: [{ id: "relationship-1" }]
        }]
      };
    }
  };

  const content = await loadCreatorCockpitContent("world-1", client);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, CREATOR_COCKPIT_CONTENT_SQL);
  assert.deepEqual(calls[0].params, ["world-1"]);
  assert.equal(content.segments[0].segmentKey, "opening");
  assert.equal(content.segments[0].refs.length, 1);
  assert.deepEqual(content.truthClaims, [{ id: "claim-1" }]);
  assert.deepEqual(content.roleRelationships, [{ id: "relationship-1" }]);
});

test("loadCreatorBootstrapData combines readiness, bible and cockpit content in one round trip", async () => {
  const calls = [];
  const data = await loadCreatorBootstrapData("world-1", {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          readiness: {
            world: { id: "world-1", name: "测试世界" },
            roles: [{ id: "role-1", name: "角色" }]
          },
          bible: {
            world_summary: "梗概",
            world_settings: {},
            archives_total: 1
          },
          content: {
            segments: [{
              id: "segment-1",
              world_id: "world-1",
              segment_key: "opening",
              title: "开场"
            }],
            truth_claims: [{ id: "claim-1" }],
            role_relationships: [{ id: "relationship-1" }]
          }
        }]
      };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, CREATOR_BOOTSTRAP_DATA_SQL);
  assert.deepEqual(calls[0].params, ["world-1"]);
  assert.equal(data.snapshot.world.id, "world-1");
  assert.equal(data.bibleSummary.counts.roleArchives, 1);
  assert.equal(data.segments[0].segmentKey, "opening");
  assert.deepEqual(data.truthClaims, [{ id: "claim-1" }]);
});

test("creator workspace preview keeps navigation fields and strips manuscript bodies", () => {
  const preview = creatorWorkspacePreview({
    world: {
      id: "world-1",
      name: "World",
      summary: "Summary",
      settings: { creatorBrief: { type: "mystery" } },
      content_revision: "7"
    },
    chapters: [{ id: "chapter-1", title: "Chapter", summary: "Beat", sequence: 1 }],
    roles: [{ id: "role-1", name: "Role", sequence: 1, private_profile: "secret" }],
    sections: [{
      id: "section-1",
      role_slot_id: "role-1",
      chapter_id: "chapter-1",
      title: "Section",
      body: "private manuscript",
      sequence: 1,
      publication_status: "testing",
      metadata: { hidden: true }
    }],
    scenes: [{ id: "scene-1", chapter_id: "chapter-1", name: "Scene", host_text: "secret" }],
    clues: [{ id: "clue-1", name: "Clue", host_text: "secret" }],
    rooms: [{ id: "room-1", invite_code: "SECRET" }]
  });

  assert.equal(preview.world.content_revision, 7);
  assert.equal(preview.chapters[0].title, "Chapter");
  assert.equal(preview.sections[0].chapter_id, "chapter-1");
  assert.equal(preview.scenes[0].chapter_id, "chapter-1");
  assert.equal("body" in preview.sections[0], false);
  assert.equal("private_profile" in preview.roles[0], false);
  assert.equal("host_text" in preview.clues[0], false);
  assert.equal("invite_code" in preview.rooms[0], false);
});
