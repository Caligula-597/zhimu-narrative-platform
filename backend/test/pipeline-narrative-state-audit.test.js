import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArtifactDependencyManifest,
  buildRepairPlan,
  diffArtifactDependencyManifests,
  routeNarrativeIssue,
  scanCharacterTruthCausality,
  scanClueDependencyIndependence,
  scanMatrixDryRun,
  scanRoleRemovalImpact,
  scanSharedInteractionContracts
} from "../src/pipeline-narrative-state-audit.js";

test("issue routing rebuilds only the failed layer and its downstream dependencies", () => {
  const clueRoute = routeNarrativeIssue({ area: "clue_resilience", detail: "两条路径依赖同一解释者" });
  assert.equal(clueRoute.targetStage, "clues");
  assert.deepEqual(clueRoute.invalidates, ["clues", "matrix", "outlines", "scripts", "host", "evaluation"]);
  const plan = buildRepairPlan({
    issues: [{ severity: "high", area: "player_prose_gate", cell: "role-1_ch1", detail: "人称漂移" }]
  });
  assert.equal(plan.earliestStage, "scripts");
  assert.deepEqual(plan.items[0].invalidates, ["scripts", "evaluation"]);
  assert.equal(routeNarrativeIssue({ area: "roleAgency", detail: "角色没有行动" }).targetStage, "characters");
  assert.equal(routeNarrativeIssue({ targetLayer: "matrix", detail: "线索破坏后的公共流程失效" }).targetStage, "matrix");
});

test("character pressure test can explicitly route a contradiction back to truth", () => {
  const result = scanCharacterTruthCausality({
    roles: [{
      key: "role-1",
      agencyProfile: {
        agencyProof: "能藏起账本",
        dependencyProof: "只有他会读旧账",
        exposurePlan: [{ actKey: "ch1", interaction: "当面对账", affectedRoleKeys: ["role-2"] }],
        removalImpact: "删除后对账行动与一段关系同时消失"
      }
    }],
    truthStressTests: [{
      truthNodeKey: "truth-1",
      roleKeys: ["role-1"],
      pressureChain: "现有利益不足以让他烧掉账本",
      behaviorVerdict: "truth_revision",
      contradiction: "他没有理由替仇人销毁证据",
      revisionTarget: "truth-1.action"
    }]
  }, {
    truthNodes: [{ key: "truth-1", importance: "critical" }]
  });
  assert.equal(result.passed, false);
  assert.equal(result.violations[0].targetStage, "truth");
});

test("two clue routes fail when their nominal independence shares an interpreter", () => {
  const result = scanClueDependencyIndependence({
    truthCoverage: [{
      truthNodeKey: "truth-1",
      paths: [
        { key: "a", requiredRoleKeys: ["role-1"], requiredInterpreterRoleKeys: ["role-3"], requiredActKeys: ["ch1"], reasoningMode: "comparison", dependencyMetadataComplete: true },
        { key: "b", requiredRoleKeys: ["role-2"], requiredInterpreterRoleKeys: ["role-3"], requiredActKeys: ["ch2"], reasoningMode: "testimony", dependencyMetadataComplete: true }
      ]
    }]
  }, { truthNodes: [{ key: "truth-1", importance: "critical" }] });
  assert.equal(result.passed, false);
  assert.ok(result.violations.some((issue) => issue.code === "clue_paths_share_interpreter"));
});

test("clue dependency audit rejects paths that never declared their real dependencies", () => {
  const result = scanClueDependencyIndependence({
    truthCoverage: [{
      truthNodeKey: "truth-1",
      paths: [
        { key: "a", requiredRoleKeys: [], requiredInterpreterRoleKeys: [], requiredActKeys: [], reasoningMode: "mixed", dependencyMetadataComplete: false },
        { key: "b", requiredRoleKeys: [], requiredInterpreterRoleKeys: [], requiredActKeys: ["ch2"], reasoningMode: "comparison", dependencyMetadataComplete: true }
      ]
    }]
  }, { truthNodes: [{ key: "truth-1", importance: "critical" }] });
  assert.ok(result.violations.some((issue) => issue.code === "clue_path_dependency_metadata_incomplete"));
});

test("shared interaction contract separates observable facts from interpretation", () => {
  const result = scanSharedInteractionContracts({
    actContracts: [{
      actKey: "ch1",
      sceneSequence: [{
        sceneKey: "ch1-s1",
        presentRoleKeys: ["role-1", "role-2"],
        observableBeats: [{
          key: "beat-1",
          actorRoleKey: "role-1",
          actionOrLine: "把钥匙放到桌边",
          interpretationFreedom: "可以理解为交出，也可以理解为引诱对方先拿"
        }]
      }]
    }]
  });
  assert.equal(result.passed, true);
});

