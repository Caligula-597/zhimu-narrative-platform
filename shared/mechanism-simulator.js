import { assertMechanismPackage } from "./mechanism-package.js";

const asArray = (value) => (Array.isArray(value) ? value : []);
const clone = (value) => structuredClone(value);
const signature = (value) => JSON.stringify(value);

const ISSUE_CATALOG = {
  state_type_mismatch: {
    severity: "blocker",
    title: "状态值类型不符合注册表",
    suggestedDirection: "检查问题来源写入的值与状态 valueType，改为注册表允许的类型。",
  },
  state_value_outside_registry: {
    severity: "blocker",
    title: "状态值超出允许枚举",
    suggestedDirection: "把写入值改为 allowedValues 中的值，或先由作者扩充状态注册表。",
  },
  resource_type_mismatch: {
    severity: "blocker",
    title: "资源值不是有效数字",
    suggestedDirection: "检查资源初值和变化量，确保结算后仍为有限数字。",
  },
  resource_below_minimum: {
    severity: "blocker",
    title: "资源消耗越过下限",
    suggestedDirection: "降低该动作成本、提高可用量，或增加执行前的资源条件。",
  },
  resource_above_maximum: {
    severity: "blocker",
    title: "资源增长越过上限",
    suggestedDirection: "降低资源收益、提高上限，或增加结算封顶规则。",
  },
  resource_inevitably_exhausted: {
    severity: "must_fix",
    title: "资源在所有完整路径中必然耗尽",
    suggestedDirection: "把消耗挂到真实可选动作、增加替代路径，或确认后续内容不再要求该资源。",
  },
  unsupported_operation: {
    severity: "blocker",
    title: "机制包包含模拟器不支持的操作",
    suggestedDirection: "改用机制契约支持的 operation，避免依赖主持人口头换算。",
  },
  equivalent_decision_options: {
    severity: "must_fix",
    title: "两个玩家选项产生完全相同的运行结果",
    suggestedDirection: "让选项写入不同状态、资源或证据结果，或合并重复选项。",
  },
  no_action_decision_without_default: {
    severity: "blocker",
    title: "玩家不行动时没有可执行的默认结算",
    suggestedDirection: "若本轮允许超时或拒绝行动，改用限时危机并登记真实的 defaultOptionKey；其他类型需先补充明确的默认损失作者契约。",
  },
  unreachable_ending_route: {
    severity: "blocker",
    title: "结局路线不可达",
    suggestedDirection: "检查最接近路径仍缺失的条件，修复前置写入或放宽互相冲突的结局要求。",
  },
  multiple_ending_routes_match: {
    severity: "must_fix",
    title: "同一路径同时命中多个非默认结局",
    suggestedDirection: "补充互斥条件或确认优先级确实表达作者意图。",
  },
  path_limit_reached: {
    severity: "review",
    title: "模拟覆盖达到路径上限",
    suggestedDirection: "提高路径上限或减少等价分支；覆盖完整前不要把未发现问题视为通过。",
  },
};

function withRecordValue(record, key, value) {
  return Object.fromEntries([
    ...Object.entries(record ?? {}).filter(([entryKey]) => entryKey !== key),
    [key, value],
  ]);
}

function requirementSatisfied(current, operator, expected) {
  if (operator === "equals") return signature(current) === signature(expected);
  if (operator === "not_equals") return signature(current) !== signature(expected);
  if (operator === "includes")
    return Array.isArray(current)
      ? current.some((entry) => signature(entry) === signature(expected))
      : String(current ?? "").includes(String(expected ?? ""));
  const currentNumber = Number(current);
  const expectedNumber = Number(expected);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(expectedNumber))
    return false;
  if (operator === "gte") return currentNumber >= expectedNumber;
  if (operator === "lte") return currentNumber <= expectedNumber;
  return false;
}

function collectionFor(snapshot, targetType, facts) {
  if (targetType === "fact") return facts;
  if (targetType === "state") return snapshot.states;
  if (targetType === "resource") return snapshot.resources;
  if (targetType === "evidence") return snapshot.evidence;
  if (targetType === "event") return snapshot.events;
  return {};
}

function compressTrace(trace) {
  return asArray(trace)
    .filter(
      (step) =>
        step?.decisionKey ||
        step?.investigationKey ||
        step?.strategy === "no_action" ||
        step?.branch === "read_fail",
    )
    .map(clone);
}

