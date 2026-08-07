import { assertMechanismPackage } from "./mechanism-package.js";
import {
  normalizeMechanismOptionPresentation,
  publicMechanismInteraction,
} from "./mechanism-interactions.js";

const asArray = (value) => (Array.isArray(value) ? value : []);
const clone = (value) => structuredClone(value);
const valueSignature = (value) => JSON.stringify(value);

function withRecordValue(record, key, value) {
  return Object.fromEntries([
    ...Object.entries(record ?? {}).filter(([entryKey]) => entryKey !== key),
    [key, value],
  ]);
}

export class MechanismRuntimeError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "MechanismRuntimeError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function fail(code, message, details) {
  throw new MechanismRuntimeError(code, message, details);
}

function requirementSatisfied(current, operator, expected) {
  if (operator === "equals")
    return valueSignature(current) === valueSignature(expected);
  if (operator === "not_equals")
    return valueSignature(current) !== valueSignature(expected);
  if (operator === "includes")
    return Array.isArray(current)
      ? current.some(
          (entry) => valueSignature(entry) === valueSignature(expected),
        )
      : String(current ?? "").includes(String(expected ?? ""));
  const currentNumber = Number(current);
  const expectedNumber = Number(expected);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(expectedNumber))
    return false;
  if (operator === "gte") return currentNumber >= expectedNumber;
  if (operator === "lte") return currentNumber <= expectedNumber;
  return false;
}

function collectionFor(runtime, targetType, facts) {
  if (targetType === "fact") return facts;
  if (targetType === "state") return runtime.states;
  if (targetType === "resource") return runtime.resources;
  if (targetType === "evidence") return runtime.evidence;
  if (targetType === "event") return runtime.events;
  return {};
}

function validateStateValue(packageValue, stateKey, value) {
  const state = packageValue.stateRegistry.find(
    (entry) => entry.key === stateKey,
  );
  if (!state)
    fail("MECHANISM_STATE_UNKNOWN", `Unknown mechanism state ${stateKey}`, {
      stateKey,
    });
  if (state.valueType === "number" && !Number.isFinite(Number(value))) {
    fail("MECHANISM_STATE_INVALID", `State ${stateKey} must be numeric`, {
      stateKey,
      value,
    });
  }
  if (state.valueType === "boolean" && typeof value !== "boolean") {
    fail("MECHANISM_STATE_INVALID", `State ${stateKey} must be boolean`, {
      stateKey,
      value,
    });
  }
  if (state.valueType === "set" && !Array.isArray(value)) {
    fail("MECHANISM_STATE_INVALID", `State ${stateKey} must be a set array`, {
      stateKey,
      value,
    });
  }
  if (
    state.valueType === "enum" &&
    asArray(state.allowedValues).length &&
    !state.allowedValues.some(
      (entry) => valueSignature(entry) === valueSignature(value),
    )
  ) {
    fail(
      "MECHANISM_STATE_INVALID",
      `State ${stateKey} is outside its allowed values`,
      { stateKey, value },
    );
  }
}

function validateResourceValue(packageValue, resourceKey, value) {
  const resource = packageValue.resourceRegistry.find(
    (entry) => entry.key === resourceKey,
  );
  if (!resource)
    fail(
      "MECHANISM_RESOURCE_UNKNOWN",
      `Unknown mechanism resource ${resourceKey}`,
      { resourceKey },
    );
  const number = Number(value);
  if (!Number.isFinite(number))
    fail(
      "MECHANISM_RESOURCE_INVALID",
      `Resource ${resourceKey} must be numeric`,
      { resourceKey, value },
    );
  if (Number.isFinite(resource.minimum) && number < resource.minimum) {
    fail(
      "MECHANISM_RESOURCE_OUT_OF_BOUNDS",
      `Resource ${resourceKey} fell below its minimum`,
      {
        resourceKey,
        value: number,
        minimum: resource.minimum,
      },
    );
  }
  if (Number.isFinite(resource.maximum) && number > resource.maximum) {
    fail(
      "MECHANISM_RESOURCE_OUT_OF_BOUNDS",
      `Resource ${resourceKey} exceeded its maximum`,
      {
        resourceKey,
        value: number,
        maximum: resource.maximum,
      },
    );
  }
}

