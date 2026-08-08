import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMechanismPackage,
  compileMechanismPackage,
} from "../src/mechanism-package.js";
import {
  analyzeMechanismRuntimeReachability,
  advanceMechanismRound,
  executeMechanismDecision,
  executeMechanismInvestigation,
  executeMechanismOverride,
  initializeMechanismRuntime,
  projectMechanismRuntime,
  projectPlayerMechanismRuntime,
  resolvePlayerMechanismAnswer,
  resolvePlayerMechanismSelection,
} from "../src/mechanism-runtime.js";
import {
  inspectMechanismDeadlineDefault,
  prepareMechanismMajorityAction,
} from "../src/room-mechanism-runtime-service.js";

function runtimePackage() {
  return compileMechanismPackage({
    semanticConstitution: {
      facts: [],
      authorizationGrants: [],
      branchEvents: [],
      worldRules: [],
    },
    causalTimeline: [],
    entities: [{ key: "system-a", type: "system", name: "主机" }],
    resources: [
      {
        key: "review-seat",
        name: "复核席位",
        valueType: "integer",
        initialValue: 2,
        minimum: 0,
        maximum: 2,
      },
    ],
    players: [],
    evidenceGraph: {
      evidence: [
        {
          key: "evidence-log",
          label: "操作日志",
          availableChapterKey: "round-2",
          obtainedBy: "调取隔离日志",
          methodOperation: "校验签名",
          artifactProduced: "签名报告",
          originRootKeys: ["system-a"],
          storageEntityKey: "system-a",
        },
      ],
      conclusions: [],
    },
    chapterBeats: [
      {
        chapterKey: "round-1",
        title: "确认授权",
        stateReads: [],
        stateWrites: [],
        resourceDeltas: [],
        evidenceKeys: [],
        unlocksEvidenceKeys: [],
        locksEvidenceKeys: [],
        decision: {
          key: "decision-auth",
          stateKey: "state-auth",
          question: "是否承认授权？",
          interaction: {
            kind: "timed_crisis",
            deadlineSeconds: 1080,
            defaultOptionKey: "accept",
            hostInstruction: "十八分钟后按默认后果推进。",
          },
          options: [
            {
              key: "accept",
              choiceText: "承认授权",
              presentation: {
                publicPreview: "承认本轮代理行为",
                riskLabel: "后续申诉范围收窄",
              },
              effects: [
                {
                  targetType: "state",
                  targetKey: "state-auth",
                  operation: "set",
                  value: "accepted",
                },
              ],
            },
          ],
        },
      },
      {
        chapterKey: "round-2",
        title: "复核日志",
        stateReads: [
          { stateKey: "state-auth", operator: "equals", value: "accepted" },
        ],
        entryConditionMode: "all",
        onReadPass: { variantKey: "full-review" },
        onReadFail: {
          variantKey: "limited-review",
          stateWrites: [],
          additionalCosts: [],
        },
        stateWrites: [],
        resourceDeltas: [
          { resourceKey: "review-seat", operation: "lose", amount: 1 },
        ],
        evidenceKeys: ["evidence-log"],
        unlocksEvidenceKeys: [],
        locksEvidenceKeys: [],
        decision: { options: [] },
      },
    ],
    endingLogic: {
      stateVariables: [
        {
          key: "state-auth",
          valueType: "enum",
          initialValue: "unknown",
          allowedValues: ["unknown", "accepted"],
          setInChapterKey: "round-1",
        },
      ],
      defaultRouteKey: "ending-default",
      conflictResolution: "highest-priority",
      routes: [
        {
          key: "ending-accepted",
          title: "授权成立",
          priority: 10,
          requirements: [
            {
              targetType: "state",
              targetKey: "state-auth",
              operator: "equals",
              value: "accepted",
            },
          ],
        },
        {
          key: "ending-default",
          title: "暂缓处理",
          priority: 0,
          isDefault: true,
          requirements: [],
        },
      ],
    },
  });
}

