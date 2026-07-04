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
import { buildMatrixDeAiPassMessages, buildMatrixInnocentKillerScriptMessages, buildMatrixKillerSanitizeMessages, buildMatrixPlayerScriptMessages } from "./prompts/matrix-player-script.js";
import { buildActionLogMessages, buildDialogueLogMessages } from "./prompts/matrix-structured-script.js";
import { buildMatrixEvaluationMessages } from "./prompts/matrix-evaluate.js";
import {
  actIndex,
  buildMatrixScriptPromptBundle,
  buildSpoilerContract,
  resolveKillerRoleKey
} from "./prompts/matrix-prompt-engine.js";
import { buildTruthBibleMessages } from "./prompts/truth-bible.js";
import { cleanText } from "./prompts/shared.js";
import { scanKillerSpoilers } from "./pipeline-matrix-killer-guard.js";
import { buildInnocentAlibiBrief, injectKillerContradictions } from "./pipeline-matrix-killer-innocent.js";
import { applyScriptQualityGates } from "./pipeline-matrix-script-gates.js";
import {
  applyStructuredGates,
  buildPublicActionBrief,
  fillFeelingPack,
  stitchStructuredScript,
  validateActionLog,
  validateDialogueLog
} from "./pipeline-matrix-structured-script.js";

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
    const result = await createPipelineHostRunbook({ ...input, setting, synopsis, config, truthBible, infoMatrix, actKey });
    runbooks.push(result.runbook);
  }
  return { provider: "deepseek", runbooks: validateHostRunbooks({ runbooks }, config).runbooks };
}

export async function createPipelineMatrixPlayerScript(input) {
  const mode = input.scriptGenerationMode ?? "structured";
  if (mode === "structured") {
    return createPipelineMatrixStructuredPlayerScript(input);
  }
  return createPipelineMatrixNarrativePlayerScript(input);
}

async function createPipelineMatrixStructuredPlayerScript(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const characterArchives = validateCharacterArchives(input.characterArchives, config);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, characterArchives);
  const roleKey = String(input.roleKey || "");
  const actKey = String(input.actKey || "");
  const characterArchive = characterArchives.roles.find((r) => r.key === roleKey);
  const matrixRow = infoMatrix.rows.find((r) => r.roleKey === roleKey && r.actKey === actKey);
  if (!characterArchive || !matrixRow) throwErr("VALIDATION_ERROR", "roleKey 或 actKey 在矩阵中不存在");
  const targets = pipelineWordTargets(setting);
  const minWords = config.wordsPerSectionMin || targets.minScript;
  const targetWords = targets.perScript;
  const actIdx = actIndex(config, actKey);

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
  const spoilerContract = bundle.spoilerContract;
  const publicActionBrief = buildPublicActionBrief({
    characterArchive,
    matrixRow,
    actKey,
    actIndex: actIdx
  });
  const feelingsPack = fillFeelingPack({ matrixRow, characterArchive, actKey });

  let model;
  let script;
  let structuredGates;
  const maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const actionResult = await requestDeepseekJson(
      buildActionLogMessages({
        publicActionBrief,
        roleKey,
        actKey,
        targetWords,
        spoilerContract,
        roleRoster: bundle.roleRoster
      }),
      {
        maxTokens: 6000,
        temperature: 0.32,
        phase: "pipeline.script.action_log",
        context: { roleKey, actKey, attempt: attempt + 1 }
      }
    );
    model = actionResult.model;
    const actionLog = validateActionLog(actionResult.value);

    const dialogueResult = await requestDeepseekJson(
      buildDialogueLogMessages({
        publicActionBrief,
        roleKey,
        actKey,
        targetWords,
        spoilerContract,
        roleRoster: bundle.roleRoster,
        clueLedger: bundle.clueLedger,
        peerScriptDigest: bundle.peerScriptDigest
      }),
      {
        maxTokens: 6000,
        temperature: 0.36,
        phase: "pipeline.script.dialogue_log",
        context: { roleKey, actKey, attempt: attempt + 1 }
      }
    );
    const dialogueLog = validateDialogueLog(dialogueResult.value);

    const gated = applyStructuredGates({
      actionLog,
      feelingsPack,
      dialogueLog,
      roleKey,
      characterArchives,
      infoMatrix,
      matrixRow,
      actKey,
      config
    });
    structuredGates = gated.gates;

    const body = stitchStructuredScript({
      actionLog: gated.actionLog,
      feelingsPack: gated.feelingsPack,
      dialogueLog: gated.dialogueLog
    });

    script = {
      roleKey,
      actKey,
      title: `${actKey} · ${characterArchive.name.split("·")[0].trim()}记录`,
      body,
      tasks: matrixRow.tasks?.length ? [...matrixRow.tasks] : [],
      closingHook: cleanText(matrixRow.suspicion, 200) || "还有几处时间对不上。",
      structured: {
        actionLog: gated.actionLog,
        feelingsPack: gated.feelingsPack,
        dialogueLog: gated.dialogueLog
      }
    };

    const finalGates = applyScriptQualityGates(body, {
      spoilerContract,
      infoMatrix,
      matrixRow,
      actKey,
      config,
      isKillerInnocentMode: false,
      actIndex: actIdx,
      isKiller: resolveKillerRoleKey(truthBible, characterArchives) === roleKey,
      finalActIndex: Math.max(0, (config.chapterKeys?.length || 1) - 1)
    });
    script.body = finalGates.body;

    if (body.length >= minWords && gated.passed && finalGates.passed) break;
  }

  if (script.body.length >= minWords) {
    script = validateMatrixPlayerScript(script, roleKey, actKey, minWords);
  }

  return {
    provider: "deepseek",
    model,
    script,
    scriptGenerationMode: "structured",
    structuredGates,
    qualityGates: null,
    killerInnocentMode: false,
    killerInjections: []
  };
}

