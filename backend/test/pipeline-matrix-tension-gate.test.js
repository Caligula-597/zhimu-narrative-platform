import assert from "node:assert/strict";
import test from "node:test";

import { scanDramaticTensionContracts } from "../src/pipeline-matrix-model.js";

const setting = { playStructure: "mechanism" };
const rows = [{ roleKey: "role-1" }, { roleKey: "role-2" }];

test("tension contract rejects fair-looking options without winners, losers, or counterplay", () => {
  const result = scanDramaticTensionContracts({
    rows,
    decisions: [{
      actKey: "ch1",
      options: [{ key: "share", benefitingRoleKeys: ["role-1", "role-2"], harmedRoleKeys: [], counterplayRoleKeys: [], counterplay: "" }]
    }]
  }, setting);

  assert.equal(result.passed, false);
  assert.ok(result.violations.some((issue) => issue.type === "no_cost_or_counterplay"));
  assert.ok(result.violations.some((issue) => issue.type === "decision_without_real_conflict"));
});

test("tension contract allows a cooperative option with a cost when another option keeps real conflict", () => {
  const result = scanDramaticTensionContracts({
    rows,
    decisions: [{
      actKey: "ch1",
      options: [
        { key: "search-together", tradeoff: "必须公开一条私人路径，且放弃先拿线索的优势" },
        {
          key: "take-seat",
          benefitingRoleKeys: ["role-1"], harmedRoleKeys: ["role-2"], counterplayRoleKeys: ["role-2"],
          counterplay: "role-2 可在截止前封存席位并留下冒名记录。"
        }
      ]
    }]
  }, setting);
  assert.equal(result.passed, true);
});

test("tension contract accepts asymmetric harm when the harmed player can retaliate", () => {
  const result = scanDramaticTensionContracts({
    rows,
    decisions: [{
      actKey: "ch1",
      options: [{
        key: "take-seat",
        benefitingRoleKeys: ["role-1"],
        harmedRoleKeys: ["role-2"],
        counterplayRoleKeys: ["role-2"],
        counterplay: "role-2 可在签约公布前公开冒名录像，迫使席位重新竞价。"
      }]
    }]
  }, setting);

  assert.equal(result.passed, true);
});