test("room mechanism runtime executes decisions, investigations and cumulative ending state", () => {
  const packageValue = runtimePackage();
  const initialized = initializeMechanismRuntime(packageValue);
  assert.equal(initialized.runtime.currentRoundKey, "round-1");
  assert.equal(initialized.runtime.preparedRoundKey, "round-1");
  assert.throws(
    () => advanceMechanismRound(initialized.runtime, packageValue),
    (error) => error.code === "MECHANISM_DECISIONS_PENDING",
  );

  const decided = executeMechanismDecision(initialized.runtime, packageValue, {
    decisionKey: "decision-auth",
    optionKey: "accept",
  });
  assert.equal(decided.runtime.states["state-auth"], "accepted");
  assert.equal(
    initialized.runtime.states["state-auth"],
    "unknown",
    "reducers must not mutate the persisted input",
  );

  const advanced = advanceMechanismRound(decided.runtime, packageValue);
  assert.equal(advanced.runtime.currentRoundKey, "round-2");
  assert.equal(advanced.runtime.currentVariantKey, "full-review");
  assert.equal(advanced.runtime.resources["review-seat"], 1);

  const projected = projectMechanismRuntime(advanced.runtime, packageValue);
  assert.equal(
    projected.availableInvestigations[0].key,
    "investigate-evidence-log",
  );
  const investigated = executeMechanismInvestigation(
    advanced.runtime,
    packageValue,
    {
      investigationKey: "investigate-evidence-log",
      outcome: "success",
    },
  );
  assert.equal(investigated.runtime.evidence["evidence-log"], "available");

  const completed = advanceMechanismRound(investigated.runtime, packageValue);
  assert.equal(completed.runtime.status, "completed");
  assert.equal(completed.runtime.ending.resolvedRouteKey, "ending-accepted");
});

test("mechanism clue grants emit external settlement changes without leaking into player state", () => {
  const packageValue = runtimePackage();
  packageValue.roleDisclosureStates.push({
    roleKey: "role-captain",
    publicGoal: "",
    hiddenGoal: "",
    coreSecret: "",
    secretFactKeys: [],
    authorizationGrantKeys: [],
    disclosureStateKey: "",
  });
  packageValue.decisionNodes[0].options[0].effects.push({
    targetType: "clue",
    targetKey: "clue-order",
    operation: "grant",
    roleKey: "role-captain",
    consequence: "发放密令残页",
  });
  assertMechanismPackage(packageValue);

  const { runtime } = initializeMechanismRuntime(packageValue);
  const result = executeMechanismDecision(runtime, packageValue, {
    decisionKey: "decision-auth",
    optionKey: "accept",
  });
  assert.deepEqual(
    result.changes.find((change) => change.targetType === "clue"),
    {
      targetType: "clue",
      targetKey: "clue-order",
      roleKey: "role-captain",
      operation: "grant",
      before: null,
      after: "granted",
      sourceKey: "decision-auth:accept",
      consequence: "发放密令残页",
    },
  );
  assert.equal(Object.hasOwn(result.runtime, "grantedClues"), false);

  const player = JSON.stringify(
    projectPlayerMechanismRuntime(result.runtime, packageValue),
  );
  assert.equal(player.includes("clue-order"), false);
  assert.equal(player.includes("role-captain"), false);

  packageValue.decisionNodes[0].options[0].effects[1].roleKey = "role-missing";
  assert.throws(
    () => assertMechanismPackage(packageValue),
    /references unknown role role-missing/,
  );
});

