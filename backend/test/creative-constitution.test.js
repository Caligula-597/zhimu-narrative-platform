import assert from "node:assert/strict";
import test from "node:test";
import {
  creativeConstitutionCoverage,
  isCreativeConstitutionEmpty,
  normalizeCreativeConstitution
} from "../../shared/creative-constitution.js";

test("creative constitution normalization bounds lists, roles and fairness", () => {
  const constitution = normalizeCreativeConstitution({
    theme: "  记忆是否等于事实  ",
    inviolablePrinciples: ["证据必须提前出现", "证据必须提前出现", ""],
    forbiddenTropes: "失忆\n双胞胎\n",
    supernaturalPolicy: "unsupported",
    roleHighlights: [
      { roleId: "role-a", promise: " 作出最终选择 " },
      { roleId: "role-a", promise: "重复项" },
      { roleId: "", promise: "无角色" }
    ],
    fairness: { minimumEvidence: 99, requireIndependentPaths: false }
  });

  assert.equal(constitution.theme, "记忆是否等于事实");
  assert.deepEqual(constitution.inviolablePrinciples, ["证据必须提前出现"]);
  assert.deepEqual(constitution.forbiddenTropes, ["失忆", "双胞胎"]);
  assert.equal(constitution.supernaturalPolicy, "forbidden");
  assert.deepEqual(constitution.roleHighlights, [{ roleId: "role-a", promise: "作出最终选择" }]);
  assert.equal(constitution.fairness.minimumEvidence, 5);
  assert.equal(constitution.fairness.requireIndependentPaths, false);
});

test("creative constitution coverage includes every authored role promise", () => {
  const constitution = {
    theme: "真相与信任",
    intendedEmotion: "愧疚",
    experiencePromise: "终局前重构时间线",
    roleHighlights: [{ roleId: "role-a", promise: "决定是否公开证据" }]
  };
  const coverage = creativeConstitutionCoverage(constitution, [
    { id: "role-a", name: "林远" },
    { id: "role-b", name: "陈默" }
  ]);

  assert.equal(coverage.total, 14);
  assert.equal(coverage.roles.filled, 1);
  assert.deepEqual(coverage.roles.missing, [{ id: "role-b", label: "陈默" }]);
  assert.ok(coverage.score > 0 && coverage.score < 100);
  assert.equal(isCreativeConstitutionEmpty(constitution), false);
  assert.equal(isCreativeConstitutionEmpty({}), true);
});
