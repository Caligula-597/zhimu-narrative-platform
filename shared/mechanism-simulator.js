import { assertMechanismPackage } from "./mechanism-package.js";

const asArray = (value) => (Array.isArray(value) ? value : []);
const clone = (value) => structuredClone(value);
const signature = (value) => JSON.stringify(value);

function withRecordValue(record, key, value) {
  return Object.fromEntries([
    ...Object.entries(record ?? {}).filter(([entryKey]) => entryKey !== key),
    [key, value]
  ]);
}

function requirementSatisfied(current, operator, expected) {
  if (operator === "equals") return signature(current) === signature(expected);
  if (operator === "not_equals") return signature(current) !== signature(expected);
  if (operator === "includes") return Array.isArray(current)
    ? current.some((entry) => signature(entry) === signature(expected))
    : String(current ?? "").includes(String(expected ?? ""));
  const currentNumber = Number(current);
  const expectedNumber = Number(expected);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(expectedNumber)) return false;
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

function recordIssue(context, issue) {
  const key = signature(issue);
  if (context.issueKeys.has(key)) return;
  context.issueKeys.add(key);
  context.issues.push(issue);
}

function checkStateValue(context, snapshot, stateKey, roundKey, sourceKey) {
  const state = context.statesByKey.get(stateKey);
  if (!state) return;
  const value = snapshot.states[stateKey];
  const allowedValues = asArray(state.allowedValues);
  if (state.valueType === "number" && !Number.isFinite(Number(value))) {
    recordIssue(context, { code: "state_type_mismatch", roundKey, sourceKey, targetKey: stateKey, value });
  }
  if (state.valueType === "boolean" && typeof value !== "boolean") {
    recordIssue(context, { code: "state_type_mismatch", roundKey, sourceKey, targetKey: stateKey, value });
  }
  if (state.valueType === "set" && !Array.isArray(value)) {
    recordIssue(context, { code: "state_type_mismatch", roundKey, sourceKey, targetKey: stateKey, value });
  }
  if (state.valueType === "enum" && allowedValues.length && !allowedValues.some((entry) => signature(entry) === signature(value))) {
    recordIssue(context, { code: "state_value_outside_registry", roundKey, sourceKey, targetKey: stateKey, value });
  }
}

function checkResourceValue(context, snapshot, resourceKey, roundKey, sourceKey) {
  const resource = context.resourcesByKey.get(resourceKey);
  if (!resource) return;
  const value = Number(snapshot.resources[resourceKey]);
  if (!Number.isFinite(value)) {
    recordIssue(context, { code: "resource_type_mismatch", roundKey, sourceKey, targetKey: resourceKey, value: snapshot.resources[resourceKey] });
    return;
  }
  if (Number.isFinite(resource.minimum) && value < resource.minimum) {
    recordIssue(context, { code: "resource_below_minimum", roundKey, sourceKey, targetKey: resourceKey, value, minimum: resource.minimum });
  }
  if (Number.isFinite(resource.maximum) && value > resource.maximum) {
    recordIssue(context, { code: "resource_above_maximum", roundKey, sourceKey, targetKey: resourceKey, value, maximum: resource.maximum });
  }
}

function applyEffect(rawSnapshot, effect, context, roundKey, sourceKey) {
  const snapshot = clone(rawSnapshot);
  const targetKey = String(effect?.targetKey ?? "");
  if (effect?.targetType === "state") {
    const current = snapshot.states[targetKey];
    let nextValue;
    if (effect.operation === "set") nextValue = clone(effect.value);
    else if (effect.operation === "increment") nextValue = Number(current || 0) + Number(effect.value || 0);
    else if (effect.operation === "decrement") nextValue = Number(current || 0) - Number(effect.value || 0);
    else if (effect.operation === "add") nextValue = [...new Set([...(Array.isArray(current) ? current : []), clone(effect.value)])];
    else if (effect.operation === "remove") nextValue = asArray(current).filter((entry) => signature(entry) !== signature(effect.value));
    else recordIssue(context, { code: "unsupported_operation", roundKey, sourceKey, targetType: "state", targetKey, operation: effect.operation });
    if (nextValue !== undefined) snapshot.states = withRecordValue(snapshot.states, targetKey, nextValue);
    checkStateValue(context, snapshot, targetKey, roundKey, sourceKey);
  } else if (effect?.targetType === "resource") {
    const current = Number(snapshot.resources[targetKey] || 0);
    let nextValue;
    if (effect.operation === "gain") nextValue = current + Number(effect.amount || 0);
    else if (effect.operation === "lose") nextValue = current - Number(effect.amount || 0);
    else if (effect.operation === "set") nextValue = Number(effect.amount ?? effect.value ?? 0);
    else recordIssue(context, { code: "unsupported_operation", roundKey, sourceKey, targetType: "resource", targetKey, operation: effect.operation });
    if (nextValue !== undefined) snapshot.resources = withRecordValue(snapshot.resources, targetKey, nextValue);
    checkResourceValue(context, snapshot, targetKey, roundKey, sourceKey);
  } else if (effect?.targetType === "evidence") {
    if (effect.operation === "unlock") snapshot.evidence = withRecordValue(snapshot.evidence, targetKey, "available");
    else if (effect.operation === "lock") snapshot.evidence = withRecordValue(snapshot.evidence, targetKey, "locked");
    else recordIssue(context, { code: "unsupported_operation", roundKey, sourceKey, targetType: "evidence", targetKey, operation: effect.operation });
  } else if (effect?.targetType === "event") {
    if (effect.operation === "trigger") snapshot.events = withRecordValue(snapshot.events, targetKey, true);
    else recordIssue(context, { code: "unsupported_operation", roundKey, sourceKey, targetType: "event", targetKey, operation: effect.operation });
  }
  return snapshot;
}