test("player mechanism projection exposes the current prompt without host internals", () => {
  const packageValue = runtimePackage();
  packageValue.rounds[0].goal = "确认数字代理是否越权";
  packageValue.rounds[0].playerAction = "讨论授权边界并形成共同意见";
  packageValue.rounds[0].genreMechanicUse = "赛事复核";
  packageValue.rounds[0].hostNotes = "主持人秘密提示";
  const { runtime } = initializeMechanismRuntime(packageValue);
  const projected = projectPlayerMechanismRuntime(runtime, packageValue, {
    revision: 7,
    updatedAt: "2026-08-06T10:00:00.000Z",
    roundStartedAt: "2026-08-06T09:42:00.000Z",
    ownSubmissions: [
      {
        decisionKey: "decision-auth",
        optionKey: "accept",
        submittedAt: "2026-08-06T10:01:00.000Z",
      },
    ],
  });
  assert.equal(projected.status, "running");
  assert.equal(projected.currentRound.title, "确认授权");
  assert.equal(
    projected.currentRound.playerAction,
    "讨论授权边界并形成共同意见",
  );
  assert.equal(projected.decisions[0].options[0].choiceText, "承认授权");
  assert.equal(projected.decisions[0].key, "choice-1");
  assert.equal(projected.decisions[0].options[0].key, "option-1");
  assert.equal(projected.decisions[0].interaction.kind, "timed_crisis");
  assert.equal(projected.decisions[0].interaction.deadlineSeconds, 1080);
  assert.equal(projected.decisions[0].interaction.defaultOptionKey, "option-1");
  assert.equal(
    projected.decisions[0].interaction.submissionMode,
    "advisory_choice",
  );
  assert.equal(projected.decisions[0].deadlineAt, "2026-08-06T10:00:00.000Z");
  assert.equal(projected.decisions[0].submission.optionKey, "option-1");
  assert.equal(
    projected.decisions[0].options[0].presentation.publicPreview,
    "承认本轮代理行为",
  );
  const serialized = JSON.stringify(projected);
  for (const hidden of [
    "state-auth",
    "review-seat",
    "evidence-log",
    "主持人秘密提示",
    "effects",
    "decision-auth",
  ]) {
    assert.equal(
      serialized.includes(hidden),
      false,
      `${hidden} must not cross the player boundary`,
    );
  }

  const waiting = projectPlayerMechanismRuntime(null, packageValue);
  assert.equal(waiting.status, "not_started");
  assert.equal(waiting.initialized, false);
});

test("player mechanism handles resolve without accepting authored keys", () => {
  const packageValue = runtimePackage();
  const { runtime } = initializeMechanismRuntime(packageValue);
  const available = projectMechanismRuntime(
    runtime,
    packageValue,
  ).availableDecisions;
  const resolved = resolvePlayerMechanismSelection(
    available,
    "choice-1",
    "option-1",
  );
  assert.equal(resolved.decisionKey, "decision-auth");
  assert.equal(resolved.optionKey, "accept");
  assert.equal(
    resolvePlayerMechanismSelection(available, "decision-auth", "accept"),
    null,
  );
});

test("structured player answers resolve opaque handles and never project authored keys", () => {
  const packageValue = runtimePackage();
  packageValue.decisionNodes[0].options.push({
    key: "reject",
    choiceText: "拒绝授权",
    presentation: {},
    effects: [],
  });
  packageValue.decisionNodes[0].interaction = { kind: "free_ranking" };
  const { runtime } = initializeMechanismRuntime(packageValue);
  const available = projectMechanismRuntime(runtime, packageValue).availableDecisions;
  const ranking = resolvePlayerMechanismAnswer(available, "choice-1", {
    type: "ranking",
    optionKeys: ["option-2", "option-1"],
  });
  assert.deepEqual(ranking.answer.optionKeys, ["reject", "accept"]);
  assert.equal(
    resolvePlayerMechanismAnswer(available, "choice-1", {
      type: "ranking",
      optionKeys: ["reject", "accept"],
    }),
    null,
  );
  const projected = projectPlayerMechanismRuntime(runtime, packageValue, {
    ownSubmissions: [
      {
        decisionKey: "decision-auth",
        optionKey: "reject",
        answer: ranking.answer,
        submittedAt: "2026-08-08T10:00:00.000Z",
      },
    ],
  });
  assert.deepEqual(projected.decisions[0].submission.answer, {
    type: "ranking",
    optionKeys: ["option-2", "option-1"],
  });
  assert.doesNotMatch(JSON.stringify(projected), /decision-auth|reject|accept/);

  packageValue.decisionNodes[0].interaction = {
    kind: "numeric_allocation",
    allocationTotal: 10,
  };
  const allocationAvailable = projectMechanismRuntime(
    runtime,
    packageValue,
  ).availableDecisions;
  const allocation = resolvePlayerMechanismAnswer(allocationAvailable, "choice-1", {
    type: "allocation",
    allocations: [
      { optionKey: "option-1", amount: 4 },
      { optionKey: "option-2", amount: 6 },
    ],
  });
  assert.equal(allocation.optionKey, "reject");
  assert.equal(
    resolvePlayerMechanismAnswer(allocationAvailable, "choice-1", {
      type: "allocation",
      allocations: [
        { optionKey: "option-1", amount: 4 },
        { optionKey: "option-2", amount: 5 },
      ],
    }),
    null,
  );
});

