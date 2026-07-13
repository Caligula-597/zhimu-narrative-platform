import { resolveCreativePipeline, requestDeepseekJson } from "./deepseek.js";
import {
  validateCharacterArchives,
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
import { cleanText } from "./prompts/shared.js";

function validateMatrixEvaluation(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    overallScore: Number(value.overallScore) || 0,
    verdict: cleanText(value.verdict, 400),
    scores: value.scores && typeof value.scores === "object" ? value.scores : {},
    issues: Array.isArray(value.issues) ? value.issues : [],
    revisions: Array.isArray(value.revisions) ? value.revisions : [],
    readyForSync: Boolean(value.readyForSync),
    suggestions: Array.isArray(value.suggestions) ? value.suggestions : []
  };
}

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
  const result = await requestDeepseekJson(
    buildMatrixEvaluationMessages({
      setting,
      synopsis,
      config,
      truthBible: input.truthBible,
      infoMatrix: input.infoMatrix,
      scripts: input.scripts
    }),
    { maxTokens: 12000, temperature: 0.35, phase: "pipeline.evaluate" }
  );
  return {
    provider: "deepseek",
    model: result.model,
    evaluation: validateMatrixEvaluation(result.value)
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
  const { config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const characterArchives = validateCharacterArchives(input.characterArchives, config);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, characterArchives);
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
  const { config } = resolveCreativePipeline(input);
  const characterArchives = validateCharacterArchives(input.characterArchives, config);
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