async function createPipelineMatrixNarrativePlayerScript(input) {
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
  const actIdx = actIndex(config, actKey);
  const finalIdx = Math.max(0, (config.chapterKeys?.length || 1) - 1);
  const killerKey = resolveKillerRoleKey(truthBible, characterArchives);
  const isKiller = killerKey === roleKey;
  const killerInnocentMode =
    input.killerScriptMode !== "legacy" && isKiller && actIdx < finalIdx;

  const spoilerContract = buildSpoilerContract({
    truthBible,
    config,
    actKey,
    roleKey,
    characterArchives,
    matrixRow
  });

  const innocentAlibi = killerInnocentMode
    ? buildInnocentAlibiBrief({ characterArchive, matrixRow, actKey, actIndex: actIdx })
    : null;

  const baseMsgInput = {
    setting,
    synopsis,
    config,
    styleCard,
    truthBible,
    characterArchive,
    characterArchives,
    infoMatrix,
    matrixRow,
    actKey,
    roleKey,
    targetWords,
    pov: styleCard.pov,
    existingScripts: input.scripts || {}
  };

  const maxAttempts = killerInnocentMode ? 2 : 1;
  let script;
  let model;
  let qualityGates;
  let killerInjections = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const messages = killerInnocentMode
      ? buildMatrixInnocentKillerScriptMessages({ ...baseMsgInput, innocentAlibi })
      : buildMatrixPlayerScriptMessages(baseMsgInput);

    const result = await requestDeepseekJson(messages, {
      maxTokens: Math.min(12000, targetWords * 3),
      temperature: killerInnocentMode ? 0.48 : 0.52,
      phase: killerInnocentMode ? "pipeline.script.innocent" : "pipeline.script",
      context: { roleKey, actKey, attempt: attempt + 1 }
    });
    model = result.model;
    script = validateMatrixPlayerScript(result.value, roleKey, actKey, minWords);
    if (matrixRow.tasks?.length) script = { ...script, tasks: [...matrixRow.tasks] };

    if (!killerInnocentMode && input.deAiPass !== false && styleCard.styleAnchor) {
      const polish = await requestDeepseekJson(
        buildMatrixDeAiPassMessages({ body: script.body, styleCard, targetWords, spoilerContract }),
        { maxTokens: Math.min(12000, targetWords * 3), temperature: 0.35, phase: "pipeline.script.deai", context: { roleKey, actKey } }
      );
      const polishedBody = cleanText(polish.value?.body, 12000);
      if (polishedBody.length >= minWords) script = { ...script, body: polishedBody };
    }

    if (killerInnocentMode) {
      const injected = injectKillerContradictions(script.body, { matrixRow, actIndex: actIdx });
      script = { ...script, body: injected.body };
      killerInjections = injected.injections;
    } else if (input.killerScriptMode === "legacy" && isKiller && actIdx < finalIdx) {
      let scan = scanKillerSpoilers(script.body, {
        spoilerContract,
        actIndex: actIdx,
        isKiller: true,
        finalActIndex: finalIdx
      });
      if (!scan.passed) {
        for (let s = 0; s < 2 && !scan.passed; s++) {
          const sanitized = await requestDeepseekJson(
            buildMatrixKillerSanitizeMessages({
              body: script.body,
              styleCard,
              targetWords,
              spoilerContract,
              violations: scan.violations,
              matrixRow,
              actKey,
              roleKey
            }),
            {
              maxTokens: Math.min(12000, targetWords * 3),
              temperature: 0.28,
              phase: "pipeline.script.killer_sanitize",
              context: { roleKey, actKey, attempt: s + 1 }
            }
          );
          const sanitizedBody = cleanText(sanitized.value?.body, 12000);
          if (sanitizedBody.length >= minWords) script = { ...script, body: sanitizedBody };
          scan = scanKillerSpoilers(script.body, {
            spoilerContract,
            actIndex: actIdx,
            isKiller: true,
            finalActIndex: finalIdx
          });
        }
      }
    }

    const gated = applyScriptQualityGates(script.body, {
      spoilerContract,
      infoMatrix,
      matrixRow,
      actKey,
      config,
      isKillerInnocentMode: killerInnocentMode,
      actIndex: actIdx,
      isKiller,
      finalActIndex: finalIdx
    });
    script = { ...script, body: gated.body };
    qualityGates = gated.gates;

    const innocentOk =
      killerInnocentMode &&
      gated.gates.guiltStatements?.passed &&
      gated.gates.forbiddenFacts?.passed;
    const legacyOk = !killerInnocentMode && gated.passed;
    if (innocentOk || legacyOk || attempt === maxAttempts - 1) break;
  }

  return {
    provider: "deepseek",
    model,
    script,
    scriptGenerationMode: "narrative",
    qualityGates,
    killerInnocentMode,
    killerInjections
  };
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
      sections[roleKey][actKey] = {
        title: script.title,
        body: script.body,
        tasks: script.tasks,
        closingHook: script.closingHook
      };
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