test("role commitments project as private player submissions", () => {
  const packageValue = runtimePackage();
  packageValue.decisionNodes[0].interaction = {
    kind: "role_commitment",
    label: "秘密承诺",
    playerInstruction: "选择你愿意承担的个人代价。",
    hostInstruction: "逐人核对承诺，不向其他玩家公开。",
  };
  const { runtime } = initializeMechanismRuntime(packageValue);
  const projected = projectPlayerMechanismRuntime(runtime, packageValue);
  assert.equal(
    projected.decisions[0].interaction.submissionMode,
    "private_choice",
  );
  assert.equal(projected.decisions[0].interaction.deadlineSeconds, 0);
  assert.equal(projected.decisions[0].deadlineAt, null);
});

test("deadline policy only permits the authored default after server expiry", () => {
  const packageValue = runtimePackage();
  const { runtime } = initializeMechanismRuntime(packageValue);
  const state = {
    runtime,
    roundStartedAt: "2026-08-06T09:42:00.000Z",
  };
  const beforeDeadline = inspectMechanismDeadlineDefault({
    state,
    packageValue,
    action: {
      type: "decision",
      source: "deadline_default",
      decisionKey: "decision-auth",
      optionKey: "accept",
    },
    now: new Date("2026-08-06T09:59:59.000Z"),
  });
  assert.equal(beforeDeadline.allowed, false);
  assert.equal(beforeDeadline.reason, "too_early");

  const normalAfterDeadline = inspectMechanismDeadlineDefault({
    state,
    packageValue,
    action: {
      type: "decision",
      decisionKey: "decision-auth",
      optionKey: "accept",
    },
    now: new Date("2026-08-06T10:00:00.000Z"),
  });
  assert.equal(normalAfterDeadline.allowed, false);
  assert.equal(normalAfterDeadline.reason, "deadline_expired");

  const defaultAfterDeadline = inspectMechanismDeadlineDefault({
    state,
    packageValue,
    action: {
      type: "decision",
      source: "deadline_default",
      decisionKey: "decision-auth",
      optionKey: "accept",
    },
    now: new Date("2026-08-06T10:00:00.000Z"),
  });
  assert.equal(defaultAfterDeadline.allowed, true);
  assert.equal(defaultAfterDeadline.reason, "expired");
});

test("server majority settlement derives the option and refuses ties or advisory decisions", () => {
  const decision = {
    key: "decision-secret",
    interaction: { kind: "secret_ballot" },
    options: [{ key: "north" }, { key: "south" }],
  };
  const action = {
    type: "decision",
    source: "majority",
    decisionKey: "decision-secret",
  };
  assert.deepEqual(
    prepareMechanismMajorityAction({
      action,
      decision,
      summary: { majority: { status: "ready", optionKey: "north" } },
    }),
    { ...action, optionKey: "north" },
  );
  assert.equal(
    prepareMechanismMajorityAction({
      action,
      decision,
      summary: { majority: { status: "tie", optionKey: "" } },
    }),
    null,
  );
  assert.equal(
    prepareMechanismMajorityAction({
      action,
      decision: { ...decision, interaction: { kind: "group_choice" } },
      summary: { majority: { status: "ready", optionKey: "north" } },
    }),
    null,
  );
});