function setChange(changes, targetType, targetKey, before, after, sourceKey) {
  if (valueSignature(before) === valueSignature(after)) return;
  changes.push({
    targetType,
    targetKey,
    before: clone(before),
    after: clone(after),
    sourceKey,
  });
}

function applyEffect(runtimeInput, effect, packageValue, changes, sourceKey) {
  const runtime = clone(runtimeInput);
  const targetKey = String(effect?.targetKey ?? "");
  if (effect?.targetType === "state") {
    const before = runtime.states[targetKey];
    let after = before;
    if (effect.operation === "set") after = clone(effect.value);
    else if (effect.operation === "increment")
      after = Number(before || 0) + Number(effect.value || 0);
    else if (effect.operation === "decrement")
      after = Number(before || 0) - Number(effect.value || 0);
    else if (effect.operation === "add")
      after = [...asArray(before), clone(effect.value)].filter(
        (entry, index, rows) =>
          rows.findIndex(
            (candidate) => valueSignature(candidate) === valueSignature(entry),
          ) === index,
      );
    else if (effect.operation === "remove")
      after = asArray(before).filter(
        (entry) => valueSignature(entry) !== valueSignature(effect.value),
      );
    else
      fail(
        "MECHANISM_OPERATION_UNSUPPORTED",
        `Unsupported state operation ${effect.operation}`,
        { effect },
      );
    validateStateValue(packageValue, targetKey, after);
    runtime.states = withRecordValue(runtime.states, targetKey, after);
    setChange(changes, "state", targetKey, before, after, sourceKey);
    return runtime;
  }
  if (effect?.targetType === "resource") {
    const before = runtime.resources[targetKey];
    const current = Number(before || 0);
    let after = before;
    if (effect.operation === "gain")
      after = current + Number(effect.amount || 0);
    else if (effect.operation === "lose")
      after = current - Number(effect.amount || 0);
    else if (effect.operation === "set")
      after = Number(effect.amount ?? effect.value ?? 0);
    else
      fail(
        "MECHANISM_OPERATION_UNSUPPORTED",
        `Unsupported resource operation ${effect.operation}`,
        { effect },
      );
    validateResourceValue(packageValue, targetKey, after);
    runtime.resources = withRecordValue(runtime.resources, targetKey, after);
    setChange(changes, "resource", targetKey, before, after, sourceKey);
    return runtime;
  }
  if (effect?.targetType === "evidence") {
    if (
      packageValue &&
      !packageValue.evidenceGraph.evidence.some(
        (entry) => entry.key === targetKey,
      )
    ) {
      fail(
        "MECHANISM_EVIDENCE_UNKNOWN",
        `Unknown mechanism evidence ${targetKey}`,
        { targetKey },
      );
    }
    const before = runtime.evidence[targetKey];
    const after =
      effect.operation === "unlock"
        ? "available"
        : effect.operation === "lock"
          ? "locked"
          : null;
    if (!after)
      fail(
        "MECHANISM_OPERATION_UNSUPPORTED",
        `Unsupported evidence operation ${effect.operation}`,
        { effect },
      );
    runtime.evidence = withRecordValue(runtime.evidence, targetKey, after);
    setChange(changes, "evidence", targetKey, before, after, sourceKey);
    return runtime;
  }
  if (effect?.targetType === "event") {
    if (effect.operation !== "trigger")
      fail(
        "MECHANISM_OPERATION_UNSUPPORTED",
        `Unsupported event operation ${effect.operation}`,
        { effect },
      );
    const before = runtime.events[targetKey];
    runtime.events = withRecordValue(runtime.events, targetKey, true);
    setChange(changes, "event", targetKey, before, true, sourceKey);
    return runtime;
  }
  fail("MECHANISM_EFFECT_INVALID", "Mechanism effect target type is invalid", {
    effect,
  });
}

