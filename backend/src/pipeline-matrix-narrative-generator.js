import { throwErr } from "./api-errors.js";
import { requestDeepseekJson, resolveCreativePipeline } from "./deepseek.js";
import { buildInnocentAlibiBrief, injectKillerContradictions } from "./pipeline-matrix-killer-innocent.js";
import { scanKillerSpoilers } from "./pipeline-matrix-killer-guard.js";
import { applyScriptQualityGates } from "./pipeline-matrix-script-gates.js";
import {
  pipelineWordTargets,
  validateCharacterArchives,
  validateInfoMatrix,
  validateMatrixPlayerScript,
  validateTruthBible
} from "./pipeline-matrix-model.js";
import {
  buildMatrixDeAiPassMessages,
  buildMatrixInnocentKillerScriptMessages,
  buildMatrixKillerSanitizeMessages,
  buildMatrixPlayerScriptMessages
} from "./prompts/matrix-player-script.js";
import { buildLiteraryStyleCard } from "./prompts/matrix-literary-styles.js";
import { actIndex, buildSpoilerContract, resolveKillerRoleKey } from "./prompts/matrix-prompt-engine.js";
import { cleanText } from "./prompts/shared.js";

export async function createPipelineMatrixNarrativePlayerScript(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const characterArchives = validateCharacterArchives(input.characterArchives, config);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, characterArchives);
  const roleKey = String(input.roleKey || "");
  const actKey = String(input.actKey || "");
  const characterArchive = characterArchives.roles.find((role) => role.key === roleKey);
  const matrixRow = infoMatrix.rows.find((row) => row.roleKey === roleKey && row.actKey === actKey);
  if (!characterArchive || !matrixRow) throwErr("VALIDATION_ERROR", "roleKey 或 actKey 在矩阵中不存在");
  const styleCard = buildLiteraryStyleCard(input.setting || {});
  const targets = pipelineWordTargets(setting);
  const minWords = config.wordsPerSectionMin || targets.minScript;
  const targetWords = targets.perScript;
  const actIdx = actIndex(config, actKey);
  const finalIdx = Math.max(0, (config.chapterKeys?.length || 1) - 1);
  const isKiller = resolveKillerRoleKey(truthBible, characterArchives) === roleKey;
  const killerInnocentMode = input.killerScriptMode !== "legacy" && isKiller && actIdx < finalIdx;
  const spoilerContract = buildSpoilerContract({
    truthBible,
    config,
    actKey,
    roleKey,
    characterArchives,
    matrixRow,
    setting
  });
  const innocentAlibi = killerInnocentMode
    ? buildInnocentAlibiBrief({ characterArchive, matrixRow, actKey, actIndex: actIdx })
    : null;
  const baseMessageInput = {
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
      ? buildMatrixInnocentKillerScriptMessages({ ...baseMessageInput, innocentAlibi })
      : buildMatrixPlayerScriptMessages(baseMessageInput);
    const result = await requestDeepseekJson(messages, {
      maxTokens: Math.min(12000, targetWords * 3),
      temperature: killerInnocentMode ? 0.48 : 0.52,
      phase: killerInnocentMode ? "pipeline.script.innocent" : "pipeline.script",
      context: { roleKey, actKey, attempt: attempt + 1 }
    });
    model = result.model;
    script = validateMatrixPlayerScript(result.value, roleKey, actKey, minWords);
    if (matrixRow.tasks?.length) script = { ...script, tasks: [...matrixRow.tasks] };

    if (!killerInnocentMode && input.deAiPass !== false && styleCard.literaryStyle) {
      const polish = await requestDeepseekJson(
        buildMatrixDeAiPassMessages({
          body: script.body,
          styleCard,
          targetWords,
          spoilerContract,
          characterArchive,
          isKiller,
          actIndex: actIdx,
          finalActIndex: finalIdx
        }),
        {
          maxTokens: Math.min(12000, targetWords * 3),
          temperature: 0.35,
          phase: "pipeline.script.deai",
          context: { roleKey, actKey }
        }
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
      for (let sanitizeAttempt = 0; sanitizeAttempt < 2 && !scan.passed; sanitizeAttempt++) {
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
            context: { roleKey, actKey, attempt: sanitizeAttempt + 1 }
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
    const innocentPassed = killerInnocentMode
      && gated.gates.guiltStatements?.passed
      && gated.gates.forbiddenFacts?.passed;
    const legacyPassed = !killerInnocentMode && gated.passed;
    if (innocentPassed || legacyPassed || attempt === maxAttempts - 1) break;
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