function issueIdentity(issue) {
  const {
    reproductionPath: _reproductionPath,
    pathIndex: _pathIndex,
    ...stableIssue
  } = issue;
  return signature(stableIssue);
}

function recordIssue(context, issue, trace = []) {
  const candidate = {
    ...issue,
    reproductionPath: compressTrace(trace),
  };
  const key = issueIdentity(candidate);
  const priorIndex = context.issueIndexes.get(key);
  if (priorIndex === undefined) {
    context.issueIndexes.set(key, context.issues.length);
    context.issues.push(candidate);
    return;
  }
  const prior = context.issues[priorIndex];
  if (candidate.reproductionPath.length < prior.reproductionPath.length) {
    context.issues[priorIndex] = candidate;
  }
}

function checkStateValue(
  context,
  snapshot,
  stateKey,
  roundKey,
  sourceKey,
  trace = [],
) {
  const state = context.statesByKey.get(stateKey);
  if (!state) return;
  const value = snapshot.states[stateKey];
  const allowedValues = asArray(state.allowedValues);
  if (state.valueType === "number" && !Number.isFinite(Number(value))) {
    recordIssue(
      context,
      {
        code: "state_type_mismatch",
        roundKey,
        sourceKey,
        targetKey: stateKey,
        value,
      },
      trace,
    );
  }
  if (state.valueType === "boolean" && typeof value !== "boolean") {
    recordIssue(
      context,
      {
        code: "state_type_mismatch",
        roundKey,
        sourceKey,
        targetKey: stateKey,
        value,
      },
      trace,
    );
  }
  if (state.valueType === "set" && !Array.isArray(value)) {
    recordIssue(
      context,
      {
        code: "state_type_mismatch",
        roundKey,
        sourceKey,
        targetKey: stateKey,
        value,
      },
      trace,
    );
  }
  if (
    state.valueType === "enum" &&
    allowedValues.length &&
    !allowedValues.some((entry) => signature(entry) === signature(value))
  ) {
    recordIssue(
      context,
      {
        code: "state_value_outside_registry",
        roundKey,
        sourceKey,
        targetKey: stateKey,
        value,
      },
      trace,
    );
  }
}

function checkResourceValue(
  context,
  snapshot,
  resourceKey,
  roundKey,
  sourceKey,
  trace = [],
) {
  const resource = context.resourcesByKey.get(resourceKey);
  if (!resource) return;
  const value = Number(snapshot.resources[resourceKey]);
  if (!Number.isFinite(value)) {
    recordIssue(
      context,
      {
        code: "resource_type_mismatch",
        roundKey,
        sourceKey,
        targetKey: resourceKey,
        value: snapshot.resources[resourceKey],
      },
      trace,
    );
    return;
  }
  if (Number.isFinite(resource.minimum) && value < resource.minimum) {
    recordIssue(
      context,
      {
        code: "resource_below_minimum",
        roundKey,
        sourceKey,
        targetKey: resourceKey,
        value,
        minimum: resource.minimum,
      },
      trace,
    );
  }
  if (Number.isFinite(resource.maximum) && value > resource.maximum) {
    recordIssue(
      context,
      {
        code: "resource_above_maximum",
        roundKey,
        sourceKey,
        targetKey: resourceKey,
        value,
        maximum: resource.maximum,
      },
      trace,
    );
  }
}

function noteResourceExhaustion(snapshot, context, resourceKey, roundKey, sourceKey) {
  const resource = context.resourcesByKey.get(resourceKey);
  const value = Number(snapshot.resources[resourceKey]);
  if (
    !resource ||
    !Number.isFinite(resource.minimum) ||
    !Number.isFinite(value) ||
    value > resource.minimum ||
    snapshot._resourceExhaustions?.[resourceKey]
  ) {
    return snapshot;
  }
  return {
    ...snapshot,
    _resourceExhaustions: withRecordValue(
      snapshot._resourceExhaustions,
      resourceKey,
      { roundKey, sourceKey, value },
    ),
  };
}