function applyStateWrites(
  runtimeInput,
  writes,
  packageValue,
  changes,
  sourceKey,
) {
  let runtime = runtimeInput;
  for (const write of asArray(writes))
    runtime = applyEffect(
      runtime,
      {
        targetType: "state",
        targetKey: write.stateKey,
        operation: write.operation,
        value: write.value,
      },
      packageValue,
      changes,
      sourceKey,
    );
  return runtime;
}

function applyResourceDeltas(
  runtimeInput,
  deltas,
  packageValue,
  changes,
  sourceKey,
) {
  let runtime = runtimeInput;
  for (const delta of asArray(deltas))
    runtime = applyEffect(
      runtime,
      {
        targetType: "resource",
        targetKey: delta.resourceKey,
        operation: delta.operation,
        amount: delta.amount,
      },
      packageValue,
      changes,
      sourceKey,
    );
  return runtime;
}

function applyEvidence(runtimeInput, unlocks, locks, changes, sourceKey) {
  let runtime = runtimeInput;
  for (const key of asArray(unlocks))
    runtime = applyEffect(
      runtime,
      {
        targetType: "evidence",
        targetKey: key,
        operation: "unlock",
      },
      null,
      changes,
      sourceKey,
    );
  for (const key of asArray(locks))
    runtime = applyEffect(
      runtime,
      {
        targetType: "evidence",
        targetKey: key,
        operation: "lock",
      },
      null,
      changes,
      sourceKey,
    );
  return runtime;
}

function facts(packageValue) {
  return Object.fromEntries(
    packageValue.factLedger.map((fact) => [fact.key, fact.truthValue]),
  );
}

function prepareRound(runtimeInput, packageValue, round) {
  if (runtimeInput.preparedRoundKey === round.key)
    return { runtime: clone(runtimeInput), changes: [] };
  let runtime = clone(runtimeInput);
  const changes = [];
  const readResults = round.stateReads.map((read) =>
    requirementSatisfied(
      runtime.states[read.stateKey],
      read.operator,
      read.value,
    ),
  );
  const readPassed =
    !readResults.length ||
    (round.entryConditionMode === "any"
      ? readResults.some(Boolean)
      : readResults.every(Boolean));
  runtime.currentBranch = readPassed ? "read_pass" : "read_fail";
  runtime.currentVariantKey = readPassed
    ? round.onReadPass?.variantKey || null
    : round.onReadFail?.variantKey || null;
  if (!readPassed) {
    runtime = applyStateWrites(
      runtime,
      round.onReadFail?.stateWrites,
      packageValue,
      changes,
      `${round.key}:read_fail`,
    );
    runtime = applyResourceDeltas(
      runtime,
      round.onReadFail?.additionalCosts,
      packageValue,
      changes,
      `${round.key}:read_fail`,
    );
    runtime = applyEvidence(
      runtime,
      round.onReadFail?.unlocksEvidenceKeys,
      round.onReadFail?.locksEvidenceKeys,
      changes,
      `${round.key}:read_fail`,
    );
  }
  runtime = applyStateWrites(
    runtime,
    round.stateWrites,
    packageValue,
    changes,
    `${round.key}:mandatory`,
  );
  runtime = applyResourceDeltas(
    runtime,
    round.resourceDeltas,
    packageValue,
    changes,
    `${round.key}:mandatory`,
  );
  runtime = applyEvidence(
    runtime,
    round.unlocksEvidenceKeys,
    round.locksEvidenceKeys,
    changes,
    `${round.key}:mandatory`,
  );
  runtime.preparedRoundKey = round.key;
  return { runtime, changes };
}

