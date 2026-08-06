import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMechanismPackage,
  compileMechanismPackage,
  projectMechanismRound
} from "../src/mechanism-package.js";

function outlineFixture() {
  return {
    semanticConstitution: {
      facts: [{ key: "fact-lock", subjectKey: "system-lock", predicate: "is", objectValue: "sealed" }],
      authorizationGrants: [],
      branchEvents: [{ key: "branch-open", chapterKey: "chapter-2", description: "复核通道开启" }],
      worldRules: []
    },
    causalTimeline: [],
    entities: [{ key: "system-lock", type: "system", name: "封存主机" }],
    resources: [{ key: "review-seat", name: "复核席位", initialValue: 1, minimum: 0, maximum: 1 }],
    players: [{
      key: "role-a",
      publicGoal: "查明记录",
      hiddenGoal: "保留资格",
      coreSecret: "曾越权读取记录",
      secretFactKeys: ["fact-lock"],
      chapterActions: [{
        chapterKey: "chapter-1",
        action: "比对签名",
        actionTargetKey: "system-lock",
        decisionKey: "decision-freeze",
        optionKeys: ["freeze"]
      }]
    }],
    evidenceGraph: {
      evidence: [{
        key: "evidence-signature",
        label: "签名快照",
        availableChapterKey: "chapter-1",
        obtainedBy: "校验签名链",
        methodOperation: "比对哈希与签名",
        artifactProduced: "签名校验报告",
        originRootKeys: ["system-lock"],
        storageEntityKey: "system-lock"
      }],
      conclusions: [{ key: "conclusion-lock", statement: "记录曾被封存", evidenceKeys: ["evidence-signature"] }]
    },
    chapterBeats: [{
      chapterKey: "chapter-1",
      title: "冻结来源",
      stateReads: [],
      stateWrites: [],
      resourceDeltas: [],
      evidenceKeys: ["evidence-signature"],
      unlocksEvidenceKeys: [],
      locksEvidenceKeys: [],
      decision: {
        key: "decision-freeze",
        stateKey: "state-source",
        question: "是否冻结签名快照？",
        options: [{ key: "freeze", choiceText: "冻结签名快照", sets: { stateKey: "state-source", value: "frozen" } }]
      }
    }, {
      chapterKey: "chapter-2",
      title: "责任复核",
      stateReads: [{ stateKey: "state-source", operator: "equals", value: "frozen" }],
      stateWrites: [],
      resourceDeltas: [{ resourceKey: "review-seat", operation: "subtract", amount: 1 }],
      evidenceKeys: [],
      unlocksEvidenceKeys: [],
      locksEvidenceKeys: [],
      onReadPass: { variantKey: "review-open", effectSummary: "进入完整复核" },
      onReadFail: { variantKey: "review-limited", fallbackAction: "进入有限复核", additionalCosts: [] },
      decision: { options: [] }
    }],
    endingLogic: {
      stateVariables: [{
        key: "state-source",
        valueType: "enum",
        initialValue: "open",
        allowedValues: ["open", "frozen"],
        setInChapterKey: "chapter-1"
      }],
      defaultRouteKey: "ending-default",
      conflictResolution: "highest-priority",
      routes: [{
        key: "ending-frozen",
        requirements: [{ targetType: "state", targetKey: "state-source", operator: "equals", value: "frozen" }]
      }, { key: "ending-default", isDefault: true, requirements: [] }]
    }
  };
}

test("mechanism package compiles authored outline domains into an executable round projection", () => {
  const packageValue = compileMechanismPackage(outlineFixture());
  assert.equal(packageValue.schemaVersion, 1);
  assert.equal(packageValue.rounds.length, 2);
  assert.equal(packageValue.investigationActions[0].evidenceKey, "evidence-signature");
  assert.deepEqual(packageValue.decisionNodes[0].options[0].effects[0], {
    targetType: "state",
    targetKey: "state-source",
    operation: "set",
    value: "frozen",
    consequence: ""
  });

  const projection = projectMechanismRound(packageValue, "proposal-ch1", { sequence: 1 });
  assert.equal(projection.roundKey, "chapter-1");
  assert.equal(projection.actions[0].roleKey, "role-a");
  assert.equal(projection.decisionNodes[0].key, "decision-freeze");
  assert.equal(projection.evidence[0].key, "evidence-signature");
  assert.deepEqual(projection.endingRouteKeys, ["ending-frozen"]);
});

test("mechanism package rejects dangling deterministic runtime references", () => {
  const packageValue = compileMechanismPackage(outlineFixture());
  packageValue.decisionNodes[0].options[0].effects[0].targetKey = "state-missing";
  assert.throws(() => assertMechanismPackage(packageValue), /unknown state state-missing/);
});

test("mechanism simulator reports equivalent choices, resource overflow and reachable endings", async () => {
  const { simulateMechanismPackage, summarizeMechanismSimulation } = await import("../src/mechanism-simulator.js");
  const packageValue = compileMechanismPackage(outlineFixture());
  packageValue.decisionNodes[0].options.push({
    key: "freeze-copy",
    choiceText: "提交另一份相同快照",
    immediateConsequence: "",
    effects: [{ targetType: "state", targetKey: "state-source", operation: "set", value: "frozen" }]
  });
  packageValue.decisionNodes[0].options[0].effects.push({
    targetType: "resource",
    targetKey: "review-seat",
    operation: "lose",
    amount: 2
  });
  packageValue.decisionNodes[0].options[1].effects.push({
    targetType: "resource",
    targetKey: "review-seat",
    operation: "lose",
    amount: 2
  });
  const report = simulateMechanismPackage(packageValue);
  const summary = summarizeMechanismSimulation(report);
  assert.equal(report.pathCount, 2);
  assert.deepEqual(report.reachableEndingRouteKeys, ["ending-frozen"]);
  assert.equal(summary.countsByCode.equivalent_decision_options, 1);
  assert.ok(summary.countsByCode.resource_below_minimum >= 1);
});