function applyEffect(
  rawSnapshot,
  effect,
  context,
  roundKey,
  sourceKey,
  trace = [],
) {
  let snapshot = clone(rawSnapshot);
  const targetKey = String(effect?.targetKey ?? "");
  if (effect?.targetType === "state") {
    const current = snapshot.states[targetKey];
    let nextValue;
    if (effect.operation === "set") nextValue = clone(effect.value);
    else if (effect.operation === "increment")
      nextValue = Number(current || 0) + Number(effect.value || 0);
    else if (effect.operation === "decrement")
      nextValue = Number(current || 0) - Number(effect.value || 0);
    else if (effect.operation === "add")
      nextValue = [
        ...new Set([
          ...(Array.isArray(current) ? current : []),
          clone(effect.value),
        ]),
      ];
    else if (effect.operation === "remove")
      nextValue = asArray(current).filter(
        (entry) => signature(entry) !== signature(effect.value),
      );
    else
      recordIssue(
        context,
        {
          code: "unsupported_operation",
          roundKey,
          sourceKey,
          targetType: "state",
          targetKey,
          operation: effect.operation,
        },
        trace,
      );
    if (nextValue !== undefined)
      snapshot.states = withRecordValue(snapshot.states, targetKey, nextValue);
    checkStateValue(context, snapshot, targetKey, roundKey, sourceKey, trace);
  } else if (effect?.targetType === "resource") {
    const current = Number(snapshot.resources[targetKey] || 0);
    let nextValue;
    if (effect.operation === "gain")
      nextValue = current + Number(effect.amount || 0);
    else if (effect.operation === "lose")
      nextValue = current - Number(effect.amount || 0);
    else if (effect.operation === "set")
      nextValue = Number(effect.amount ?? effect.value ?? 0);
    else
      recordIssue(
        context,
        {
          code: "unsupported_operation",
          roundKey,
          sourceKey,
          targetType: "resource",
          targetKey,
          operation: effect.operation,
        },
        trace,
      );
    if (nextValue !== undefined) {
      snapshot.resources = withRecordValue(
        snapshot.resources,
        targetKey,
        nextValue,
      );
      snapshot = noteResourceExhaustion(
        snapshot,
        context,
        targetKey,
        roundKey,
        sourceKey,
      );
    }
    checkResourceValue(
      context,
      snapshot,
      targetKey,
      roundKey,
      sourceKey,
      trace,
    );
  } else if (effect?.targetType === "evidence") {
    if (effect.operation === "unlock")
      snapshot.evidence = withRecordValue(
        snapshot.evidence,
        targetKey,
        "available",
      );
    else if (effect.operation === "lock")
      snapshot.evidence = withRecordValue(
        snapshot.evidence,
        targetKey,
        "locked",
      );
    else
      recordIssue(
        context,
        {
          code: "unsupported_operation",
          roundKey,
          sourceKey,
          targetType: "evidence",
          targetKey,
          operation: effect.operation,
        },
        trace,
      );
  } else if (effect?.targetType === "event") {
    if (effect.operation === "trigger")
      snapshot.events = withRecordValue(snapshot.events, targetKey, true);
    else
      recordIssue(
        context,
        {
          code: "unsupported_operation",
          roundKey,
          sourceKey,
          targetType: "event",
          targetKey,
          operation: effect.operation,
        },
        trace,
      );
  } else if (effect?.targetType === "clue") {
    const roleKey = String(effect?.roleKey ?? "");
    if (effect.operation === "grant" && targetKey && roleKey) {
      snapshot.grantedClues = withRecordValue(
        snapshot.grantedClues,
        `${targetKey}:${roleKey}`,
        true,
      );
    } else {
      recordIssue(
        context,
        {
          code: "unsupported_operation",
          roundKey,
          sourceKey,
          targetType: "clue",
          targetKey,
          operation: effect.operation,
        },
        trace,
      );
    }
  }
  return snapshot;
}

function applyStateWrites(
  snapshot,
  writes,
  context,
  roundKey,
  sourceKey,
  trace = [],
) {
  let next = snapshot;
  for (const write of asArray(writes))
    next = applyEffect(
      next,
      {
        targetType: "state",
        targetKey: write.stateKey,
        operation: write.operation,
        value: write.value,
      },
      context,
      roundKey,
      sourceKey,
      trace,
    );
  return next;
}

function applyResourceDeltas(
  snapshot,
  deltas,
  context,
  roundKey,
  sourceKey,
  trace = [],
) {
  let next = snapshot;
  for (const delta of asArray(deltas))
    next = applyEffect(
      next,
      {
        targetType: "resource",
        targetKey: delta.resourceKey,
        operation: delta.operation,
        amount: delta.amount,
      },
      context,
      roundKey,
      sourceKey,
      trace,
    );
  return next;
}