function applyWorldRules(runtimeInput, packageValue, roundKey) {
  let runtime = clone(runtimeInput);
  const changes = [];
  const factValues = facts(packageValue);
  for (const rule of packageValue.worldRules.filter(
    (entry) => entry.evaluationChapterKey === roundKey,
  )) {
    if (runtime.events[`world-rule:${rule.key}`] === true) continue;
    const triggersPass = asArray(rule.triggerEventKeys).every(
      (key) => runtime.events[key] === true,
    );
    const conditionsPass = asArray(rule.preconditions).every((requirement) =>
      requirementSatisfied(
        collectionFor(runtime, requirement.targetType, factValues)?.[
          requirement.targetKey
        ],
        requirement.operator,
        requirement.value,
      ),
    );
    if (!triggersPass || !conditionsPass) continue;
    for (const effect of asArray(rule.effects))
      runtime = applyEffect(
        runtime,
        effect,
        packageValue,
        changes,
        `world-rule:${rule.key}`,
      );
    const before = runtime.events[`world-rule:${rule.key}`];
    runtime.events = withRecordValue(
      runtime.events,
      `world-rule:${rule.key}`,
      true,
    );
    setChange(
      changes,
      "event",
      `world-rule:${rule.key}`,
      before,
      true,
      `world-rule:${rule.key}`,
    );
  }
  return { runtime, changes };
}

function resolveEnding(runtime, packageValue) {
  const factValues = facts(packageValue);
  const matched = packageValue.endingRoutes
    .filter(
      (route) =>
        !route.isDefault &&
        asArray(route.requirements).every((requirement) =>
          requirementSatisfied(
            collectionFor(runtime, requirement.targetType, factValues)?.[
              requirement.targetKey
            ],
            requirement.operator,
            requirement.value,
          ),
        ),
    )
    .sort(
      (left, right) => Number(right.priority || 0) - Number(left.priority || 0),
    );
  const defaultRoute =
    packageValue.endingRoutes.find(
      (route) => route.key === packageValue.endingResolution.defaultRouteKey,
    ) || packageValue.endingRoutes.find((route) => route.isDefault);
  return {
    matchedRouteKeys: matched.map((route) => route.key),
    resolvedRouteKey: matched[0]?.key || defaultRoute?.key || null,
  };
}

export function initializeMechanismRuntime(packageInput) {
  const packageValue = assertMechanismPackage(packageInput);
  const rounds = [...packageValue.rounds].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const firstRound = rounds[0] ?? null;
  let runtime = {
    schemaVersion: 1,
    mechanismSchemaVersion: packageValue.schemaVersion,
    status: firstRound ? "running" : "completed",
    currentRoundKey: firstRound?.key ?? null,
    currentRoundSequence: firstRound?.sequence ?? null,
    preparedRoundKey: null,
    currentBranch: null,
    currentVariantKey: null,
    states: Object.fromEntries(
      packageValue.stateRegistry.map((state) => [
        state.key,
        clone(state.initialValue),
      ]),
    ),
    resources: Object.fromEntries(
      packageValue.resourceRegistry.map((resource) => [
        resource.key,
        resource.initialValue,
      ]),
    ),
    evidence: Object.fromEntries(
      packageValue.evidenceGraph.evidence.map((evidence) => [
        evidence.key,
        "unavailable",
      ]),
    ),
    events: {
      ...Object.fromEntries(
        packageValue.eventLedger.map((event) => [event.key, true]),
      ),
      ...Object.fromEntries(
        packageValue.branchFragments
          .filter((fragment) => fragment.branch === "event")
          .map((fragment) => [fragment.key, false]),
      ),
    },
    decisionStates: {},
    executedInvestigations: {},
    ending: null,
  };
  for (const state of packageValue.stateRegistry)
    validateStateValue(packageValue, state.key, runtime.states[state.key]);
  for (const resource of packageValue.resourceRegistry)
    validateResourceValue(
      packageValue,
      resource.key,
      runtime.resources[resource.key],
    );
  if (!firstRound) return { runtime, changes: [] };
  return prepareRound(runtime, packageValue, firstRound);
}

