import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMechanismPackage,
  compileMechanismPackage,
  projectMechanismRound,
} from "../src/mechanism-package.js";

function outlineFixture() {
  return {
    semanticConstitution: {
      facts: [
        {
          key: "fact-lock",
          subjectKey: "system-lock",
          predicate: "is",
          objectValue: "sealed",
        },
      ],
      authorizationGrants: [],
      branchEvents: [
        {
          key: "branch-open",
          chapterKey: "chapter-2",
          description: "复核通道开启",
        },
      ],
      worldRules: [],
    },
    causalTimeline: [],
    entities: [{ key: "system-lock", type: "system", name: "封存主机" }],
    resources: [
      {
        key: "review-seat",
        name: "复核席位",
        initialValue: 1,
        minimum: 0,
        maximum: 1,
      },
    ],
    players: [
      {
        key: "role-a",
        publicGoal: "查明记录",
        hiddenGoal: "保留资格",
        coreSecret: "曾越权读取记录",
        secretFactKeys: ["fact-lock"],
        chapterActions: [
          {
            chapterKey: "chapter-1",
            action: "比对签名",
            actionTargetKey: "system-lock",
            decisionKey: "decision-freeze",
            optionKeys: ["freeze"],
          },
        ],
      },
    ],
    evidenceGraph: {
      evidence: [
        {
          key: "evidence-signature",
          label: "签名快照",
          availableChapterKey: "chapter-1",
          obtainedBy: "校验签名链",
          methodOperation: "比对哈希与签名",
          artifactProduced: "签名校验报告",
          originRootKeys: ["system-lock"],
          storageEntityKey: "system-lock",
        },
      ],
      conclusions: [
        {
          key: "conclusion-lock",
          statement: "记录曾被封存",
          evidenceKeys: ["evidence-signature"],
        },
      ],
    },
    chapterBeats: [
      {
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
          interaction: {
            kind: "resource_tradeoff",
            resourceKey: "review-seat",
            playerInstruction: "用一次复核席位换取签名冻结。",
          },
          options: [
            {
              key: "freeze",
              choiceText: "冻结签名快照",
              presentation: {
                costLabel: "消耗 1 个复核席位",
                riskLabel: "其他来源保持开放",
              },
              sets: { stateKey: "state-source", value: "frozen" },
            },
          ],
        },
      },
      {
        chapterKey: "chapter-2",
        title: "责任复核",
        stateReads: [
          { stateKey: "state-source", operator: "equals", value: "frozen" },
        ],
        stateWrites: [],
        resourceDeltas: [
          { resourceKey: "review-seat", operation: "subtract", amount: 1 },
        ],
        evidenceKeys: [],
        unlocksEvidenceKeys: [],
        locksEvidenceKeys: [],
        onReadPass: {
          variantKey: "review-open",
          effectSummary: "进入完整复核",
        },
        onReadFail: {
          variantKey: "review-limited",
          fallbackAction: "进入有限复核",
          additionalCosts: [],
        },
        decision: { options: [] },
      },
    ],
    endingLogic: {
      stateVariables: [
        {
          key: "state-source",
          valueType: "enum",
          initialValue: "open",
          allowedValues: ["open", "frozen"],
          setInChapterKey: "chapter-1",
        },
      ],
      defaultRouteKey: "ending-default",
      conflictResolution: "highest-priority",
      routes: [
        {
          key: "ending-frozen",
          requirements: [
            {
              targetType: "state",
              targetKey: "state-source",
              operator: "equals",
              value: "frozen",
            },
          ],
        },
        { key: "ending-default", isDefault: true, requirements: [] },
      ],
    },
  };
}

test("mechanism package compiles authored outline domains into an executable round projection", () => {
  const packageValue = compileMechanismPackage(outlineFixture());
  assert.equal(packageValue.schemaVersion, 1);
  assert.equal(packageValue.rounds.length, 2);
  assert.equal(
    packageValue.investigationActions[0].evidenceKey,
    "evidence-signature",
  );
  assert.equal(
    packageValue.decisionNodes[0].interaction.kind,
    "resource_tradeoff",
  );
  assert.equal(
    packageValue.decisionNodes[0].interaction.resourceKey,
    "review-seat",
  );
  assert.equal(
    packageValue.decisionNodes[0].options[0].presentation.costLabel,
    "消耗 1 个复核席位",
  );
  assert.deepEqual(packageValue.decisionNodes[0].options[0].effects[0], {
    targetType: "state",
    targetKey: "state-source",
    operation: "set",
    value: "frozen",
    consequence: "",
  });

  const projection = projectMechanismRound(packageValue, "proposal-ch1", {
    sequence: 1,
  });
  assert.equal(projection.roundKey, "chapter-1");
  assert.equal(projection.actions[0].roleKey, "role-a");
  assert.equal(projection.decisionNodes[0].key, "decision-freeze");
  assert.equal(projection.evidence[0].key, "evidence-signature");
  assert.deepEqual(projection.endingRouteKeys, ["ending-frozen"]);
});
test("mechanism package rejects dangling deterministic runtime references", () => {
  const packageValue = compileMechanismPackage(outlineFixture());
  packageValue.decisionNodes[0].options[0].effects[0].targetKey =
    "state-missing";
  assert.throws(
    () => assertMechanismPackage(packageValue),
    /unknown state state-missing/,
  );

  const investigationPackage = compileMechanismPackage(outlineFixture());
  investigationPackage.investigationActions[0].success.stateWrites = [
    {
      stateKey: "state-missing",
      operation: "set",
      value: "frozen",
    },
  ];
  assert.throws(
    () => assertMechanismPackage(investigationPackage),
    /Investigation investigate-evidence-signature success references unknown key state-missing/,
  );
});
test("mechanism package rejects unsupported interaction kinds and resource references", () => {
  const unsupported = outlineFixture();
  unsupported.chapterBeats[0].decision.interaction.kind = "magic_widget";
  assert.throws(
    () => compileMechanismPackage(unsupported),
    /unsupported interaction kind/,
  );

  const missingResource = outlineFixture();
  missingResource.chapterBeats[0].decision.interaction.resourceKey =
    "missing-budget";
  assert.throws(
    () => compileMechanismPackage(missingResource),
    /unknown key missing-budget/,
  );

  const missingDeadlineDefault = outlineFixture();
  missingDeadlineDefault.chapterBeats[0].decision.interaction = {
    kind: "timed_crisis",
    deadlineSeconds: 60,
  };
  assert.throws(
    () => compileMechanismPackage(missingDeadlineDefault),
    /positive deadline and a default option/,
  );

  const unknownDeadlineDefault = outlineFixture();
  unknownDeadlineDefault.chapterBeats[0].decision.interaction = {
    kind: "timed_crisis",
    deadlineSeconds: 60,
    defaultOptionKey: "missing-option",
  };
  assert.throws(
    () => compileMechanismPackage(unknownDeadlineDefault),
    /deadline default references unknown option/,
  );
});
