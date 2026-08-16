import { resolveCreativePipeline, requestDeepseekJson } from "./deepseek.js";
import {
  validateCharacterArchives,
  validateClueNetwork,
  validateHostRunbooks,
  validateInfoMatrix,
  validateTruthBible
} from "./pipeline-matrix-model.js";
import {
  buildMatrixEvaluationMessages,
  buildMatrixScriptReadthroughMessages,
  validateMatrixScriptReadthroughEvaluation
} from "./prompts/matrix-evaluate.js";
import {
  buildKnowledgeBoundaryAuditMessages,
  collectPriorRoleKnowledge,
  scanKnowledgeLeakHeuristic,
  validateKnowledgeBoundaryAudit
} from "./prompts/matrix-knowledge-audit.js";
import { resolveKillerRoleKey } from "./prompts/matrix-prompt-engine.js";
import {
  diagnoseScriptCollection,
  fingerprintScriptCollection
} from "../../shared/prose-quality-gate.js";
import {
  buildArtifactDependencyManifest,
  buildRepairPlan
} from "./pipeline-narrative-state-audit.js";
import { validateMatrixEvaluation } from "./pipeline-matrix-evaluation-validator.js";
import { simulateMatrixStrategyTable } from "./pipeline-matrix-strategy-playtest.js";
import { playStructureProfile } from "../../shared/play-structure.js";
export { validateMatrixEvaluation } from "./pipeline-matrix-evaluation-validator.js";

export async function mapWithConcurrency(items, worker, requestedConcurrency = 3) {
  const values = Array.from(items || []);
  if (!values.length) return [];
  const concurrency = Math.min(4, Math.max(1, Math.floor(Number(requestedConcurrency) || 3)));
  const results = new Array(values.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, runWorker));
  return results;
}

export async function createPipelineMatrixEvaluation(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const characterArchives = validateCharacterArchives(input.characterArchives, config, setting, truthBible);
  const clueNetwork = validateClueNetwork(input.clueNetwork, config, characterArchives, truthBible, setting);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, characterArchives, setting, truthBible, clueNetwork);
  const hostRunbooks = input.hostRunbooks
    ? validateHostRunbooks({ runbooks: input.hostRunbooks }, config, setting).runbooks
    : [];
  const result = await requestDeepseekJson(
    buildMatrixEvaluationMessages({
      setting,
      synopsis,
      config,
      truthBible,
      characterArchives,
      clueNetwork,
      infoMatrix,
      hostRunbooks,
      scripts: input.scripts
    }),
    { maxTokens: 12000, temperature: 0.35, phase: "pipeline.evaluate" }
  );
  const evaluation = validateMatrixEvaluation(result.value, setting);
  const proseDiagnostics = diagnoseScriptCollection(input.scripts, { expectedPov: setting.pov });
  if (!proseDiagnostics.passed) {
    evaluation.readyForSync = false;
    evaluation.issues = [
      ...evaluation.issues,
      ...proseDiagnostics.issues
        .filter((issue) => issue.severity === "high")
        .slice(0, 12)
        .map((issue) => ({
          severity: "high",
          area: "player_prose_gate",
          detail: `${issue.cell} · 第 ${issue.paragraph || "-"} 段：${issue.message}`
        }))
    ];
    evaluation.revisions = [
      ...evaluation.revisions,
      ...proseDiagnostics.issues
        .filter((issue) => issue.severity === "high")
        .slice(0, 12)
        .map((issue) => ({
          targetLayer: "scripts",
          targetKey: issue.cell,
          priority: "must_fix",
          problem: `${issue.message}${issue.excerpt ? ` 原文：“${issue.excerpt}”` : ""}`,
          direction: issue.action,
          promptHint: `重写 ${issue.cell}：${issue.action}`
        }))
    ];
  }
  const redTeamRoutingIssues = [
    ...evaluation.redTeamFindings
      .filter((finding) => finding.severity === "high" || finding.result === "blocked" || finding.result === "fragile")
      .map((finding) => ({
        severity: finding.severity || "medium",
        area: `red_team_${finding.scenario || "unknown"}`,
        targetLayer: finding.repairLayer || "evaluation",
        targetKey: finding.targetKey,
        detail: finding.observedFailure || `${finding.scenario || "红队场景"} 未通过`
      })),
    ...(evaluation.redTeamComplete ? [] : [{
      severity: "high",
      area: "red_team_incomplete",
      targetLayer: "evaluation",
      detail: "六类对抗性桌测没有完整返回，不能据此放行"
    }])
  ];
  const strategyPlaytest = playStructureProfile(setting.playStructure).requiresPlayableDecision
    ? simulateMatrixStrategyTable({ infoMatrix, clueNetwork, characterArchives, truthBible, runs: 100 })
    : { passed: true, skipped: true, runs: 0, issues: [], claimBoundary: "纯推理结构不执行策略型结局压力测试" };
  if (!strategyPlaytest.passed) evaluation.readyForSync = false;
  const artifactDependencyManifest = buildArtifactDependencyManifest({
    setting,
    synopsis,
    truthBible,
    characterArchives,
    clueNetwork,
    infoMatrix,
    actOutlines: input.actOutlines,
    scripts: input.scripts,
    hostRunbooks
  });
  const repairPlan = buildRepairPlan({
    issues: [...evaluation.issues, ...redTeamRoutingIssues, ...strategyPlaytest.issues],
    revisions: evaluation.revisions,
    manifest: artifactDependencyManifest
  });
  return {
    provider: "deepseek",
    model: result.model,
    evaluation: {
      ...evaluation,
      proseDiagnostics,
      scriptFingerprint: fingerprintScriptCollection(input.scripts),
      repairPlan,
      artifactDependencyManifest,
      strategyPlaytest
    }
  };
}