export function executeMechanismDecision(
  runtimeInput,
  packageInput,
  { decisionKey, optionKey },
) {
  const packageValue = assertMechanismPackage(packageInput);
  if (runtimeInput.status !== "running")
    fail(
      "MECHANISM_RUNTIME_COMPLETED",
      "Mechanism runtime is already completed",
    );
  const decision = packageValue.decisionNodes.find(
    (entry) =>
      entry.key === decisionKey &&
      entry.roundKey === runtimeInput.currentRoundKey,
  );
  if (!decision)
    fail(
      "MECHANISM_DECISION_UNAVAILABLE",
      "Decision is not available in the current round",
      { decisionKey },
    );
  if (runtimeInput.decisionStates[decision.key])
    fail(
      "MECHANISM_DECISION_ALREADY_RESOLVED",
      "Decision has already been resolved",
      { decisionKey },
    );
  const option = decision.options.find((entry) => entry.key === optionKey);
  if (!option)
    fail("MECHANISM_OPTION_INVALID", "Decision option is invalid", {
      decisionKey,
      optionKey,
    });
  let runtime = clone(runtimeInput);
  const changes = [];
  for (const effect of option.effects)
    runtime = applyEffect(
      runtime,
      effect,
      packageValue,
      changes,
      `${decision.key}:${option.key}`,
    );
  runtime.decisionStates = withRecordValue(
    runtime.decisionStates,
    decision.key,
    option.key,
  );
  return {
    runtime,
    changes,
    action: { type: "decision", decisionKey, optionKey },
  };
}

export function executeMechanismInvestigation(
  runtimeInput,
  packageInput,
  { investigationKey, outcome = "success" },
) {
  const packageValue = assertMechanismPackage(packageInput);
  if (runtimeInput.status !== "running")
    fail(
      "MECHANISM_RUNTIME_COMPLETED",
      "Mechanism runtime is already completed",
    );
  const action = packageValue.investigationActions.find(
    (entry) =>
      entry.key === investigationKey &&
      entry.roundKey === runtimeInput.currentRoundKey,
  );
  if (!action)
    fail(
      "MECHANISM_INVESTIGATION_UNAVAILABLE",
      "Investigation is not available in the current round",
      { investigationKey },
    );
  if (runtimeInput.executedInvestigations[action.key]) {
    fail(
      "MECHANISM_INVESTIGATION_ALREADY_RESOLVED",
      "Investigation has already been resolved",
      { investigationKey },
    );
  }
  const branch = outcome === "success" ? action.success : action.failure;
  if (!branch)
    fail(
      "MECHANISM_INVESTIGATION_OUTCOME_UNSUPPORTED",
      "This investigation does not define the requested outcome",
      { investigationKey, outcome },
    );
  let runtime = clone(runtimeInput);
  const changes = [];
  runtime = applyStateWrites(
    runtime,
    branch.stateWrites,
    packageValue,
    changes,
    `${action.key}:${outcome}`,
  );
  runtime = applyResourceDeltas(
    runtime,
    branch.resourceDeltas,
    packageValue,
    changes,
    `${action.key}:${outcome}`,
  );
  runtime = applyEvidence(
    runtime,
    branch.unlocksEvidenceKeys,
    branch.locksEvidenceKeys,
    changes,
    `${action.key}:${outcome}`,
  );
  runtime.executedInvestigations = withRecordValue(
    runtime.executedInvestigations,
    action.key,
    outcome,
  );
  return {
    runtime,
    changes,
    action: { type: "investigation", investigationKey, outcome },
  };
}

