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

test("mechanism simulator reports equivalent choices, resource overflow and reachable endings", async () => {
  const { simulateMechanismPackage, summarizeMechanismSimulation } =
    await import("../src/mechanism-simulator.js");
  const packageValue = compileMechanismPackage(outlineFixture());
  packageValue.decisionNodes[0].options.push({
    key: "freeze-copy",
    choiceText: "提交另一份相同快照",
    immediateConsequence: "",
    effects: [
      {
        targetType: "state",
        targetKey: "state-source",
        operation: "set",
        value: "frozen",
      },
    ],
  });
  packageValue.decisionNodes[0].options[0].effects.push({
    targetType: "resource",
    targetKey: "review-seat",
    operation: "lose",
    amount: 2,
  });
  packageValue.decisionNodes[0].options[1].effects.push({
    targetType: "resource",
    targetKey: "review-seat",
    operation: "lose",
    amount: 2,
  });
  const report = simulateMechanismPackage(packageValue);
  const summary = summarizeMechanismSimulation(report);
  assert.equal(report.pathCount, 4);
  assert.deepEqual(report.reachableEndingRouteKeys, ["ending-frozen"]);
  assert.equal(summary.countsByCode.equivalent_decision_options, 1);
  assert.ok(summary.countsByCode.resource_below_minimum >= 1);
});

test("mechanism simulator enumerates optional investigation success, failure and skip combinations", async () => {
  const { simulateMechanismPackage } =
    await import("../src/mechanism-simulator.js");
  const packageValue = compileMechanismPackage(outlineFixture());
  packageValue.decisionNodes[0].options = [
    packageValue.decisionNodes[0].options[0],
  ];
  packageValue.decisionNodes[0].interaction = {
    ...packageValue.decisionNodes[0].interaction,
    kind: "timed_crisis",
    deadlineSeconds: 60,
    defaultOptionKey: "freeze",
  };
  packageValue.evidenceGraph.evidence.push({
    key: "evidence-secondary",
    availableChapterKey: "chapter-1",
  });
  packageValue.investigationActions.push({
    key: "investigate-secondary",
    roundKey: "chapter-1",
    evidenceKey: "evidence-secondary",
    success: {
      stateWrites: [],
      resourceDeltas: [],
      unlocksEvidenceKeys: ["evidence-secondary"],
      locksEvidenceKeys: [],
    },
    failure: {
      stateWrites: [],
      resourceDeltas: [],
      unlocksEvidenceKeys: [],
      locksEvidenceKeys: ["evidence-secondary"],
    },
  });

  const report = simulateMechanismPackage(packageValue);
  const combinations = report.paths
    .map((path) =>
      path.trace
        .filter((step) => step.investigationKey)
        .map((step) => `${step.investigationKey}:${step.outcome}`)
        .join("|"),
    )
    .sort();

  assert.equal(report.pathCount, 6);
  assert.deepEqual(combinations, [
    "",
    "investigate-evidence-signature:success",
    "investigate-evidence-signature:success|investigate-secondary:failure",
    "investigate-evidence-signature:success|investigate-secondary:success",
    "investigate-secondary:failure",
    "investigate-secondary:success",
  ]);
});

test("mechanism simulator runs a conservative no-action strategy and diagnoses missing defaults", async () => {
  const { simulateMechanismPackage } =
    await import("../src/mechanism-simulator.js");
  const withoutDefault = compileMechanismPackage(outlineFixture());
  const blockedReport = simulateMechanismPackage(withoutDefault);

  assert.equal(blockedReport.strategies.noAction.status, "blocked");
  assert.equal(
    blockedReport.strategies.noAction.stoppedRoundKey,
    "chapter-1",
  );
  assert.ok(
    blockedReport.issues.some(
      (issue) => issue.code === "no_action_decision_without_default",
    ),
  );

  const withDefault = compileMechanismPackage(outlineFixture());
  withDefault.decisionNodes[0].interaction = {
    ...withDefault.decisionNodes[0].interaction,
    kind: "timed_crisis",
    deadlineSeconds: 60,
    defaultOptionKey: "freeze",
  };
  const completedReport = simulateMechanismPackage(withDefault);

  assert.equal(completedReport.strategies.noAction.status, "completed");
  assert.equal(
    completedReport.strategies.noAction.resolvedEndingRouteKey,
    "ending-frozen",
  );
  assert.ok(
    completedReport.strategies.noAction.reproductionPath.every(
      (step) => step.strategy === "no_action",
    ),
  );
  assert.ok(
    !completedReport.issues.some(
      (issue) => issue.code === "no_action_decision_without_default",
    ),
  );
});

test("mechanism simulator proves inevitable exhaustion only with complete coverage and emits shortest author diagnostics", async () => {
  const { simulateMechanismPackage, summarizeMechanismSimulation } =
    await import("../src/mechanism-simulator.js");
  const packageValue = compileMechanismPackage(outlineFixture());
  packageValue.decisionNodes[0].interaction = {
    ...packageValue.decisionNodes[0].interaction,
    kind: "timed_crisis",
    deadlineSeconds: 60,
    defaultOptionKey: "freeze",
  };
  packageValue.rounds[1].resourceDeltas = [
    { resourceKey: "review-seat", operation: "lose", amount: 2 },
  ];

  const report = simulateMechanismPackage(packageValue);
  const exhaustion = report.resourceExhaustion.find(
    (entry) => entry.resourceKey === "review-seat",
  );
  const overflow = report.issues.find(
    (issue) => issue.code === "resource_below_minimum",
  );
  const authorDiagnostic = report.authorDiagnostics.find(
    (diagnostic) => diagnostic.code === "resource_inevitably_exhausted",
  );
  const summary = summarizeMechanismSimulation(report);

  assert.equal(exhaustion.status, "inevitable");
  assert.equal(exhaustion.guaranteedByRoundKey, "chapter-2");
  assert.equal(overflow.reproductionPath.length, 1);
  assert.equal(overflow.reproductionPath[0].decisionKey, "decision-freeze");
  assert.equal(authorDiagnostic.severity, "must_fix");
  assert.match(authorDiagnostic.message, /所有 2 条完整路径/);
  assert.ok(authorDiagnostic.suggestedDirection.length > 10);
  assert.deepEqual(summary.authorDiagnostics, report.authorDiagnostics);

  const truncatedReport = simulateMechanismPackage(packageValue, {
    pathLimit: 1,
  });
  assert.equal(truncatedReport.truncated, true);
  assert.equal(
    truncatedReport.resourceExhaustion.find(
      (entry) => entry.resourceKey === "review-seat",
    ).status,
    "inconclusive",
  );
  assert.ok(
    !truncatedReport.issues.some(
      (issue) => issue.code === "resource_inevitably_exhausted",
    ),
  );
});
