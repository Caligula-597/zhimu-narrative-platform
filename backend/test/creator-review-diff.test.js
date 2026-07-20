import assert from "node:assert/strict";
import test from "node:test";
import { compareCreatorSnapshots } from "../src/creator-review-diff.js";

test("creator review diff reports adds, removals and changed fields without returning manuscript bodies", () => {
  const before = {
    world: { id: "world-1", name: "旧名", settings: { age: "16+" } },
    roles: [{ id: "role-1", name: "甲", private_profile: "旧秘密" }],
    sections: [
      { id: "section-1", title: "第一幕", body: "旧正文" },
      { id: "section-2", title: "删除幕", body: "删除正文" }
    ]
  };
  const after = {
    world: { id: "world-1", name: "新名", settings: { age: "16+" } },
    roles: [{ id: "role-1", name: "甲", private_profile: "新秘密" }],
    sections: [
      { id: "section-1", title: "第一幕", body: "新正文" },
      { id: "section-3", title: "新增幕", body: "新增正文" }
    ]
  };
  const diff = compareCreatorSnapshots(before, after);
  assert.equal(diff.world.changed, true);
  assert.deepEqual(diff.domains.sections.counts, { added: 1, removed: 1, changed: 1 });
  assert.deepEqual(diff.domains.sections.changed[0].fields, ["body"]);
  assert.equal(JSON.stringify(diff).includes("新正文"), false);
  assert.equal(diff.summary.changed, 3);
});

test("creator review diff ignores object key ordering", () => {
  const before = { clues: [{ id: "clue-1", name: "线索", metadata: { a: 1, b: 2 } }] };
  const after = { clues: [{ id: "clue-1", name: "线索", metadata: { b: 2, a: 1 } }] };
  assert.equal(compareCreatorSnapshots(before, after).summary.changed, 0);
});