export function executeMechanismOverride(
  runtimeInput,
  packageInput,
  { effects, reason },
) {
  const packageValue = assertMechanismPackage(packageInput);
  const normalizedReason = String(reason ?? "").trim();
  if (normalizedReason.length < 10) {
    fail(
      "MECHANISM_OVERRIDE_REASON_REQUIRED",
      "Host overrides require a concrete audit reason",
    );
  }
  if (!Array.isArray(effects) || effects.length === 0) {
    fail(
      "MECHANISM_OVERRIDE_EFFECTS_REQUIRED",
      "Host overrides require at least one explicit effect",
    );
  }
  let runtime = clone(runtimeInput);
  const changes = [];
  for (const effect of effects) {
    runtime = applyEffect(
      runtime,
      effect,
      packageValue,
      changes,
      "host-override",
    );
  }
  if (runtime.status === "completed")
    runtime.ending = resolveEnding(runtime, packageValue);
  return {
    runtime,
    changes,
    action: {
      type: "override",
      overrideKey: "host-override",
      reason: normalizedReason,
    },
  };
}

export function advanceMechanismRound(runtimeInput, packageInput) {
  const packageValue = assertMechanismPackage(packageInput);
  if (runtimeInput.status !== "running")
    fail(
      "MECHANISM_RUNTIME_COMPLETED",
      "Mechanism runtime is already completed",
    );
  const currentRound = packageValue.rounds.find(
    (round) => round.key === runtimeInput.currentRoundKey,
  );
  if (!currentRound)
    fail("MECHANISM_ROUND_UNKNOWN", "Current mechanism round does not exist", {
      roundKey: runtimeInput.currentRoundKey,
    });
  const unresolved = packageValue.decisionNodes
    .filter(
      (decision) =>
        decision.roundKey === currentRound.key && decision.options.length,
    )
    .filter((decision) => !runtimeInput.decisionStates[decision.key]);
  if (unresolved.length)
    fail(
      "MECHANISM_DECISIONS_PENDING",
      "Current round still has unresolved decisions",
      {
        decisionKeys: unresolved.map((decision) => decision.key),
      },
    );

  const ruleResult = applyWorldRules(
    runtimeInput,
    packageValue,
    currentRound.key,
  );
  let runtime = ruleResult.runtime;
  const changes = [...ruleResult.changes];
  const rounds = [...packageValue.rounds].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const currentIndex = rounds.findIndex(
    (round) => round.key === currentRound.key,
  );
  const nextRound = rounds[currentIndex + 1] ?? null;
  if (!nextRound) {
    runtime.status = "completed";
    runtime.ending = resolveEnding(runtime, packageValue);
    return {
      runtime,
      changes,
      action: {
        type: "advance",
        fromRoundKey: currentRound.key,
        toRoundKey: null,
      },
    };
  }
  runtime.currentRoundKey = nextRound.key;
  runtime.currentRoundSequence = nextRound.sequence;
  runtime.preparedRoundKey = null;
  const prepared = prepareRound(runtime, packageValue, nextRound);
  return {
    runtime: prepared.runtime,
    changes: [...changes, ...prepared.changes],
    action: {
      type: "advance",
      fromRoundKey: currentRound.key,
      toRoundKey: nextRound.key,
    },
  };
}

export function projectMechanismRuntime(runtimeInput, packageInput) {
  const packageValue = assertMechanismPackage(packageInput);
  const runtime = clone(runtimeInput);
  const round =
    packageValue.rounds.find(
      (entry) => entry.key === runtime.currentRoundKey,
    ) ?? null;
  return {
    ...runtime,
    currentRound: round,
    availableDecisions: packageValue.decisionNodes
      .filter(
        (decision) =>
          decision.roundKey === runtime.currentRoundKey &&
          !runtime.decisionStates[decision.key],
      )
      .map(clone),
    availableInvestigations: packageValue.investigationActions
      .filter(
        (action) =>
          action.roundKey === runtime.currentRoundKey &&
          !runtime.executedInvestigations[action.key],
      )
      .map(clone),
  };
}

/**
 * Return the deliberately small mechanism projection that may cross the
 * host/player privacy boundary. Internal state keys, resources, evidence,
 * branch conditions, host notes and effect mappings never leave this helper.
 */
