import { createHash } from "node:crypto";

const STRATEGIES = Object.freeze([
  "cooperative",
  "self_interested",
  "withholder",
  "silent",
  "saboteur",
  "opportunist"
]);

function array(value) {
  return Array.isArray(value) ? value : [];
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function seedFrom(value) {
  return Number.parseInt(createHash("sha256").update(stableJson(value)).digest("hex").slice(0, 8), 16) >>> 0;
}

function createPrng(initialSeed) {
  let state = initialSeed || 0x9e3779b9;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function requirementSatisfied(current, operator, expected) {
  if (operator === "gt") return current > expected;
  if (operator === "lt") return current < expected;
  if (operator === "lte") return current <= expected;
  if (operator === "eq") return current === expected;
  return current >= expected;
}

function optionScore(option, roleKey, strategy) {
  const benefitsSelf = array(option.benefitingRoleKeys).includes(roleKey);
  const harmsSelf = array(option.harmedRoleKeys).includes(roleKey);
  const canCounter = array(option.counterplayRoleKeys).includes(roleKey);
  const totalBenefits = array(option.benefitingRoleKeys).length;
  const totalHarms = array(option.harmedRoleKeys).length;
  if (strategy === "cooperative") return totalBenefits * 3 - totalHarms * 2 + (option.counterplay ? 1 : 0);
  if (strategy === "saboteur") return totalHarms * 3 - totalBenefits + (harmsSelf ? -2 : 0);
  if (strategy === "opportunist") return (benefitsSelf ? 5 : 0) - (harmsSelf ? 4 : 0) + totalBenefits - totalHarms;
  return (benefitsSelf ? 6 : 0) - (harmsSelf ? 6 : 0) + (canCounter ? 2 : 0) + totalBenefits - totalHarms;
}

function chooseOption(decision, roleKey, strategy, random) {
  if (strategy === "silent" && random() < 0.9) return null;
  if (strategy !== "silent" && random() < 0.04) return null;
  const scored = array(decision.options).map((option) => ({
    option,
    score: optionScore(option, roleKey, strategy) + random() * 0.4
  })).sort((left, right) => right.score - left.score);
  return scored[0]?.option || null;
}

function applyAxisEffects(states, effects) {
  for (const effect of array(effects)) {
    if (!effect?.axisKey || !Number.isFinite(Number(effect.delta))) continue;
    states[effect.axisKey] = Number(states[effect.axisKey] || 0) + Number(effect.delta);
  }
}

function resolveEnding(states, truthBible) {
  const routes = array(truthBible?.endingRoutes);
  const matched = routes
    .filter((route) => !route.isDefault && array(route.requirements).every((requirement) =>
      requirementSatisfied(Number(states[requirement.axisKey] || 0), requirement.operator, Number(requirement.value || 0))
    ))
    .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
  return matched[0]?.key || routes.find((route) => route.isDefault)?.key || null;
}

function clueSurvives(clue, strategyByRole, random) {
  if (clue.scope === "public_anchor") return true;
  const holders = array(clue.holderRoleKeys);
  const hostileHolder = holders.some((roleKey) => ["withholder", "saboteur"].includes(strategyByRole[roleKey]));
  const silentHolder = holders.some((roleKey) => strategyByRole[roleKey] === "silent");
  const interferable = clue.interference?.canHide || clue.interference?.canDestroy || clue.interference?.canSwap;
  let chance = clue.grantMode === "explore" ? 0.78 : clue.grantMode === "host_confirm" ? 0.92 : 0.97;
  if (silentHolder) chance -= 0.28;
  if (hostileHolder && interferable) chance -= clue.interference?.traceMode === "attributable" ? 0.28 : 0.48;
  if (clue.interference?.costSeverity === "high") chance += 0.08;
  return random() < Math.max(0.08, Math.min(0.99, chance));
}

function reconstructCriticalTruth(clueNetwork, truthBible, strategyByRole, random) {
  const clueByKey = new Map(array(clueNetwork?.clues).map((clue) => [clue.key, clue]));
  const available = new Set(array(clueNetwork?.clues).filter((clue) => clueSurvives(clue, strategyByRole, random)).map((clue) => clue.key));
  const criticalKeys = new Set(array(truthBible?.truthNodes).filter((node) => node.importance === "critical").map((node) => node.key));
  const results = [];
  for (const coverage of array(clueNetwork?.truthCoverage).filter((item) => criticalKeys.has(item.truthNodeKey))) {
    const pathPassed = array(coverage.paths).some((path) => {
      const cluesPass = array(path.clueKeys).every((key) => available.has(key) && clueByKey.has(key));
      const rolesPass = [...array(path.requiredRoleKeys), ...array(path.requiredInterpreterRoleKeys)].every((roleKey) => {
        const strategy = strategyByRole[roleKey];
        if (strategy === "silent") return random() < 0.22;
        if (strategy === "withholder") return random() < 0.5;
        return true;
      });
      return cluesPass && rolesPass;
    });
    const visibleRatio = array(coverage.paths).flatMap((path) => array(path.clueKeys)).filter((key) => available.has(key)).length /
      Math.max(1, array(coverage.paths).flatMap((path) => array(path.clueKeys)).length);
    const fallbackPassed = !pathPassed && Boolean(coverage.fallback) && visibleRatio >= 0.34 &&
      Object.values(strategyByRole).filter((strategy) => strategy !== "silent").length >= 2 && random() < 0.72;
    results.push({ truthNodeKey: coverage.truthNodeKey, recovered: pathPassed || fallbackPassed, usedFallback: fallbackPassed });
  }
  return results;
}

function assignedStrategies(roleKeys, runIndex, random) {
  return Object.fromEntries(roleKeys.map((roleKey, roleIndex) => [
    roleKey,
    STRATEGIES[(runIndex + roleIndex * 2 + Math.floor(random() * STRATEGIES.length)) % STRATEGIES.length]
  ]));
}

/**
 * Deterministic pre-prose pressure test. It tests authored state transitions and
 * information resilience; it deliberately does not claim to predict human taste.
 */
export function simulateMatrixStrategyTable({
  infoMatrix,
  clueNetwork,
  characterArchives,
  truthBible,
  runs = 100,
  seed
} = {}) {
  const runCount = Math.max(24, Math.min(500, Math.floor(Number(runs) || 100)));
  const roleKeys = array(characterArchives?.roles).map((role) => role.key).filter(Boolean);
  const decisions = array(infoMatrix?.decisions);
  const initialSeed = Number.isInteger(seed) ? seed >>> 0 : seedFrom({ infoMatrix, clueNetwork, roleKeys, endingRoutes: truthBible?.endingRoutes });
  const random = createPrng(initialSeed);
  const endingCounts = {};
  const roleInfluence = Object.fromEntries(roleKeys.map((key) => [key, 0]));
  const strategyCounts = Object.fromEntries(STRATEGIES.map((key) => [key, 0]));
  let decisionCount = 0;
  let defaultDecisionCount = 0;
  let criticalTruthRuns = 0;
  let recoveredCriticalCount = 0;
  let totalCriticalCount = 0;
  let fallbackTruthCount = 0;

  for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
    const strategyByRole = assignedStrategies(roleKeys, runIndex, random);
    Object.values(strategyByRole).forEach((strategy) => { strategyCounts[strategy] += 1; });
    const states = Object.fromEntries(array(truthBible?.endingAxes).map((axis) => [axis.key, 0]));
    for (const decision of decisions) {
      decisionCount += 1;
      const votes = new Map();
      const votersByOption = new Map();
      for (const roleKey of roleKeys) {
        const option = chooseOption(decision, roleKey, strategyByRole[roleKey], random);
        if (!option) continue;
        votes.set(option.key, Number(votes.get(option.key) || 0) + 1);
        votersByOption.set(option.key, [...array(votersByOption.get(option.key)), roleKey]);
      }
      const ranked = [...votes.entries()].sort((left, right) => right[1] - left[1] || (random() < 0.5 ? -1 : 1));
      const winner = array(decision.options).find((option) => option.key === ranked[0]?.[0]);
      if (!winner) {
        defaultDecisionCount += 1;
        applyAxisEffects(states, decision.defaultAxisEffects);
        continue;
      }
      applyAxisEffects(states, winner.axisEffects);
      const winningVotes = Number(ranked[0]?.[1] || 0);
      const runnerUpVotes = Number(ranked[1]?.[1] || 0);
      if (winningVotes - runnerUpVotes <= 1) {
        for (const roleKey of array(votersByOption.get(winner.key))) roleInfluence[roleKey] += 1;
      }
    }
    const truthResults = reconstructCriticalTruth(clueNetwork, truthBible, strategyByRole, random);
    totalCriticalCount += truthResults.length;
    recoveredCriticalCount += truthResults.filter((result) => result.recovered).length;
    fallbackTruthCount += truthResults.filter((result) => result.usedFallback).length;
    if (!truthResults.length || truthResults.every((result) => result.recovered)) criticalTruthRuns += 1;
    const endingKey = resolveEnding(states, truthBible) || "unresolved";
    endingCounts[endingKey] = Number(endingCounts[endingKey] || 0) + 1;
  }

  const defaultDecisionRate = decisionCount ? defaultDecisionCount / decisionCount : 1;
  const criticalTruthRecoveryRate = totalCriticalCount ? recoveredCriticalCount / totalCriticalCount : 1;
  const allCriticalTruthRecoveryRate = criticalTruthRuns / runCount;
  const endingShares = Object.fromEntries(Object.entries(endingCounts).map(([key, count]) => [key, Number((count / runCount).toFixed(3))]));
  const maxEndingShare = Math.max(0, ...Object.values(endingShares));
  const reachableEndingKeys = Object.keys(endingCounts).filter((key) => key !== "unresolved");
  const issues = [];
  if (!decisions.length) issues.push({ severity: "high", code: "strategy_playtest_no_decisions", targetStage: "matrix", message: "没有可供策略压力测试的逐幕决定" });
  if (defaultDecisionRate > 0.5) issues.push({ severity: "high", code: "strategy_playtest_default_overuse", targetStage: "matrix", message: `在 ${Math.round(defaultDecisionRate * 100)}% 的模拟决定中无人形成有效选择，只能依赖默认推进` });
  if (allCriticalTruthRecoveryRate < 0.55) issues.push({ severity: "high", code: "strategy_playtest_truth_blocked", targetStage: "clues", message: `仅 ${Math.round(allCriticalTruthRecoveryRate * 100)}% 的策略组合能拼回全部关键真相` });
  if (array(truthBible?.endingRoutes).length > 1 && reachableEndingKeys.length < 2) issues.push({ severity: "high", code: "strategy_playtest_ending_collapse", targetStage: "truth", message: "100 局策略组合只抵达一条主结局，结局条件或逐幕轴变化已经坍缩" });
  if (maxEndingShare > 0.9) issues.push({ severity: "medium", code: "strategy_playtest_ending_dominance", targetStage: "matrix", message: `单一结局覆盖 ${Math.round(maxEndingShare * 100)}% 的策略组合` });
  for (const [roleKey, influence] of Object.entries(roleInfluence)) {
    if (influence === 0) issues.push({ severity: "medium", code: "strategy_playtest_role_never_pivotal", roleKey, targetStage: "matrix", message: `${roleKey} 在 100 局策略组合中从未成为改变公共决定的关键一票` });
  }
  return {
    version: "1.0",
    method: "deterministic_strategy_pressure_test",
    claimBoundary: "只检查结构可达性与抗破坏性，不预测真人偏好、演技或情绪价值",
    seed: initialSeed,
    runs: runCount,
    passed: !issues.some((issue) => issue.severity === "high"),
    metrics: {
      decisionCount,
      defaultDecisionRate: Number(defaultDecisionRate.toFixed(3)),
      criticalTruthRecoveryRate: Number(criticalTruthRecoveryRate.toFixed(3)),
      allCriticalTruthRecoveryRate: Number(allCriticalTruthRecoveryRate.toFixed(3)),
      fallbackTruthUseRate: totalCriticalCount ? Number((fallbackTruthCount / totalCriticalCount).toFixed(3)) : 0,
      reachableEndingKeys,
      endingShares,
      maxEndingShare: Number(maxEndingShare.toFixed(3)),
      roleInfluence,
      strategyCounts
    },
    issues
  };
}

export { STRATEGIES as MATRIX_PLAYTEST_STRATEGIES };