function applyStateWrites(snapshot, writes, context, roundKey, sourceKey) {
  let next = snapshot;
  for (const write of asArray(writes)) next = applyEffect(next, {
    targetType: "state",
    targetKey: write.stateKey,
    operation: write.operation,
    value: write.value
  }, context, roundKey, sourceKey);
  return next;
}

function applyResourceDeltas(snapshot, deltas, context, roundKey, sourceKey) {
  let next = snapshot;
  for (const delta of asArray(deltas)) next = applyEffect(next, {
    targetType: "resource",
    targetKey: delta.resourceKey,
    operation: delta.operation,
    amount: delta.amount
  }, context, roundKey, sourceKey);
  return next;
}

function applyEvidenceSwitches(rawSnapshot, unlocks, locks) {
  const snapshot = clone(rawSnapshot);
  for (const key of asArray(unlocks)) snapshot.evidence = withRecordValue(snapshot.evidence, key, "available");
  for (const key of asArray(locks)) snapshot.evidence = withRecordValue(snapshot.evidence, key, "locked");
  return snapshot;
}

function applyWorldRules(rawSnapshot, packageValue, context, roundKey) {
  let snapshot = rawSnapshot;
  for (const rule of packageValue.worldRules.filter((entry) => entry.evaluationChapterKey === roundKey)) {
    const triggersPass = asArray(rule.triggerEventKeys).every((key) => snapshot.events[key] === true);
    const conditionsPass = asArray(rule.preconditions).every((requirement) => requirementSatisfied(
      collectionFor(snapshot, requirement.targetType, context.facts)?.[requirement.targetKey],
      requirement.operator,
      requirement.value
    ));
    if (!triggersPass || !conditionsPass) continue;
    for (const effect of asArray(rule.effects)) snapshot = applyEffect(snapshot, effect, context, roundKey, `world-rule:${rule.key}`);
    snapshot.events = withRecordValue(snapshot.events, `world-rule:${rule.key}`, true);
  }
  return snapshot;
}

function evaluateRoutes(snapshot, packageValue, context) {
  const matched = packageValue.endingRoutes.filter((route) => !route.isDefault && asArray(route.requirements).every((requirement) => requirementSatisfied(
    collectionFor(snapshot, requirement.targetType, context.facts)?.[requirement.targetKey],
    requirement.operator,
    requirement.value
  )));
  const sorted = [...matched].sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
  const defaultRoute = packageValue.endingRoutes.find((route) => route.key === packageValue.endingResolution.defaultRouteKey)
    || packageValue.endingRoutes.find((route) => route.isDefault);
  return {
    matchedRouteKeys: sorted.map((route) => route.key),
    resolvedRouteKey: sorted[0]?.key || defaultRoute?.key || null
  };
}

function runtimeSignature(snapshot) {
  return signature({
    states: snapshot.states,
    resources: snapshot.resources,
    evidence: snapshot.evidence,
    events: snapshot.events
  });
}