export function projectPlayerMechanismRuntime(
  runtimeInput,
  packageInput,
  {
    revision = 0,
    stale = false,
    updatedAt = null,
    roundStartedAt = null,
    ownSubmissions = [],
  } = {},
) {
  const packageValue = assertMechanismPackage(packageInput);
  const runtime = runtimeInput ? clone(runtimeInput) : null;
  const round = runtime
    ? (packageValue.rounds.find(
        (entry) => entry.key === runtime.currentRoundKey,
      ) ?? null)
    : null;
  const endingRoute =
    runtime?.status === "completed"
      ? (packageValue.endingRoutes.find(
          (entry) => entry.key === runtime.ending?.resolvedRouteKey,
        ) ?? null)
      : null;

  return {
    initialized: Boolean(runtime),
    stale: Boolean(stale),
    revision: Math.max(0, Number(revision) || 0),
    status:
      runtime?.status === "completed"
        ? "completed"
        : runtime?.status === "running"
          ? "running"
          : "not_started",
    totalRounds: packageValue.rounds.length,
    currentRound: round
      ? {
          sequence: Number(round.sequence),
          title: String(round.title ?? ""),
          goal: String(round.goal ?? ""),
          playerAction: String(round.playerAction ?? ""),
          genreMechanicUse: String(round.genreMechanicUse ?? ""),
        }
      : null,
    decisions:
      runtime && round
        ? packageValue.decisionNodes
            .filter(
              (decision) =>
                decision.roundKey === round.key &&
                !runtime.decisionStates?.[decision.key],
            )
            .map((decision) => {
              const interaction = publicMechanismInteraction(
                decision.interaction,
              );
              const submission = asArray(ownSubmissions).find(
                (entry) =>
                  String(entry?.decisionKey ?? entry?.decision_key ?? "") ===
                  String(decision.key),
              );
              return {
                key: String(decision.key ?? ""),
                question: String(decision.question ?? ""),
                interaction,
                deadlineAt:
                  interaction.deadlineSeconds > 0 &&
                  roundStartedAt &&
                  Number.isFinite(new Date(roundStartedAt).getTime())
                    ? new Date(
                        new Date(roundStartedAt).getTime() +
                          interaction.deadlineSeconds * 1000,
                      ).toISOString()
                    : null,
                submission: submission
                  ? {
                      optionKey: String(
                        submission.optionKey ?? submission.option_key ?? "",
                      ),
                      submittedAt: String(
                        submission.submittedAt ?? submission.submitted_at ?? "",
                      ),
                    }
                  : null,
                options: decision.options.map((option) => ({
                  key: String(option.key ?? ""),
                  choiceText: String(option.choiceText ?? ""),
                  presentation: normalizeMechanismOptionPresentation(
                    option.presentation,
                  ),
                })),
              };
            })
        : [],
    ending: endingRoute ? { title: String(endingRoute.title ?? "") } : null,
    waitingForHost: runtime?.status === "running",
    updatedAt: updatedAt == null ? null : new Date(updatedAt).toISOString(),
  };
}

function runtimeReachabilitySignature(runtime) {
  return valueSignature({
    status: runtime.status,
    currentRoundKey: runtime.currentRoundKey,
    preparedRoundKey: runtime.preparedRoundKey,
    states: runtime.states,
    resources: runtime.resources,
    evidence: runtime.evidence,
    events: runtime.events,
    decisionStates: runtime.decisionStates,
    executedInvestigations: runtime.executedInvestigations,
    ending: runtime.ending,
  });
}

function actionDescriptor(action) {
  if (action.type === "decision")
    return `decision:${action.decisionKey}:${action.optionKey}`;
  if (action.type === "investigation")
    return `investigation:${action.investigationKey}:${action.outcome}`;
  return `advance:${action.fromRoundKey || "final"}`;
}

