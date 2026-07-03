import { throwErr } from "./api-errors.js";
import { resolveCreativePipeline, requestDeepseekJson, validateDeepseekProposal } from "./deepseek.js";
import {
  buildProposalFromMatrix,
  characterArchivesToRolesMeta,
  pipelineWordTargets,
  validateCharacterArchives,
  validateHostRunbooks,
  validateInfoMatrix,
  validateMatrixPlayerScript,
  validateTruthBible
} from "./pipeline-matrix-model.js";
import { buildCharacterArchivesMessages } from "./prompts/character-archives.js";
import { buildHostRunbookMessages } from "./prompts/host-runbook.js";
import { buildInfoMatrixMessages } from "./prompts/info-matrix.js";
import { buildMatrixDeAiPassMessages, buildMatrixPlayerScriptMessages } from "./prompts/matrix-player-script.js";
import { buildMatrixEvaluationMessages } from "./prompts/matrix-evaluate.js";
import { buildTruthBibleMessages } from "./prompts/truth-bible.js";
import { cleanText } from "./prompts/shared.js";

function styleCardFromInput(input) {
  const setting = input.setting || {};
  return {
    volumeTier: setting.volumeTier || "standard",
    pov: setting.pov === "first" ? "first" : "second",
    tone: setting.tone || "",
    styleAnchor: cleanText(setting.styleAnchor, 2000),
    forbiddenPhrases: cleanText(setting.forbiddenPhrases, 1000)
  };
}

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

export async function createPipelineTruthBible(input) {
  const { setting, synopsis, config, brief } = resolveCreativePipeline(input);
  const styleCard = styleCardFromInput(input);
  const result = await requestDeepseekJson(
    buildTruthBibleMessages({ setting, synopsis, config, styleCard }),
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
  const { setting, synopsis, config, brief } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const styleCard = styleCardFromInput(input);
  const result = await requestDeepseekJson(
    buildCharacterArchivesMessages({ setting, synopsis, config, truthBible, styleCard }),
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
  const styleCard = styleCardFromInput(input);
  const result = await requestDeepseekJson(
    buildInfoMatrixMessages({ setting, synopsis, config, truthBible, characterArchives, styleCard }),
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
    buildHostRunbookMessages({ setting, synopsis, config, truthBible, infoMatrix, actKey }),
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
    const result = await createPipelineHostRunbook({ ...input, setting, synopsis, config, truthBible, infoMatrix, actKey });
    runbooks.push(result.runbook);
  }
  return { provider: "deepseek", runbooks: validateHostRunbooks({ runbooks }, config).runbooks };
}

export async function createPipelineMatrixPlayerScript(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const characterArchives = validateCharacterArchives(input.characterArchives, config);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, characterArchives);
  const roleKey = String(input.roleKey || "");
  const actKey = String(input.actKey || "");
  const characterArchive = characterArchives.roles.find((r) => r.key === roleKey);
  const matrixRow = infoMatrix.rows.find((r) => r.roleKey === roleKey && r.actKey === actKey);
  if (!characterArchive || !matrixRow) throwErr("VALIDATION_ERROR", "roleKey 或 actKey 在矩阵中不存在");
  const styleCard = styleCardFromInput(input);
  const targets = pipelineWordTargets(setting);
  const minWords = config.wordsPerSectionMin || targets.minScript;
  const targetWords = targets.perScript;
  const messages = buildMatrixPlayerScriptMessages({
    setting,
    synopsis,
    config,
    styleCard,
    truthBible,
    characterArchive,
    matrixRow,
    actKey,
    roleKey,
    targetWords,
    pov: styleCard.pov
  });
  const result = await requestDeepseekJson(messages, {
    maxTokens: Math.min(12000, targetWords * 3),
    temperature: 0.62,
    phase: "pipeline.script",
    context: { roleKey, actKey }
  });
  let script = validateMatrixPlayerScript(result.value, roleKey, actKey, minWords);
  if (input.deAiPass !== false && styleCard.styleAnchor) {
    const polish = await requestDeepseekJson(
      buildMatrixDeAiPassMessages({ body: script.body, styleCard, targetWords }),
      { maxTokens: Math.min(12000, targetWords * 3), temperature: 0.35, phase: "pipeline.script.deai", context: { roleKey, actKey } }
    );
    const polishedBody = cleanText(polish.value?.body, 12000);
    if (polishedBody.length >= minWords) script = { ...script, body: polishedBody };
  }
  return { provider: "deepseek", model: result.model, script };
}

export async function createPipelineMatrixEvaluation(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const result = await requestDeepseekJson(
    buildMatrixEvaluationMessages({
      setting,
      synopsis,
      truthBible: input.truthBible,
      infoMatrix: input.infoMatrix,
      scripts: input.scripts
    }),
    { maxTokens: 5000, temperature: 0.35, phase: "pipeline.evaluate" }
  );
  return {
    provider: "deepseek",
    model: result.model,
    evaluation: validateMatrixEvaluation(result.value)
  };
}

export function buildPipelineImportPackage(session) {
  const { setting, synopsis, config } = resolveCreativePipeline(session);
  const truthBible = session.truthBible ? validateTruthBible(session.truthBible, config) : null;
  const characterArchives = session.characterArchives ? validateCharacterArchives(session.characterArchives, config) : null;
  const infoMatrix = session.infoMatrix ? validateInfoMatrix(session.infoMatrix, config, characterArchives) : null;
  if (!truthBible || !characterArchives || !infoMatrix) {
    throwErr("VALIDATION_ERROR", "入库前需完成真相、角色档案与信息矩阵");
  }
  const proposal = validateDeepseekProposal(
    session.proposal || buildProposalFromMatrix({ setting, config, truthBible, infoMatrix })
  );
  const rolesMeta = characterArchivesToRolesMeta(characterArchives, infoMatrix, config);
  const sections = {};
  for (const [roleKey, acts] of Object.entries(session.scripts || {})) {
    sections[roleKey] = {};
    for (const [actKey, script] of Object.entries(acts || {})) {
      if (!script?.body) continue;
      sections[roleKey][actKey] = { title: script.title, body: script.body };
    }
  }
  return {
    proposal,
    roleMatrix: rolesMeta,
    rolesMeta,
    sections,
    synopsis: {
      title: config.title || setting.theme,
      summary: truthBible.summary.slice(0, 1200),
      overallManuscript: truthBible.summary
    },
    truthBible,
    infoMatrix,
    hostRunbooks: session.hostRunbooks
  };
}

export {
  buildProposalFromMatrix,
  characterArchivesToRolesMeta,
  matrixScriptsToSections,
  pipelineScriptMinWords,
  pipelineWordTargets
} from "./pipeline-matrix-model.js";