function applyEvidenceSwitches(rawSnapshot, unlocks, locks) {
  const snapshot = clone(rawSnapshot);
  for (const key of asArray(unlocks))
    snapshot.evidence = withRecordValue(snapshot.evidence, key, "available");
  for (const key of asArray(locks))
    snapshot.evidence = withRecordValue(snapshot.evidence, key, "locked");
  return snapshot;
}

function applyInvestigationBranch(snapshot, action, outcome, context, roundKey) {
  const branch = outcome === "success" ? action.success : action.failure;
  const traceStep = {
    roundKey,
    investigationKey: action.key,
    outcome,
  };
  let next = clone(snapshot);
  next.trace.push(traceStep);
  next = applyStateWrites(
    next,
    branch?.stateWrites,
    context,
    roundKey,
    `${action.key}:${outcome}`,
    next.trace,
  );
  next = applyResourceDeltas(
    next,
    branch?.resourceDeltas,
    context,
    roundKey,
    `${action.key}:${outcome}`,
    next.trace,
  );
  return applyEvidenceSwitches(
    next,
    branch?.unlocksEvidenceKeys,
    branch?.locksEvidenceKeys,
  );
}

function applyWorldRules(rawSnapshot, packageValue, context, roundKey) {
  let snapshot = rawSnapshot;
  for (const rule of packageValue.worldRules.filter(
    (entry) => entry.evaluationChapterKey === roundKey,
  )) {
    const triggersPass = asArray(rule.triggerEventKeys).every(
      (key) => snapshot.events[key] === true,
    );
    const conditionsPass = asArray(rule.preconditions).every((requirement) =>
      requirementSatisfied(
        collectionFor(snapshot, requirement.targetType, context.facts)?.[
          requirement.targetKey
        ],
        requirement.operator,
        requirement.value,
      ),
    );
    if (!triggersPass || !conditionsPass) continue;
    for (const effect of asArray(rule.effects))
      snapshot = applyEffect(
        snapshot,
        effect,
        context,
        roundKey,
        `world-rule:${rule.key}`,
        snapshot.trace,
      );
    snapshot.events = withRecordValue(
      snapshot.events,
      `world-rule:${rule.key}`,
      true,
    );
  }
  return snapshot;
}

function evaluateRoutes(snapshot, packageValue, context) {
  const matched = packageValue.endingRoutes.filter(
    (route) =>
      !route.isDefault &&
      asArray(route.requirements).every((requirement) =>
        requirementSatisfied(
          collectionFor(snapshot, requirement.targetType, context.facts)?.[
            requirement.targetKey
          ],
          requirement.operator,
          requirement.value,
        ),
      ),
  );
  const sorted = [...matched].sort(
    (left, right) => Number(right.priority || 0) - Number(left.priority || 0),
  );
  const defaultRoute =
    packageValue.endingRoutes.find(
      (route) => route.key === packageValue.endingResolution.defaultRouteKey,
    ) || packageValue.endingRoutes.find((route) => route.isDefault);
  return {
    matchedRouteKeys: sorted.map((route) => route.key),
    resolvedRouteKey: sorted[0]?.key || defaultRoute?.key || null,
  };
}

function runtimeSignature(snapshot) {
  return signature({
    states: snapshot.states,
    resources: snapshot.resources,
    evidence: snapshot.evidence,
    events: snapshot.events,
    grantedClues: snapshot.grantedClues,
  });
}

function initialPath(packageValue) {
  return {
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
    grantedClues: {},
    _resourceExhaustions: {},
    trace: [],
  };
}

function prepareRoundPath(rawPath, round, context) {
  let base = clone(rawPath);
  const readResults = round.stateReads.map((read) =>
    requirementSatisfied(
      base.states[read.stateKey],
      read.operator,
      read.value,
    ),
  );
  const readPassed =
    !readResults.length ||
    (round.entryConditionMode === "any"
      ? readResults.some(Boolean)
      : readResults.every(Boolean));
  if (!readPassed) {
    base.trace.push({
      roundKey: round.key,
      branch: "read_fail",
      variantKey: round.onReadFail?.variantKey || null,
    });
    base = applyStateWrites(
      base,
      round.onReadFail?.stateWrites,
      context,
      round.key,
      `${round.key}:read_fail`,
      base.trace,
    );
    base = applyResourceDeltas(
      base,
      round.onReadFail?.additionalCosts,
      context,
      round.key,
      `${round.key}:read_fail`,
      base.trace,
    );
    base = applyEvidenceSwitches(
      base,
      round.onReadFail?.unlocksEvidenceKeys,
      round.onReadFail?.locksEvidenceKeys,
    );
  } else {
    base.trace.push({
      roundKey: round.key,
      branch: "read_pass",
      variantKey: round.onReadPass?.variantKey || null,
    });
  }
  base = applyStateWrites(
    base,
    round.stateWrites,
    context,
    round.key,
    `${round.key}:mandatory`,
    base.trace,
  );
  base = applyResourceDeltas(
    base,
    round.resourceDeltas,
    context,
    round.key,
    `${round.key}:mandatory`,
    base.trace,
  );
  return applyEvidenceSwitches(
    base,
    round.unlocksEvidenceKeys,
    round.locksEvidenceKeys,
  );
}

