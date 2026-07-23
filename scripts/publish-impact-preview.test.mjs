import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePublishImpact,
  publicationVisibleToPlayer
} from "../shared/publish-impact-preview.js";

test("publicationVisibleToPlayer gates draft / testing / published", () => {
  assert.equal(publicationVisibleToPlayer("draft", "testing").visible, false);
  assert.equal(publicationVisibleToPlayer("testing", "testing").visible, true);
  assert.equal(publicationVisibleToPlayer("testing", "active").visible, false);
  assert.equal(publicationVisibleToPlayer("published", "active").visible, true);
});

test("evaluatePublishImpact follows Player publication, unlock and ownership rules", () => {
  const result = evaluatePublishImpact({
    roleSlotId: "role-a",
    roomStatus: "active",
    chapters: [{ id: "ch1", title: "第一章", publication_status: "testing" }],
    sections: [
      {
        id: "s1",
        role_slot_id: "role-a",
        chapter_id: "ch1",
        title: "序",
        sequence: 1,
        publication_status: "testing"
      },
      {
        id: "s2",
        role_slot_id: "role-a",
        title: "第二幕",
        sequence: 2,
        publication_status: "published"
      },
      {
        id: "s3",
        role_slot_id: "role-b",
        title: "他人",
        publication_status: "published"
      }
    ],
    scenes: [
      {
        id: "sc1",
        name: "客厅",
        chapter_id: "ch1",
        metadata: { openStatus: "unlocked", visibleRoleSlotIds: ["role-a"] }
      }
    ],
    clues: [
      { id: "c1", name: "公开", visibility: "public" },
      { id: "c2", name: "私密", visibility: "private" }
    ]
  });

  assert.equal(result.sections.length, 2);
  assert.equal(result.chapters[0].visible, false);
  assert.equal(result.sections[0].visible, false);
  assert.match(result.sections[0].reason, /正式房/);
  assert.equal(result.sections[1].visible, false);
  assert.match(result.sections[1].reason, /解锁记录/);
  assert.equal(result.scenes[0].visible, false);
  assert.equal(result.clues[0].visible, false);
  assert.match(result.clues[0].reason, /获取或分享记录/);
  assert.equal(result.clues[1].visible, false);
  assert.equal(result.summary.visible, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("公开线索")));
});

test("evaluatePublishImpact accepts runtime unlock and clue evidence", () => {
  const result = evaluatePublishImpact({
    roleSlotId: "role-a",
    roomStatus: "active",
    chapters: [{ id: "ch1", title: "第一章", publication_status: "draft" }],
    sections: [{
      id: "s2",
      role_slot_id: "role-a",
      chapter_id: "ch1",
      title: "第二幕",
      sequence: 2,
      publication_status: "published"
    }],
    clues: [
      { id: "c1", name: "公开", visibility: "public" },
      { id: "c2", name: "私密", visibility: "private" }
    ],
    unlockedSectionIds: ["s2"],
    ownedClueIds: ["c1"],
    sharedClueIds: ["c2"]
  });

  assert.equal(result.sections[0].visible, true);
  assert.match(result.sections[0].reason, /运行时解锁记录/);
  assert.equal(result.clues[0].visible, true);
  assert.match(result.clues[0].reason, /获取记录/);
  assert.equal(result.clues[1].visible, true);
  assert.match(result.clues[1].reason, /分享记录/);
  assert.ok(result.warnings.some((warning) => warning.includes("父章节")));
});
