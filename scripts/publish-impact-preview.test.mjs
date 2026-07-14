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

test("evaluatePublishImpact hides testing content in active rooms", () => {
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

  assert.equal(result.sections.length, 1);
  assert.equal(result.chapters[0].visible, false);
  assert.equal(result.sections[0].visible, false);
  assert.match(result.sections[0].reason, /正式房|章节/);
  assert.equal(result.scenes[0].visible, false);
  assert.equal(result.clues[0].visible, true);
  assert.equal(result.clues[1].visible, false);
  assert.equal(result.summary.visible, 1);
});