function enumerateInvestigationCombinations(
  basePaths,
  investigations,
  context,
  roundKey,
  pathLimit,
) {
  let paths = basePaths;
  for (const action of investigations) {
    const branched = [];
    let capacityReached = false;
    for (const path of paths) {
      const variants = [clone(path)];
      if (action.success)
        variants.push(
          applyInvestigationBranch(
            path,
            action,
            "success",
            context,
            roundKey,
          ),
        );
      if (action.failure)
        variants.push(
          applyInvestigationBranch(
            path,
            action,
            "failure",
            context,
            roundKey,
          ),
        );
      for (const variant of variants) {
        if (branched.length >= pathLimit) {
          context.truncated = true;
          capacityReached = true;
          break;
        }
        branched.push(variant);
      }
      if (capacityReached) break;
    }
    paths = branched;
  }
  return paths;
}

function enumerateDecisionOptions(
  basePaths,
  decisions,
  context,
  roundKey,
  pathLimit,
) {
  let paths = basePaths;
  for (const decision of decisions) {
    const branched = [];
    let capacityReached = false;
    for (const decisionBase of paths) {
      const outcomeSignatures = new Map();
      for (const option of decision.options) {
        let optionPath = clone(decisionBase);
        optionPath.trace.push({
          roundKey,
          decisionKey: decision.key,
          optionKey: option.key,
          selection: "player",
        });
        for (const effect of option.effects)
          optionPath = applyEffect(
            optionPath,
            effect,
            context,
            roundKey,
            `${decision.key}:${option.key}`,
            optionPath.trace,
          );
        const resultSignature = runtimeSignature(optionPath);
        const priorOption = outcomeSignatures.get(resultSignature);
        if (priorOption && priorOption !== option.key) {
          recordIssue(
            context,
            {
              code: "equivalent_decision_options",
              roundKey,
              decisionKey: decision.key,
              optionKeys: [priorOption, option.key].sort(),
            },
            optionPath.trace,
          );
        } else {
          outcomeSignatures.set(resultSignature, option.key);
        }
        if (branched.length >= pathLimit) {
          context.truncated = true;
          capacityReached = true;
          break;
        }
        branched.push(optionPath);
      }
      if (capacityReached) break;
    }
    paths = branched;
  }
  return paths;
}

function simulateNoActionStrategy(initial, rounds, packageValue, context) {
  let path = clone(initial);
  for (const round of rounds) {
    path = prepareRoundPath(path, round, context);
    const decisions = packageValue.decisionNodes.filter(
      (decision) => decision.roundKey === round.key,
    );
    const defaultSelections = [];
    for (const decision of decisions) {
      const defaultOptionKey =
        decision.interaction?.kind === "timed_crisis"
          ? String(decision.interaction?.defaultOptionKey ?? "")
          : "";
      const option = decision.options.find(
        (entry) => entry.key === defaultOptionKey,
      );
      if (!defaultOptionKey || !option) {
        const traceStep = {
          roundKey: round.key,
          strategy: "no_action",
          blockedDecisionKeys: [decision.key],
        };
        path.trace.push(traceStep);
        recordIssue(
          context,
          {
            code: "no_action_decision_without_default",
            roundKey: round.key,
            decisionKey: decision.key,
          },
          path.trace,
        );
        return {
          status: "blocked",
          stoppedRoundKey: round.key,
          resolvedEndingRouteKey: null,
          matchedEndingRouteKeys: [],
          reproductionPath: compressTrace(path.trace),
        };
      }
      defaultSelections.push({
        decisionKey: decision.key,
        optionKey: option.key,
      });
      for (const effect of option.effects)
        path = applyEffect(
          path,
          effect,
          context,
          round.key,
          `${decision.key}:${option.key}:no_action_default`,
          [
            ...path.trace,
            {
              roundKey: round.key,
              strategy: "no_action",
              defaultSelections,
            },
          ],
        );
    }
    path.trace.push({
      roundKey: round.key,
      strategy: "no_action",
      defaultSelections,
    });
    for (const effect of asArray(round.settlementEffects)) {
      path = applyEffect(
        path,
        effect,
        context,
        round.key,
        `${round.key}:settlement:no_action_default`,
        path.trace,
      );
    }
    path = applyWorldRules(path, packageValue, context, round.key);
  }
  const ending = evaluateRoutes(path, packageValue, context);
  return {
    status: "completed",
    stoppedRoundKey: null,
    resolvedEndingRouteKey: ending.resolvedRouteKey,
    matchedEndingRouteKeys: ending.matchedRouteKeys,
    reproductionPath: compressTrace(path.trace),
  };
}

