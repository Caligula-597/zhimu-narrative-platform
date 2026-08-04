import { cleanText } from "../../../prompts/shared.js";
import { getOutlineBlueprintSlotPath } from "../../../story-outline-contract/structure.js";
import {
  BATCH_FINGERPRINT_FIELDS,
  GENERIC_ENDING_TITLE,
  GENERIC_FINGERPRINT
} from "../../../story-outline-contract/vocabulary.js";

export function validateBlueprintEndingContract(context) {
  const {
    brief,
    chapterExpressions,
    contract,
    entities,
    expectedRevision,
    isV23,
    isV23Plus,
    isV24,
    issues,
    normalizedName,
    players,
    routes,
    spec,
    states,
    value
  } = context;
  const { resourceKeySet } = context.registries;

  const stateByKey = new Map(states.map((state) => [cleanText(state?.key, 80), state]));
  const resourceByKey = new Map((Array.isArray(value.resources) ? value.resources : [])
    .map((resource) => [cleanText(resource?.key, 80), resource]));
  const projectedResourceValueByKey = new Map();
  for (const resource of Array.isArray(value.resources) ? value.resources : []) {
    const resourceKey = cleanText(resource?.key, 80);
    let projected = Number(resource?.initialValue);
    for (const plan of (Array.isArray(contract.resourceUsagePlans) ? contract.resourceUsagePlans : [])
      .filter((entry) => cleanText(entry?.resourceKey, 80) === resourceKey)) {
      const repetitions = Array.isArray(plan?.chapterKeys) ? plan.chapterKeys.length : 0;
      const amount = Number(plan?.amount);
      if (!Number.isFinite(projected) || !Number.isFinite(amount)) continue;
      if (plan.operation === "gain") projected += amount * repetitions;
      if (plan.operation === "lose") projected -= amount * repetitions;
      if (plan.operation === "set" && repetitions) projected = amount;
    }
    if (Number.isFinite(projected)) projectedResourceValueByKey.set(resourceKey, projected);
  }
  const routeTargetKeys = new Set();
  const worldRuleByKey = new Map((Array.isArray(value.semanticConstitution?.worldRules)
    ? value.semanticConstitution.worldRules
    : []).map((rule) => [cleanText(rule?.key, 80), rule]));
  for (const [index, route] of routes.entries()) {
    const requirements = Array.isArray(route?.requirements) ? route.requirements : [];
    for (const requirement of requirements) {
      if (requirement?.targetType === "state") {
        const state = stateByKey.get(cleanText(requirement?.targetKey, 80));
        if (!state) {
          issues.push(`蓝图 routes[${index}] 引用了未登记状态`);
        } else if (state.valueType === "enum" && !state.allowedValues?.includes(requirement.value)) {
          issues.push(`蓝图 routes[${index}] 使用了状态 ${state.key} 不可达的枚举值`);
        } else {
          const stateIndex = (contract.stateKeys || []).indexOf(cleanText(requirement?.targetKey, 80));
          const fixedValue = contract.fixedStateValues?.[stateIndex];
          if (contract.stateControlModes?.[stateIndex] === "observed" && fixedValue
            && requirement.operator === "equals" && requirement.value !== fixedValue) {
            issues.push(`蓝图 routes[${index}] 把客观观察状态 ${state.key} 写成 ${String(requirement.value)}，但合同真值固定为 ${fixedValue}`);
          }
        }
      }
      if (requirement?.targetType === "resource") {
        const resourceKey = cleanText(requirement?.targetKey, 80);
        const projected = projectedResourceValueByKey.get(resourceKey);
        const resource = resourceByKey.get(resourceKey);
        const optionScopedPolicy = (contract.resourcePolicies || []).find((policy) => (
          cleanText(policy?.resourceKey, 80) === resourceKey
          && cleanText(policy?.placement, 80) === "chapterBeats.decision.options.effects"
        ));
        if (!resourceKeySet.has(resourceKey)) {
          issues.push(`蓝图 routes[${index}] 引用了未登记资源`);
        } else if (typeof requirement.value !== "number") {
          issues.push(`蓝图 routes[${index}] 对资源 ${resourceKey} 的条件值必须是 JSON 数字`);
        } else if (optionScopedPolicy && resource) {
          const minimum = Number(resource.minimum);
          const maximum = Number(resource.maximum);
          const target = Number(requirement.value);
          const satisfiableWithinContract = requirement.operator === "equals"
            ? target >= minimum && target <= maximum
            : requirement.operator === "gte"
              ? maximum >= target
              : requirement.operator === "lte"
                ? minimum <= target
                : true;
          if (!satisfiableWithinContract) {
            issues.push(`蓝图 routes[${index}] 对资源 ${resourceKey} 的条件超出资源合同范围 ${minimum}..${maximum}`);
          }
        } else if (Number.isFinite(projected)) {
          const target = Number(requirement.value);
          const reachable = requirement.operator === "equals"
            ? projected === target
            : requirement.operator === "gte"
              ? projected >= target
              : requirement.operator === "lte"
                ? projected <= target
                : true;
          if (!reachable) {
            issues.push(`蓝图 routes[${index}] 对资源 ${resourceKey} 的终局条件不可达：按既定公共变化最终为 ${projected}，不能满足 ${requirement.operator} ${target}`);
          }
        }
      }
    }
    for (const requirement of requirements) routeTargetKeys.add(cleanText(requirement?.targetKey, 80));
    for (const ruleKey of Array.isArray(route?.preconditionRuleKeys) ? route.preconditionRuleKeys : []) {
      const rule = worldRuleByKey.get(cleanText(ruleKey, 80));
      for (const precondition of Array.isArray(rule?.preconditions) ? rule.preconditions : []) {
        if (precondition?.targetType === "fact") {
          if (!(Array.isArray(route?.preconditionFactKeys) ? route.preconditionFactKeys : []).includes(precondition.targetKey)) {
            issues.push(`蓝图 routes[${index}] 引用规则 ${ruleKey}，但未携带事实前置条件 ${precondition.targetKey}`);
          }
          continue;
        }
        const covered = requirements.some((requirement) => (
          requirement?.targetType === precondition?.targetType
          && cleanText(requirement?.targetKey, 80) === cleanText(precondition?.targetKey, 80)
          && requirement?.operator === precondition?.operator
          && JSON.stringify(requirement?.value) === JSON.stringify(precondition?.value)
        ));
        if (!covered) issues.push(`蓝图 routes[${index}] 引用规则 ${ruleKey}，但遗漏前置条件 ${precondition?.targetType}:${precondition?.targetKey}`);
      }
    }
    if (route?.isDefault === true) continue;
    if (requirements.length < 2) issues.push(`蓝图 routes[${index}] 至少需要两个累计条件`);
    const stateChapters = new Set(
      requirements
        .filter((requirement) => requirement?.targetType === "state")
        .map((requirement) => cleanText(stateByKey.get(cleanText(requirement?.targetKey, 80))?.setInChapterKey, 80))
        .filter(Boolean)
    );
    const stateChapterIndexes = [...stateChapters]
      .map((chapterKey) => spec.chapterKeys.indexOf(chapterKey))
      .filter((chapterIndex) => chapterIndex >= 0);
    const splitIndex = Math.floor((spec.chapterKeys.length - 1) / 2);
    const hasEarly = stateChapterIndexes.some((chapterIndex) => chapterIndex < splitIndex);
    const hasLateBeforeFinal = stateChapterIndexes.some(
      (chapterIndex) => chapterIndex >= splitIndex
        && chapterIndex < spec.chapterKeys.length - 1
    );
    if (spec.chapterKeys.length >= 4 && (!hasEarly || !hasLateBeforeFinal)) {
      issues.push(`蓝图 routes[${index}] 必须读取前半段和最终章之前后半段分别写入的状态`);
    }
  }
  for (const resourceKey of resourceKeySet) {
    if (!routeTargetKeys.has(resourceKey)) issues.push(`蓝图资源 ${resourceKey} 必须被至少一条结局路线读取`);
  }
  if (!Array.isArray(value.chapterBeats) || value.chapterBeats.length !== 0) {
    issues.push(`蓝图 ${getOutlineBlueprintSlotPath("chapterBeats")} 必须为空数组`);
  }
  if (!Array.isArray(value.styleContract?.chapterExpressions) || chapterExpressions.length !== 0) {
    issues.push(`蓝图 ${getOutlineBlueprintSlotPath("styleExpressions")} 必须为空数组`);
  }
  if (routes.length !== 4) issues.push("蓝图 endingLogic.routes 必须恰好四条");
  for (const [index, route] of routes.entries()) {
    if (GENERIC_ENDING_TITLE.test(cleanText(route?.title, 160))) {
      issues.push(`蓝图 routes[${index}].title“${route?.title}”是批量模板结局名`);
    }
  }
  for (const [index, token] of (contract.endingTitleTokens || []).entries()) {
    if (!cleanText(routes[index]?.title, 160).includes(token)) issues.push(`蓝图第 ${index + 1} 条结局标题必须包含“${token}”`);
  }
  for (const field of BATCH_FINGERPRINT_FIELDS) {
    if (contract[field] && value.batchFingerprint?.[field] !== contract[field]) {
      issues.push(`蓝图 batchFingerprint.${field} 未逐字遵守批次合同`);
    }
  }
  for (const field of BATCH_FINGERPRINT_FIELDS) {
    const fingerprint = cleanText(value.batchFingerprint?.[field], field === "themeExpression" ? 240 : 180);
    if (fingerprint.length < 6) issues.push(`蓝图 batchFingerprint.${field} 缺失或过短`);
    if (GENERIC_FINGERPRINT.test(fingerprint)) {
      issues.push(`蓝图 batchFingerprint.${field} 仍是批量生成泛化模板`);
    }
  }
  if (isV23Plus) {
    const blueprintText = JSON.stringify(value);
    for (const invariant of contract.semanticInvariants || []) {
      for (const patternText of invariant.requiredPatterns || []) {
        try {
          if (!new RegExp(patternText, "iu").test(blueprintText)) issues.push(`蓝图语义不变量 ${invariant.key} 缺少必须事实：/${patternText}/`);
        } catch {
          issues.push(`蓝图语义不变量 ${invariant.key} requiredPatterns 无效：${patternText}`);
        }
      }
      for (const patternText of invariant.forbiddenPatterns || []) {
        try {
          if (new RegExp(patternText, "iu").test(blueprintText)) issues.push(`蓝图语义不变量 ${invariant.key} 命中禁止矛盾：/${patternText}/`);
        } catch {
          issues.push(`蓝图语义不变量 ${invariant.key} forbiddenPatterns 无效：${patternText}`);
        }
      }
    }
  }
}
