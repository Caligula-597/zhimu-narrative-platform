import { throwErr } from "./api-errors.js";
import { resolveCreativePipeline, requestDeepseekJson } from "./deepseek.js";
import {
  validateCharacterArchives,
  validateHostRunbooks,
  validateInfoMatrix,
  validateTruthBible
} from "./pipeline-matrix-model.js";
import { buildCharacterArchivesMessages } from "./prompts/character-archives.js";
import { buildHostRunbookMessages } from "./prompts/host-runbook.js";
import { buildInfoMatrixMessages } from "./prompts/info-matrix.js";
import { buildActOutlineMessages, validateActOutline } from "./prompts/matrix-act-outline.js";
import {
  buildInnocentInferenceCompareMessages,
  buildInnocentScriptsInferenceMessages,
  mechanicalInnocentInferenceCompare,
  validateInnocentInferenceCompare,
  validateInnocentScriptsInference
} from "./prompts/matrix-innocent-inference.js";
import { buildLiteraryStyleCard } from "./prompts/matrix-literary-styles.js";
import { buildMatrixScriptPromptBundle, resolveKillerRoleKey } from "./prompts/matrix-prompt-engine.js";
import { buildReasoningNovelMessages, validateReasoningNovel } from "./prompts/matrix-reasoning-novel.js";
import {
  buildTruthReconstructionMessages,
  mechanicalTruthCompare,
  validateTruthReconstruction
} from "./prompts/matrix-truth-reconstruction.js";
import { buildTruthBibleMessages } from "./prompts/truth-bible.js";

function styleCardFromInput(input) {
  return buildLiteraryStyleCard(input.setting || {});
}

export async function createPipelineTruthBible(input) {
  const { setting, synopsis, config, brief } = resolveCreativePipeline(input);
  const result = await requestDeepseekJson(
    buildTruthBibleMessages({ setting, synopsis, config, styleCard: styleCardFromInput(input) }),
    { maxTokens: 6000, temperature: 0.45, phase: "pipeline.truth" }
  );
  return {
    provider: "deepseek",
    model: result.model,
    setting,
    synopsis,
    config,
    brief,
    truthBible: validateTruthBible(result.value, config)
  };
}

export async function createPipelineCharacterArchives(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const result = await requestDeepseekJson(
    buildCharacterArchivesMessages({
      setting,
      synopsis,
      config,
      truthBible,
      styleCard: styleCardFromInput(input)
    }),
    { maxTokens: 8000, temperature: 0.5, phase: "pipeline.characters" }
  );
  return {
    provider: "deepseek",
    model: result.model,
    truthBible,
    characterArchives: validateCharacterArchives(result.value, config)
  };
}

export async function createPipelineInfoMatrix(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const characterArchives = validateCharacterArchives(input.characterArchives, config);
  const result = await requestDeepseekJson(
    buildInfoMatrixMessages({
      setting,
      synopsis,
      config,
      truthBible,
      characterArchives,
      styleCard: styleCardFromInput(input)
    }),
    { maxTokens: 9000, temperature: 0.45, phase: "pipeline.matrix" }
  );
  return {
    provider: "deepseek",
    model: result.model,
    infoMatrix: validateInfoMatrix(result.value, config, characterArchives)
  };
}

export async function createPipelineHostRunbook(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, input.characterArchives);
  const actKey = String(input.actKey || config.chapterKeys?.[0] || "");
  if (!config.chapterKeys?.includes(actKey)) throwErr("VALIDATION_ERROR", "actKey 无效");
  const result = await requestDeepseekJson(
    buildHostRunbookMessages({
      setting,
      synopsis,
      config,
      truthBible,
      infoMatrix,
      characterArchives: input.characterArchives,
      actKey
    }),
    { maxTokens: 4000, temperature: 0.45, phase: "pipeline.host", context: { actKey } }
  );
  const book = result.value && typeof result.value === "object" ? result.value : {};
  return {
    provider: "deepseek",
    model: result.model,
    runbook: validateHostRunbooks({ runbooks: [book] }, config).runbooks[0]
  };
}

export async function createPipelineHostRunbooksAll(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, input.characterArchives);
  const runbooks = [];
  for (const actKey of config.chapterKeys || []) {
    const result = await createPipelineHostRunbook({
      ...input,
      setting,
      synopsis,
      config,
      truthBible,
      infoMatrix,
      actKey
    });
    runbooks.push(result.runbook);
  }
  return { provider: "deepseek", runbooks: validateHostRunbooks({ runbooks }, config).runbooks };
}