function unmetRouteRequirements(snapshot, route, context) {
  return asArray(route.requirements)
    .filter(
      (requirement) =>
        !requirementSatisfied(
          collectionFor(snapshot, requirement.targetType, context.facts)?.[
            requirement.targetKey
          ],
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
        collectionFor(snapshot, requirement.targetType, context.facts)?.[
          requirement.targetKey
        ],
      ),
    }));
}

function closestPathForRoute(paths, route, context) {
  const candidates = paths.map((path, pathIndex) => ({
    path,
    pathIndex,
    unmetRequirements: unmetRouteRequirements(path, route, context),
    reproductionPath: compressTrace(path.trace),
  }));
  candidates.sort(
    (left, right) =>
      left.unmetRequirements.length - right.unmetRequirements.length ||
      left.reproductionPath.length - right.reproductionPath.length ||
      left.pathIndex - right.pathIndex,
  );
  return candidates[0] ?? null;
}

function shortestExhaustionPath(paths, resourceKey) {
  return paths
    .filter((path) => path._resourceExhaustions?.[resourceKey])
    .map((path) => compressTrace(path.trace))
    .sort((left, right) => left.length - right.length)[0] ?? [];
}

function analyzeResourceExhaustion(
  packageValue,
  paths,
  rounds,
  context,
) {
  const roundSequence = new Map(
    rounds.map((round) => [round.key, Number(round.sequence)]),
  );
  return packageValue.resourceRegistry.map((resource) => {
    const minimum = Number(resource.minimum);
    const initialValue = Number(resource.initialValue);
    if (!Number.isFinite(minimum) || !Number.isFinite(initialValue)) {
      return {
        resourceKey: resource.key,
        status: "inconclusive",
        initialValue: resource.initialValue,
        minimum: resource.minimum,
        evaluatedPathCount: paths.length,
        exhaustedPathCount: 0,
        guaranteedByRoundKey: null,
        shortestExhaustionPath: [],
      };
    }
    if (initialValue <= minimum) {
      return {
        resourceKey: resource.key,
        status: "initially_exhausted",
        initialValue,
        minimum,
        evaluatedPathCount: paths.length,
        exhaustedPathCount: paths.length,
        guaranteedByRoundKey: "initial",
        shortestExhaustionPath: [],
      };
    }
    const exhaustedPaths = paths.filter(
      (path) => path._resourceExhaustions?.[resource.key],
    );
    const allEvaluatedPathsExhausted =
      paths.length > 0 && exhaustedPaths.length === paths.length;
    let status = paths.length ? "not_exhausted" : "inconclusive";
    if (exhaustedPaths.length && !allEvaluatedPathsExhausted)
      status = "avoidable";
    else if (allEvaluatedPathsExhausted && !context.truncated)
      status = "inevitable";
    else if (context.truncated) status = "inconclusive";

    let guaranteedByRoundKey = null;
    if (status === "inevitable") {
      guaranteedByRoundKey = exhaustedPaths
        .map((path) => path._resourceExhaustions[resource.key].roundKey)
        .sort(
          (left, right) =>
            (roundSequence.get(right) ?? -1) -
            (roundSequence.get(left) ?? -1),
        )[0];
      recordIssue(
        context,
        {
          code: "resource_inevitably_exhausted",
          resourceKey: resource.key,
          initialValue,
          minimum,
          guaranteedByRoundKey,
          exhaustedPathCount: exhaustedPaths.length,
          pathCount: paths.length,
        },
        shortestExhaustionPath(paths, resource.key),
      );
    }
    return {
      resourceKey: resource.key,
      status,
      initialValue,
      minimum,
      evaluatedPathCount: paths.length,
      exhaustedPathCount: exhaustedPaths.length,
      guaranteedByRoundKey,
      shortestExhaustionPath: shortestExhaustionPath(paths, resource.key),
    };
  });
}