test("runtime reachability starts from the persisted room state and reports remaining ending gaps", () => {
  const packageValue = runtimePackage();
  const { runtime } = initializeMechanismRuntime(packageValue);
  const initial = analyzeMechanismRuntimeReachability(runtime, packageValue);
  assert.deepEqual(
    new Set(initial.reachableRouteKeys),
    new Set(["ending-accepted"]),
  );
  assert.equal(
    initial.endingProspects.find((route) => route.key === "ending-accepted")
      .unmetRequirements[0].targetKey,
    "state-auth",
  );

  const decided = executeMechanismDecision(runtime, packageValue, {
    decisionKey: "decision-auth",
    optionKey: "accept",
  });
  const afterDecision = analyzeMechanismRuntimeReachability(
    decided.runtime,
    packageValue,
  );
  assert.equal(
    afterDecision.endingProspects.find(
      (route) => route.key === "ending-accepted",
    ).unmetRequirements.length,
    0,
  );
  assert.ok(afterDecision.exploredStateCount >= 2);
});

test("host override validates registered targets and keeps an explicit audit reason", () => {
  const packageValue = runtimePackage();
  const { runtime } = initializeMechanismRuntime(packageValue);
  const overridden = executeMechanismOverride(runtime, packageValue, {
    reason: "主持人确认线下道具已被玩家正确开启",
    effects: [
      {
        targetType: "state",
        targetKey: "state-auth",
        operation: "set",
        value: "accepted",
      },
    ],
  });
  assert.equal(overridden.runtime.states["state-auth"], "accepted");
  assert.equal(overridden.action.type, "override");
  assert.match(overridden.action.reason, /线下道具/);
  assert.throws(
    () =>
      executeMechanismOverride(runtime, packageValue, {
        reason: "主持人确认线下道具已被玩家正确开启",
        effects: [
          {
            targetType: "evidence",
            targetKey: "missing-evidence",
            operation: "unlock",
          },
        ],
      }),
    (error) => error.code === "MECHANISM_EVIDENCE_UNKNOWN",
  );
});

test("room mechanism runtime rejects out-of-bounds resources before persistence", () => {
  const packageValue = runtimePackage();
  packageValue.decisionNodes[0].options[0].effects.push({
    targetType: "resource",
    targetKey: "review-seat",
    operation: "lose",
    amount: 3,
  });
  const { runtime } = initializeMechanismRuntime(packageValue);
  assert.throws(
    () =>
      executeMechanismDecision(runtime, packageValue, {
        decisionKey: "decision-auth",
        optionKey: "accept",
      }),
    (error) => error.code === "MECHANISM_RESOURCE_OUT_OF_BOUNDS",
  );
  assert.equal(runtime.resources["review-seat"], 2);
});

test("mechanism runtime stores author-defined keys without mutating object prototypes", () => {
  const packageValue = runtimePackage();
  packageValue.stateRegistry[0].key = "__proto__";
  packageValue.decisionNodes[0].stateKey = "__proto__";
  packageValue.decisionNodes[0].options[0].effects[0].targetKey = "__proto__";
  packageValue.rounds[1].stateReads[0].stateKey = "__proto__";
  packageValue.endingRoutes[0].requirements[0].targetKey = "__proto__";

  const initialized = initializeMechanismRuntime(packageValue);
  assert.equal(
    Object.getPrototypeOf(initialized.runtime.states),
    Object.prototype,
  );
  assert.equal(Object.hasOwn(initialized.runtime.states, "__proto__"), true);
  assert.equal(initialized.runtime.states["__proto__"], "unknown");

  const decided = executeMechanismDecision(initialized.runtime, packageValue, {
    decisionKey: "decision-auth",
    optionKey: "accept",
  });
  assert.equal(Object.getPrototypeOf(decided.runtime.states), Object.prototype);
  assert.equal(decided.runtime.states["__proto__"], "accepted");
  assert.equal({}.accepted, undefined);
});