export function simulateMechanismPackage(packageInput, { pathLimit = 4096 } = {}) {
  const packageValue = assertMechanismPackage(packageInput);
  const safeLimit = Number.isInteger(pathLimit) && pathLimit >= 1 ? Math.min(pathLimit, 50_000) : 4096;
  const context = {
    issues: [],
    issueKeys: new Set(),
    facts: Object.fromEntries(packageValue.factLedger.map((fact) => [fact.key, fact.truthValue])),
    statesByKey: new Map(packageValue.stateRegistry.map((state) => [state.key, state])),
    resourcesByKey: new Map(packageValue.resourceRegistry.map((resource) => [resource.key, resource]))
  };
  let paths = [{
    states: Object.fromEntries(packageValue.stateRegistry.map((state) => [state.key, clone(state.initialValue)])),
    resources: Object.fromEntries(packageValue.resourceRegistry.map((resource) => [resource.key, resource.initialValue])),
    evidence: Object.fromEntries(packageValue.evidenceGraph.evidence.map((evidence) => [evidence.key, "unavailable"])),
    events: {
      ...Object.fromEntries(packageValue.eventLedger.map((event) => [event.key, true])),
      ...Object.fromEntries(packageValue.branchFragments.filter((fragment) => fragment.branch === "event").map((fragment) => [fragment.key, false]))
    },
    trace: []
  }];

  for (const state of packageValue.stateRegistry) checkStateValue(context, paths[0], state.key, "initial", "registry");
  for (const resource of packageValue.resourceRegistry) checkResourceValue(context, paths[0], resource.key, "initial", "registry");

  let truncated = false;
  for (const round of [...packageValue.rounds].sort((left, right) => left.sequence - right.sequence)) {
    const decisions = packageValue.decisionNodes.filter((decision) => decision.roundKey === round.key);
    const nextPaths = [];
    for (const rawPath of paths) {
      let base = clone(rawPath);
      const readResults = round.stateReads.map((read) => requirementSatisfied(base.states[read.stateKey], read.operator, read.value));
      const readPassed = !readResults.length || (round.entryConditionMode === "any" ? readResults.some(Boolean) : readResults.every(Boolean));
      if (!readPassed) {
        base = applyStateWrites(base, round.onReadFail?.stateWrites, context, round.key, `${round.key}:read_fail`);
        base = applyResourceDeltas(base, round.onReadFail?.additionalCosts, context, round.key, `${round.key}:read_fail`);
        base = applyEvidenceSwitches(base, round.onReadFail?.unlocksEvidenceKeys, round.onReadFail?.locksEvidenceKeys);
        base.trace.push({ roundKey: round.key, branch: "read_fail", variantKey: round.onReadFail?.variantKey || null });
      } else {
        base.trace.push({ roundKey: round.key, branch: "read_pass", variantKey: round.onReadPass?.variantKey || null });
      }
      base = applyStateWrites(base, round.stateWrites, context, round.key, `${round.key}:mandatory`);
      base = applyResourceDeltas(base, round.resourceDeltas, context, round.key, `${round.key}:mandatory`);
      base = applyEvidenceSwitches(base, round.unlocksEvidenceKeys, round.locksEvidenceKeys);

      let decisionPaths = [base];
      for (const decision of decisions) {
        const branched = [];
        for (const decisionBase of decisionPaths) {
          const outcomeSignatures = new Map();
          for (const option of decision.options) {
            let optionPath = clone(decisionBase);
            for (const effect of option.effects) optionPath = applyEffect(optionPath, effect, context, round.key, `${decision.key}:${option.key}`);
            optionPath.trace.push({ roundKey: round.key, decisionKey: decision.key, optionKey: option.key });
            const resultSignature = runtimeSignature(optionPath);
            const priorOption = outcomeSignatures.get(resultSignature);
            if (priorOption && priorOption !== option.key) {
              recordIssue(context, {
                code: "equivalent_decision_options",
                roundKey: round.key,
                decisionKey: decision.key,
                optionKeys: [priorOption, option.key].sort()
              });
            } else outcomeSignatures.set(resultSignature, option.key);
            branched.push(optionPath);
            if (branched.length + nextPaths.length >= safeLimit) {
              truncated = true;
              break;
            }
          }
          if (truncated && branched.length + nextPaths.length >= safeLimit) break;
        }
        decisionPaths = branched;
      }
      if (!decisions.length) decisionPaths = [base];
      for (const decisionPath of decisionPaths) {
        nextPaths.push(applyWorldRules(decisionPath, packageValue, context, round.key));
        if (nextPaths.length >= safeLimit) {
          truncated = true;
          break;
        }
      }
      if (nextPaths.length >= safeLimit) break;
    }
    paths = nextPaths.slice(0, safeLimit);
  }

  const routePaths = new Map(packageValue.endingRoutes.map((route) => [route.key, []]));
  for (const [index, snapshot] of paths.entries()) {
    const ending = evaluateRoutes(snapshot, packageValue, context);
    snapshot.ending = ending;
    if (ending.matchedRouteKeys.length > 1) {
      recordIssue(context, { code: "multiple_ending_routes_match", pathIndex: index, routeKeys: ending.matchedRouteKeys });
    }
    if (ending.resolvedRouteKey && routePaths.has(ending.resolvedRouteKey)) routePaths.get(ending.resolvedRouteKey).push(index);
  }
  for (const route of packageValue.endingRoutes) {
    if (!route.isDefault && !routePaths.get(route.key)?.length) {
      recordIssue(context, { code: "unreachable_ending_route", routeKey: route.key });
    }
  }
  if (truncated) recordIssue(context, { code: "path_limit_reached", pathLimit: safeLimit });

  return {
    schemaVersion: 1,
    pathCount: paths.length,
    truncated,
    reachableEndingRouteKeys: [...routePaths.entries()].filter(([, indexes]) => indexes.length).map(([key]) => key),
    issues: context.issues,
    paths
  };
}

export function summarizeMechanismSimulation(report) {
  const countsByCode = {};
  for (const issue of asArray(report?.issues)) countsByCode[issue.code] = (countsByCode[issue.code] || 0) + 1;
  return {
    schemaVersion: report?.schemaVersion ?? 1,
    pathCount: Number(report?.pathCount || 0),
    truncated: report?.truncated === true,
    reachableEndingRouteKeys: asArray(report?.reachableEndingRouteKeys),
    issueCount: asArray(report?.issues).length,
    countsByCode
  };
}