export async function createPipelineReasoningNovel(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const characterArchives = input.characterArchives
    ? validateCharacterArchives(input.characterArchives, config)
    : null;
  const styleCard = styleCardFromInput(input);
  const result = await requestDeepseekJson(
    buildReasoningNovelMessages({ setting, synopsis, config, truthBible, styleCard, characterArchives }),
    { maxTokens: 16000, temperature: 0.48, phase: "pipeline.reasoning_novel" }
  );
  return {
    provider: "deepseek",
    model: result.model,
    reasoningNovel: validateReasoningNovel(result.value, config),
    styleCard
  };
}

export async function createPipelineActOutline(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const characterArchives = validateCharacterArchives(input.characterArchives, config);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, characterArchives);
  const reasoningNovel = input.reasoningNovel;
  if (!reasoningNovel?.acts?.length) throwErr("VALIDATION_ERROR", "reasoningNovel 缺失");
  const roleKey = String(input.roleKey || "");
  const actKey = String(input.actKey || "");
  const characterArchive = characterArchives.roles.find((role) => role.key === roleKey);
  const matrixRow = infoMatrix.rows.find((row) => row.roleKey === roleKey && row.actKey === actKey);
  if (!characterArchive || !matrixRow) throwErr("VALIDATION_ERROR", "roleKey 或 actKey 在矩阵中不存在");
  const bundle = buildMatrixScriptPromptBundle({
    truthBible,
    infoMatrix,
    characterArchives,
    config,
    actKey,
    roleKey,
    matrixRow,
    existingScripts: input.scripts || {},
    setting
  });
  const result = await requestDeepseekJson(
    buildActOutlineMessages({
      setting,
      reasoningNovel,
      characterArchive,
      matrixRow,
      roleKey,
      actKey,
      styleCard: styleCardFromInput(input),
      spoilerContract: bundle.spoilerContract,
      fairnessContract: bundle.fairnessContract,
      clueLedger: bundle.clueLedger,
      killerAwarenessContract: bundle.spoilerContract.killerAwarenessContract,
      publicEnvironment: infoMatrix?.publicEnvironmentByAct?.[actKey] || null
    }),
    { maxTokens: 4000, temperature: 0.38, phase: "pipeline.act_outline", context: { roleKey, actKey } }
  );
  return {
    provider: "deepseek",
    model: result.model,
    actOutline: validateActOutline(result.value, roleKey, actKey, setting)
  };
}

export async function createPipelineTruthReconstruction(input) {
  const { config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const characterArchives = validateCharacterArchives(input.characterArchives, config);
  const actOutlines = input.actOutlines || {};
  if (!Object.keys(actOutlines).length) throwErr("VALIDATION_ERROR", "actOutlines 缺失");
  const result = await requestDeepseekJson(
    buildTruthReconstructionMessages({ truthBible, actOutlines, config, characterArchives }),
    { maxTokens: 6000, temperature: 0.32, phase: "pipeline.truth_reconstruction" }
  );
  const reconstruction = validateTruthReconstruction(result.value);
  const mechanical = mechanicalTruthCompare(reconstruction, truthBible);
  return {
    provider: "deepseek",
    model: result.model,
    reconstruction,
    mechanical,
    passed: mechanical.passed && reconstruction.verdict === "pass"
  };
}

export async function createPipelineInnocentScriptsTruthInference(input) {
  const { config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const characterArchives = validateCharacterArchives(input.characterArchives, config);
  const scripts = input.scripts || {};
  if (!Object.keys(scripts).length) throwErr("VALIDATION_ERROR", "scripts 缺失");
  const killerRoleKey = resolveKillerRoleKey(truthBible, characterArchives);
  const inferResult = await requestDeepseekJson(
    buildInnocentScriptsInferenceMessages({ scripts, config, characterArchives, killerRoleKey }),
    { maxTokens: 8000, temperature: 0.35, phase: "pipeline.innocent_inference" }
  );
  const inference = validateInnocentScriptsInference(inferResult.value);
  const mechanical = mechanicalInnocentInferenceCompare(inference, truthBible);
  const compareResult = await requestDeepseekJson(
    buildInnocentInferenceCompareMessages({ inference, truthBible, killerRoleKey }),
    { maxTokens: 4000, temperature: 0.28, phase: "pipeline.innocent_inference_compare" }
  );
  const comparison = validateInnocentInferenceCompare(compareResult.value);
  return {
    provider: "deepseek",
    model: inferResult.model,
    killerRoleKey,
    inference,
    comparison,
    mechanical,
    passed: mechanical.killerMatch && comparison.fairnessVerdict === "pass"
  };
}