test("pre-prose dry run catches idle cells and unplaced exploration clues", () => {
  const result = scanMatrixDryRun({
    characterArchives: { roles: [{ key: "role-1" }] },
    infoMatrix: {
      rows: [{ roleKey: "role-1", actKey: "ch1", tasks: [], newClueIds: [] }],
      actContracts: [{ actKey: "ch1", sceneSequence: [{ sceneKey: "ch1-s1", presentRoleKeys: ["role-1"], entryAction: "开门", stateChange: "门被打开" }] }]
    },
    clueNetwork: { clues: [{ key: "clue-1", grantMode: "explore", acquisition: { sceneKey: "missing-scene" } }] }
  });
  assert.equal(result.passed, false);
  assert.ok(result.violations.some((issue) => issue.code === "idle_role_act"));
  assert.ok(result.violations.some((issue) => issue.code === "explore_clue_without_scene"));
});

test("removal audit measures Agency Dependency and Exposure instead of information volume", () => {
  const archives = {
    roles: [
      {
        key: "role-1",
        playableMoves: ["藏起钥匙", "把钥匙交给另一人"],
        relationshipDebts: [{ roleKey: "role-2" }],
        agencyProfile: {
          agencyProof: "能改变门是否打开",
          dependencyProof: "别人需要他的钥匙",
          exposurePlan: [{ actKey: "ch1", interaction: "决定是否开门", affectedRoleKeys: ["role-2"] }],
          removalImpact: "删除后门无法由玩家决定是否打开"
        }
      },
      { key: "role-2", playableMoves: [], relationshipDebts: [], agencyProfile: {} }
    ]
  };
  const result = scanRoleRemovalImpact(archives, {
    clues: [{ key: "clue-1", holderRoleKeys: ["role-1"], interpreterRoleKeys: [], involvedRoleKeys: [] }]
  }, {
    decisions: [{ options: [{ benefitingRoleKeys: ["role-1"], harmedRoleKeys: [], counterplayRoleKeys: [] }] }],
    actContracts: [{ sceneSequence: [{ presentRoleKeys: ["role-1", "role-2"] }] }],
    rows: [{ roleKey: "role-1", tasks: ["决定是否开门"], newClueIds: [] }]
  });
  assert.equal(result.passed, false);
  assert.ok(result.metrics.find((item) => item.roleKey === "role-1").agency >= 2);
  assert.ok(result.violations.some((issue) => issue.roleKey === "role-2"));
});

test("artifact manifest fingerprints the semantic dependency graph deterministically", () => {
  const first = buildArtifactDependencyManifest({ truthBible: { summary: "A" }, scripts: { r1: "text" } });
  const second = buildArtifactDependencyManifest({ scripts: { r1: "text" }, truthBible: { summary: "A" } });
  assert.equal(first.artifacts.truth.fingerprint, second.artifacts.truth.fingerprint);
  assert.deepEqual(first.artifacts.matrix.dependsOn, ["truth", "characters", "clues"]);
});

test("field-level manifest invalidates only the affected role-act branch", () => {
  const input = {
    truthBible: { summary: "A", truthNodes: [{ key: "truth-1", statement: "门曾打开" }] },
    characterArchives: { roles: [{ key: "role-1", knownTruthNodeKeys: ["truth-1"] }, { key: "role-2", knownTruthNodeKeys: [] }] },
    clueNetwork: { clues: [{ key: "clue-1", truthNodeKeys: ["truth-1"], holderRoleKeys: ["role-1"], actKey: "ch1" }] },
    infoMatrix: {
      actContracts: [{ actKey: "ch1", sceneSequence: [{ presentRoleKeys: ["role-1", "role-2"] }] }],
      decisions: [{ key: "decision-1", actKey: "ch1", options: [] }],
      rows: [
        { roleKey: "role-1", actKey: "ch1", newClueIds: ["clue-1"] },
        { roleKey: "role-2", actKey: "ch1", newClueIds: [] }
      ]
    },
    scripts: {
      "role-1": { ch1: { body: "第一版" } },
      "role-2": { ch1: { body: "不相关正文" } }
    },
    hostRunbooks: [{ actKey: "ch1", openingReadAloud: "开场" }]
  };
  const before = buildArtifactDependencyManifest(input);
  const after = buildArtifactDependencyManifest({
    ...input,
    scripts: { ...input.scripts, "role-1": { ch1: { body: "第二版" } } }
  });
  const diff = diffArtifactDependencyManifests(before, after);
  assert.ok(diff.changedPaths.includes("scripts.cells.role-1.ch1"));
  assert.ok(!diff.invalidatedPaths.includes("scripts.cells.role-2.ch1"));
  const plan = buildRepairPlan({
    revisions: [{ targetLayer: "scripts", targetKey: "role-1_ch1", problem: "人称漂移" }],
    manifest: before
  });
  assert.deepEqual(plan.items[0].targetPaths, ["scripts.cells.role-1.ch1"]);
  assert.ok(!plan.items[0].invalidatesPaths.includes("scripts.cells.role-2.ch1"));
});