export function analyzeMechanismRuntimeReachability(
  runtimeInput,
  packageInput,
  { pathLimit = 2048 } = {},
) {
  const packageValue = assertMechanismPackage(packageInput);
  const safeLimit =
    Number.isInteger(pathLimit) && pathLimit > 0
      ? Math.min(pathLimit, 20_000)
      : 2048;
  const queue = [{ runtime: clone(runtimeInput), trace: [] }];
  const seen = new Set();
  const completed = [];
  const blocked = [];
  const blockedKeys = new Set();
  let exploredStateCount = 0;

  const enqueue = (entry, task) => {
    try {
      const result = task();
      queue.push({
        runtime: result.runtime,
        trace: [...entry.trace, actionDescriptor(result.action)],
      });
    } catch (error) {
      const key = `${error?.code || "UNKNOWN"}:${JSON.stringify(error?.details ?? {})}`;
      if (blockedKeys.has(key)) return;
      blockedKeys.add(key);
      blocked.push({
        code: error?.code || "MECHANISM_ACTION_BLOCKED",
        message: error?.message || "Action blocked",
        details: error?.details,
      });
    }
  };

  while (queue.length && exploredStateCount < safeLimit) {
    const entry = queue.shift();
    const stateSignature = runtimeReachabilitySignature(entry.runtime);
    if (seen.has(stateSignature)) continue;
    seen.add(stateSignature);
    exploredStateCount += 1;
    if (entry.runtime.status === "completed") {
      completed.push(entry);
      continue;
    }

    const projection = projectMechanismRuntime(entry.runtime, packageValue);
    for (const decision of projection.availableDecisions) {
      for (const option of decision.options) {
        enqueue(entry, () =>
          executeMechanismDecision(entry.runtime, packageValue, {
            decisionKey: decision.key,
            optionKey: option.key,
          }),
        );
      }
    }
    for (const investigation of projection.availableInvestigations) {
      enqueue(entry, () =>
        executeMechanismInvestigation(entry.runtime, packageValue, {
          investigationKey: investigation.key,
          outcome: "success",
        }),
      );
      if (investigation.failure) {
        enqueue(entry, () =>
          executeMechanismInvestigation(entry.runtime, packageValue, {
            investigationKey: investigation.key,
            outcome: "failure",
          }),
        );
      }
    }
    if (!projection.availableDecisions.length) {
      enqueue(entry, () => advanceMechanismRound(entry.runtime, packageValue));
    }
  }

  const reachableRouteKeys = [
    ...new Set(
      completed
        .map((entry) => entry.runtime.ending?.resolvedRouteKey)
        .filter(Boolean),
    ),
  ];
  const currentFacts = facts(packageValue);
  const endingProspects = packageValue.endingRoutes
    .map((route) => {
      const unmetRequirements = asArray(route.requirements)
        .filter(
          (requirement) =>
            !requirementSatisfied(
              collectionFor(
                runtimeInput,
                requirement.targetType,
                currentFacts,
              )?.[requirement.targetKey],
              requirement.operator,
              requirement.value,
            ),
        )
        .map((requirement) => ({
          targetType: requirement.targetType,
          targetKey: requirement.targetKey,
          operator: requirement.operator,
          expected: clone(requirement.value),
          current: clone(
            collectionFor(runtimeInput, requirement.targetType, currentFacts)?.[
              requirement.targetKey
            ],
          ),
        }));
      const sample = completed.find(
        (entry) => entry.runtime.ending?.resolvedRouteKey === route.key,
      );
      return {
        key: route.key,
        title: route.title || route.key,
        priority: Number(route.priority || 0),
        reachable: reachableRouteKeys.includes(route.key),
        isDefault: route.isDefault === true,
        unmetRequirements,
        sampleRemainingActions: sample?.trace ?? [],
      };
    })
    .sort((left, right) => right.priority - left.priority);

  return {
    schemaVersion: 1,
    exploredStateCount,
    completedPathCount: completed.length,
    truncated: queue.length > 0,
    reachableRouteKeys,
    endingProspects,
    blockedActions: blocked,
  };
}