function issueMessage(issue) {
  if (issue.code === "resource_below_minimum")
    return `${issue.sourceKey} 将资源 ${issue.targetKey} 结算为 ${issue.value}，低于下限 ${issue.minimum}。`;
  if (issue.code === "resource_above_maximum")
    return `${issue.sourceKey} 将资源 ${issue.targetKey} 结算为 ${issue.value}，高于上限 ${issue.maximum}。`;
  if (issue.code === "resource_inevitably_exhausted")
    return `资源 ${issue.resourceKey} 的初值为 ${issue.initialValue}，所有 ${issue.pathCount} 条完整路径最迟在 ${issue.guaranteedByRoundKey} 达到下限 ${issue.minimum}。`;
  if (issue.code === "no_action_decision_without_default")
    return `轮次 ${issue.roundKey} 的决策 ${issue.decisionKey} 没有 defaultOptionKey；玩家拒绝行动时系统无法继续。`;
  if (issue.code === "equivalent_decision_options")
    return `轮次 ${issue.roundKey} 的决策 ${issue.decisionKey} 中，选项 ${issue.optionKeys.join("、")} 产生相同状态、资源、证据和事件结果。`;
  if (issue.code === "unreachable_ending_route")
    return issue.unmetRequirements?.length
      ? `结局 ${issue.routeKey} 不可达；最接近路径仍缺少 ${issue.unmetRequirements.length} 个条件。`
      : `结局 ${issue.routeKey} 没有任何完整路径命中。`;
  if (issue.code === "multiple_ending_routes_match")
    return `一条完整路径同时命中结局 ${issue.routeKeys.join("、")}，系统将仅按优先级取第一条。`;
  if (issue.code === "path_limit_reached")
    return `模拟达到 ${issue.pathLimit} 条路径上限，当前结果只能视为部分覆盖。`;
  if (issue.code === "state_type_mismatch")
    return `${issue.sourceKey} 向状态 ${issue.targetKey} 写入了不符合注册类型的值。`;
  if (issue.code === "state_value_outside_registry")
    return `${issue.sourceKey} 向状态 ${issue.targetKey} 写入了注册表之外的值 ${JSON.stringify(issue.value)}。`;
  if (issue.code === "resource_type_mismatch")
    return `${issue.sourceKey} 使资源 ${issue.targetKey} 变成了非数字值。`;
  if (issue.code === "unsupported_operation")
    return `${issue.sourceKey} 对 ${issue.targetType}:${issue.targetKey} 使用了不支持的操作 ${issue.operation}。`;
  return `模拟器发现 ${issue.code}。`;
}

function authorDiagnostic(issue) {
  const catalog = ISSUE_CATALOG[issue.code] ?? {
    severity: "review",
    title: issue.code,
    suggestedDirection: "根据复现路径检查对应机制写入。",
  };
  return {
    code: issue.code,
    severity: catalog.severity,
    title: catalog.title,
    message: issueMessage(issue),
    reproductionPath: clone(issue.reproductionPath),
    suggestedDirection: catalog.suggestedDirection,
    details: Object.fromEntries(
      Object.entries(issue).filter(
        ([key]) => !["code", "reproductionPath"].includes(key),
      ),
    ),
  };
}

function publicPath(path) {
  const { _resourceExhaustions: _internalExhaustions, ...result } = path;
  return result;
}

