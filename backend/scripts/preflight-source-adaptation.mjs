/**
 * Run the source-adaptation fidelity preflight against a local UTF-8 source.
 * This phase is intentionally forbidden from generating a premise or story.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requestDeepseekJson } from "../src/deepseek-client.js";
import {
  buildSourceAdaptationPreflightMessages,
  buildSourceAdaptationPreflightRepairMessages,
  validateSourceAdaptationPreflight
} from "../src/prompts/source-adaptation-fidelity.js";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(backendRoot, "..");
const envPath = join(backendRoot, ".env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const sourceArg = process.argv[2] || "案例/口播.txt";
const sourcePath = isAbsolute(sourceArg) ? sourceArg : resolve(workspaceRoot, sourceArg);
if (!existsSync(sourcePath)) throw new Error(`source file not found: ${sourcePath}`);

const sourceMaterial = readFileSync(sourcePath, "utf8").trim();
const sourceContext = {
  title: "价值的幻觉与文明的底线",
  sourceType: "创作者口播稿",
  sourceMaterial,
  authorNotes: "保留原作者的犀利、偏激与推理推进；本轮禁止生成剧情。",
  intendedFormat: "6人多人视角长线剧本杀"
};
const requiredSemanticGroups = [
  { key: "position-platform", patterns: ["位置", "平台", "稀缺"], minimumMatches: 2, requiredAny: ["位置", "平台"] },
  { key: "marriage-bargaining", patterns: ["彩礼", "婚姻", "议价权"], minimumMatches: 2, requiredAny: ["彩礼", "婚姻"] },
  { key: "ranking-datafication", patterns: ["排名", "算法", "数据", "绩效", "流量"], minimumMatches: 2, requiredAny: ["排名", "算法"] },
  { key: "darwinism-instability", patterns: ["社会达尔文", "强者", "弱者", "淘汰"], minimumMatches: 2, requiredAny: ["社会达尔文", "淘汰"] },
  { key: "ai-repricing", patterns: ["AI", "替代", "机器", "效率"], minimumMatches: 2, requiredAny: ["AI"] },
  { key: "dignity-boundary", patterns: ["尊严", "文明", "边界", "基本权利"], minimumMatches: 2, requiredAny: ["尊严"] },
  { key: "social-insurance", patterns: ["保障", "保险", "医院", "失业", "弱者"], minimumMatches: 2, requiredAny: ["保障", "保险", "医院"] },
  { key: "pension-generation", patterns: ["养老金", "代际", "跨代", "义务"], minimumMatches: 2, requiredAny: ["养老金", "代际", "跨代"] },
  { key: "trust-short-termism", patterns: ["信任", "短期", "抢", "囤积", "承诺"], minimumMatches: 2, requiredAny: ["信任"] }
];

function distinctSemanticAssignment(semanticCoverage) {
  const conflictToGroup = new Map();
  const groupToConflict = new Map();
  function assign(group, visited) {
    for (const conflictId of group.coveringConflictIds) {
      if (visited.has(conflictId)) continue;
      visited.add(conflictId);
      const previousGroupKey = conflictToGroup.get(conflictId);
      const previousGroup = semanticCoverage.find((item) => item.key === previousGroupKey);
      if (!previousGroup || assign(previousGroup, visited)) {
        conflictToGroup.set(conflictId, group.key);
        groupToConflict.set(group.key, conflictId);
        return true;
      }
    }
    return false;
  }
  for (const group of semanticCoverage) assign(group, new Set());
  return {
    assignments: Object.fromEntries(groupToConflict),
    unassignedGroupKeys: semanticCoverage
      .map((group) => group.key)
      .filter((key) => !groupToConflict.has(key))
  };
}

function auditPreflight(value) {
  const thoughtMovement = Array.isArray(value?.thoughtMovement) ? value.thoughtMovement : [];
  const conflictLedger = Array.isArray(value?.conflictLedger) ? value.conflictLedger : [];
  const causalEdges = Array.isArray(value?.causalEdges) ? value.causalEdges : [];
  const sourceAnchors = thoughtMovement.map((item) => String(item?.sourceAnchor || "").trim()).filter(Boolean);
  const integrity = validateSourceAdaptationPreflight(value, sourceMaterial);
  const semanticCoverage = requiredSemanticGroups.map((group) => ({
    key: group.key,
    coveringConflictIds: conflictLedger
      .filter((conflict) => {
        const body = JSON.stringify(conflict);
        const enoughMatches = group.patterns.filter((pattern) => body.includes(pattern)).length >= group.minimumMatches;
        const hasRequired = !group.requiredAny?.length || group.requiredAny.some((pattern) => body.includes(pattern));
        return enoughMatches && hasRequired;
      })
      .map((conflict) => conflict.id),
    matchedPatterns: group.patterns.filter((pattern) => JSON.stringify(conflictLedger).includes(pattern))
  }));
  for (const item of semanticCoverage) item.covered = item.coveringConflictIds.length > 0;
  const distinctAssignment = distinctSemanticAssignment(semanticCoverage);
  return {
    sourceCharacters: sourceMaterial.length,
    thoughtStageCount: thoughtMovement.length,
    conflictCount: conflictLedger.length,
    causalEdgeCount: causalEdges.length,
    sourceAnchorCount: sourceAnchors.length,
    integrity,
    semanticCoverage,
    distinctSemanticAssignments: distinctAssignment.assignments,
    unassignedDistinctSemanticGroups: distinctAssignment.unassignedGroupKeys,
    distinctSemanticCarrierCount: Object.keys(distinctAssignment.assignments).length,
    allSemanticGroupsCovered: semanticCoverage.every((item) => item.covered),
    modelReadyForPremise: value?.coverageAudit?.readyForPremise === true,
    mechanicallyPassed:
      integrity.readyForPremise &&
      semanticCoverage.every((item) => item.covered) &&
      distinctAssignment.unassignedGroupKeys.length === 0
  };
}

const requestOptions = {
  maxTokens: 16000,
  temperature: 0.15,
  timeoutMs: 240000,
  retryOnJsonParse: true,
  transportRetries: 2
};

const initialResult = await requestDeepseekJson(
  buildSourceAdaptationPreflightMessages(sourceContext),
  { ...requestOptions, phase: "source_adaptation_fidelity_preflight" }
);
const initialValue = initialResult.value && typeof initialResult.value === "object" ? initialResult.value : {};
const initialAudit = auditPreflight(initialValue);
const runs = [{
  phase: "initial",
  model: initialResult.model,
  usage: initialResult.usage,
  mechanicalAudit: initialAudit
}];

let finalResult = initialResult;
let finalValue = initialValue;
let finalAudit = initialAudit;

for (let repairAttempt = 1; repairAttempt <= 2 && !finalAudit.mechanicallyPassed; repairAttempt += 1) {
  const missingSemanticGroups = finalAudit.semanticCoverage
    .filter((item) => !item.covered)
    .map((item) => ({
      key: item.key,
      searchTerms: requiredSemanticGroups.find((group) => group.key === item.key)?.patterns || []
    }));
  const repairAudit = {
    integrityIssues: finalAudit.integrity.issues,
    missingSemanticGroups,
    nonDistinctSemanticGroups: finalAudit.unassignedDistinctSemanticGroups,
    requirement: "每个语义组必须能分配到不同的 conflictLedger 条目；不要为凑数量补无关条目。"
  };
  const repairResult = await requestDeepseekJson(
    buildSourceAdaptationPreflightRepairMessages({
      ...sourceContext,
      rejectedDraft: finalValue,
      audit: repairAudit
    }),
    { ...requestOptions, temperature: 0.08, phase: `source_adaptation_fidelity_repair_${repairAttempt}` }
  );
  const repairValue = repairResult.value && typeof repairResult.value === "object" ? repairResult.value : {};
  const repairMechanicalAudit = auditPreflight(repairValue);
  runs.push({
    phase: `repair-${repairAttempt}`,
    model: repairResult.model,
    usage: repairResult.usage,
    mechanicalAudit: repairMechanicalAudit
  });
  finalResult = repairResult;
  finalValue = repairValue;
  finalAudit = repairMechanicalAudit;
}

console.log(JSON.stringify({
  sourcePath,
  runs,
  finalModel: finalResult.model,
  finalMechanicalAudit: finalAudit,
  preflight: finalValue
}, null, 2));

if (!finalAudit.mechanicallyPassed) process.exitCode = 2;
