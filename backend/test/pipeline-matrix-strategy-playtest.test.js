import assert from "node:assert/strict";
import test from "node:test";

import { simulateMatrixStrategyTable } from "../src/pipeline-matrix-strategy-playtest.js";

function fixture() {
  const roles = [{ key: "role-1" }, { key: "role-2" }];
  return {
    characterArchives: { roles },
    truthBible: {
      endingAxes: [{ key: "mutual" }, { key: "control" }],
      endingRoutes: [
        { key: "mutual-end", priority: 100, requirements: [{ axisKey: "mutual", operator: "gte", value: 2 }] },
        { key: "control-end", priority: 90, requirements: [{ axisKey: "control", operator: "gte", value: 2 }] },
        { key: "mixed-end", priority: 0, isDefault: true, requirements: [] }
      ],
      truthNodes: [{ key: "truth-1", importance: "critical" }]
    },
    clueNetwork: {
      clues: [
        { key: "clue-1", scope: "public_anchor", grantMode: "auto", holderRoleKeys: [] },
        { key: "clue-2", scope: "public_anchor", grantMode: "auto", holderRoleKeys: [] }
      ],
      truthCoverage: [{
        truthNodeKey: "truth-1",
        paths: [
          { key: "path-1", clueKeys: ["clue-1"], requiredRoleKeys: [], requiredInterpreterRoleKeys: [] },
          { key: "path-2", clueKeys: ["clue-2"], requiredRoleKeys: [], requiredInterpreterRoleKeys: [] }
        ],
        fallback: "公开复核"
      }]
    },
    infoMatrix: {
      decisions: ["ch1", "ch2"].map((actKey, index) => ({
        key: `decision-${index + 1}`,
        actKey,
        defaultAxisEffects: [{ axisKey: "mutual", delta: -1 }],
        options: [
          { key: `${actKey}-mutual`, benefitingRoleKeys: ["role-1", "role-2"], harmedRoleKeys: [], counterplayRoleKeys: [], axisEffects: [{ axisKey: "mutual", delta: 1 }] },
          { key: `${actKey}-control`, benefitingRoleKeys: ["role-1"], harmedRoleKeys: ["role-2"], counterplayRoleKeys: ["role-2"], axisEffects: [{ axisKey: "control", delta: 1 }] }
        ]
      }))
    }
  };
}

test("100-run strategy pressure test is deterministic and reports structural reachability", () => {
  const first = simulateMatrixStrategyTable({ ...fixture(), runs: 100 });
  const second = simulateMatrixStrategyTable({ ...fixture(), runs: 100 });
  assert.deepEqual(first, second);
  assert.equal(first.runs, 100);
  assert.equal(first.metrics.allCriticalTruthRecoveryRate, 1);
  assert.ok(first.metrics.reachableEndingKeys.length >= 2);
  assert.match(first.claimBoundary, /不预测真人偏好/);
});

test("strategy pressure test blocks a matrix with no decisions", () => {
  const value = fixture();
  value.infoMatrix.decisions = [];
  const result = simulateMatrixStrategyTable({ ...value, runs: 100 });
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "strategy_playtest_no_decisions"));
});