export function simulateMechanismPackage(
  packageInput,
  { pathLimit = 4096 } = {},
) {
  const packageValue = assertMechanismPackage(packageInput);
  const safeLimit =
    Number.isInteger(pathLimit) && pathLimit >= 1
      ? Math.min(pathLimit, 50_000)
      : 4096;
  const context = {
    issues: [],
    issueIndexes: new Map(),
    facts: Object.fromEntries(
      packageValue.factLedger.map((fact) => [fact.key, fact.truthValue]),
    ),
    statesByKey: new Map(
      packageValue.stateRegistry.map((state) => [state.key, state]),
    ),
    resourcesByKey: new Map(
      packageValue.resourceRegistry.map((resource) => [resource.key, resource]),
    ),
    truncated: false,
  };
  const initial = initialPath(packageValue);
  let paths = [clone(initial)];
  const rounds = [...packageValue.rounds].sort(
    (left, right) => left.sequence - right.sequence,
  );

  for (const state of packageValue.stateRegistry)
    checkStateValue(context, paths[0], state.key, "initial", "registry");
  for (const resource of packageValue.resourceRegistry)
    checkResourceValue(
      context,
      paths[0],
      resource.key,
      "initial",
      "registry",
    );

  for (const round of rounds) {
    const decisions = packageValue.decisionNodes.filter(
      (decision) => decision.roundKey === round.key,
    );
    const investigations = packageValue.investigationActions.filter(
      (action) => action.roundKey === round.key,
    );
    const preparedPaths = paths.map((path) =>
      prepareRoundPath(path, round, context),
    );
    const investigationPaths = enumerateInvestigationCombinations(
      preparedPaths,
      investigations,
      context,
      round.key,
      safeLimit,
    );
    const decisionPaths = enumerateDecisionOptions(
      investigationPaths,
      decisions,
      context,
      round.key,
      safeLimit,
    );
    paths = decisionPaths
      .slice(0, safeLimit)
      .map((path) => {
        let settled = path;
        for (const effect of asArray(round.settlementEffects)) {
          settled = applyEffect(
            settled,
            effect,
            context,
            round.key,
            `${round.key}:settlement`,
            settled.trace,
          );
        }
        return applyWorldRules(settled, packageValue, context, round.key);
      });
  }

  const routePaths = new Map(
    packageValue.endingRoutes.map((route) => [route.key, []]),
  );
  for (const [index, snapshot] of paths.entries()) {
    const ending = evaluateRoutes(snapshot, packageValue, context);
    snapshot.ending = ending;
    if (ending.matchedRouteKeys.length > 1) {
      recordIssue(
        context,
        {
          code: "multiple_ending_routes_match",
          pathIndex: index,
          routeKeys: ending.matchedRouteKeys,
        },
        snapshot.trace,
      );
    }
    if (ending.resolvedRouteKey && routePaths.has(ending.resolvedRouteKey))
      routePaths.get(ending.resolvedRouteKey).push(index);
  }
  for (const route of packageValue.endingRoutes) {
    if (!route.isDefault && !routePaths.get(route.key)?.length) {
      const closest = closestPathForRoute(paths, route, context);
      recordIssue(
        context,
        {
          code: "unreachable_ending_route",
          routeKey: route.key,
          closestPathIndex: closest?.pathIndex ?? null,
          unmetRequirements: closest?.unmetRequirements ?? [],
        },
        closest?.path?.trace ?? [],
      );
    }
  }

  const strategies = {
    noAction: simulateNoActionStrategy(
      initial,
      rounds,
      packageValue,
      context,
    ),
  };
  const resourceExhaustion = analyzeResourceExhaustion(
    packageValue,
    paths,
    rounds,
    context,
  );
  if (context.truncated)
    recordIssue(context, {
      code: "path_limit_reached",
      pathLimit: safeLimit,
    });
  const authorDiagnostics = context.issues.map(authorDiagnostic);

  return {
    schemaVersion: 1,
    pathCount: paths.length,
    truncated: context.truncated,
    reachableEndingRouteKeys: [...routePaths.entries()]
      .filter(([, indexes]) => indexes.length)
      .map(([key]) => key),
    strategies,
    resourceExhaustion,
    issues: context.issues,
    authorDiagnostics,
    paths: paths.map(publicPath),
  };
}

export function summarizeMechanismSimulation(report) {
  const countsByCode = {};
  for (const issue of asArray(report?.issues))
    countsByCode[issue.code] = (countsByCode[issue.code] || 0) + 1;
  return {
    schemaVersion: report?.schemaVersion ?? 1,
    pathCount: Number(report?.pathCount || 0),
    truncated: report?.truncated === true,
    reachableEndingRouteKeys: asArray(report?.reachableEndingRouteKeys),
    noActionStrategy: report?.strategies?.noAction ?? null,
    resourceExhaustion: asArray(report?.resourceExhaustion),
    issueCount: asArray(report?.issues).length,
    countsByCode,
    authorDiagnostics: asArray(report?.authorDiagnostics),
  };
}