export async function createPipelineMatrixScriptReadthroughEvaluation(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const result = await requestDeepseekJson(
    buildMatrixScriptReadthroughMessages({
      setting,
      synopsis,
      config,
      characterArchives: input.characterArchives,
      scripts: input.scripts
    }),
    { maxTokens: 12000, temperature: 0.35, phase: "pipeline.evaluate.readthrough" }
  );
  return {
    provider: "deepseek",
    model: result.model,
    evaluation: validateMatrixScriptReadthroughEvaluation(result.value)
  };
}

export async function createPipelineKnowledgeBoundaryAudit(input) {
  const { setting, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const characterArchives = validateCharacterArchives(input.characterArchives, config, setting, truthBible);
  const clueNetwork = validateClueNetwork(input.clueNetwork, config, characterArchives, truthBible, setting);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, characterArchives, setting, truthBible, clueNetwork);
  const roleKey = String(input.roleKey || "");
  const actKey = String(input.actKey || "");
  const characterArchive = characterArchives.roles.find((role) => role.key === roleKey);
  const matrixRow = infoMatrix.rows.find((row) => row.roleKey === roleKey && row.actKey === actKey);
  const actOutlines = input.actOutlines || {};
  const actOutline = input.actOutline || actOutlines[roleKey]?.[actKey];
  const priorKnowledge = collectPriorRoleKnowledge(actOutlines, roleKey, actKey, config);
  const chapterKeys = config.chapterKeys || [];
  const actPosition = chapterKeys.indexOf(actKey);
  const priorScriptBodies = [];
  if (actPosition > 0 && input.scripts?.[roleKey]) {
    for (const key of chapterKeys.slice(0, actPosition)) {
      const body = input.scripts[roleKey][key]?.body;
      if (body) priorScriptBodies.push(body);
    }
  }
  const isKiller = resolveKillerRoleKey(truthBible, characterArchives) === roleKey;
  const scriptBody = input.scriptBody || input.scripts?.[roleKey]?.[actKey]?.body || "";
  const heuristic = scanKnowledgeLeakHeuristic(scriptBody, {
    actOutline,
    priorKnowledgeFacts: priorKnowledge.facts,
    priorScriptBodies,
    isKiller
  });
  const result = await requestDeepseekJson(
    buildKnowledgeBoundaryAuditMessages({
      roleKey,
      actKey,
      characterArchive,
      actOutline,
      priorKnowledge,
      priorScriptBodies,
      truthBible,
      infoMatrix,
      matrixRow,
      scriptBody,
      isKiller
    }),
    {
      maxTokens: 4500,
      temperature: 0.2,
      phase: "pipeline.audit.knowledge",
      context: { roleKey, actKey }
    }
  );
  return {
    provider: "deepseek",
    model: result.model,
    cell: `${roleKey}_${actKey}`,
    heuristic,
    audit: validateKnowledgeBoundaryAudit(result.value)
  };
}

export async function createPipelineKnowledgeBoundaryAuditBatch(input) {
  const { setting, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const characterArchives = validateCharacterArchives(input.characterArchives, config, setting, truthBible);
  const work = characterArchives.roles.flatMap((role) =>
    (config.chapterKeys || []).map((actKey) => ({ roleKey: role.key, actKey }))
  );
  const cells = await mapWithConcurrency(
    work,
    ({ roleKey, actKey }) => createPipelineKnowledgeBoundaryAudit({ ...input, roleKey, actKey }),
    input.auditConcurrency
  );
  const highLeaks = cells.flatMap((cell) =>
    cell.audit.leaks
      .filter((leak) => leak.severity === "high")
      .map((leak) => ({ cell: cell.cell, ...leak }))
  );
  const heuristicHits = cells.filter((cell) => !cell.heuristic.passed);
  return {
    cells,
    passed: cells.every((cell) => cell.audit.passed) && heuristicHits.length === 0,
    summary: {
      totalCells: cells.length,
      auditFailed: cells.filter((cell) => !cell.audit.passed).length,
      heuristicFlagged: heuristicHits.length,
      highLeakCount: highLeaks.length,
      highLeaks: highLeaks.slice(0, 12)
    }
  };
}
