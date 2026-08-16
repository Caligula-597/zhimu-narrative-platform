import { throwErr } from "./api-errors.js";
import { requestDeepseekJson, resolveCreativePipeline } from "./deepseek.js";
import { buildInnocentAlibiBrief, injectKillerContradictions } from "./pipeline-matrix-killer-innocent.js";
import { scanKillerSpoilers } from "./pipeline-matrix-killer-guard.js";
import { applyScriptQualityGates } from "./pipeline-matrix-script-gates.js";
import {
  pipelineWordTargets,
  validateCharacterArchives,
  validateClueNetwork,
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
import { HUMAN_AUTHORSHIP_VERSION } from "./prompts/human-authorship.js";
import { actIndex, buildClueLedger, buildSpoilerContract, resolveKillerRoleKey } from "./prompts/matrix-prompt-engine.js";
import {
  buildTerminologyGroundingContract,
  TERMINOLOGY_GROUNDING_VERSION
} from "./prompts/matrix-terminology-grounding.js";
import { cleanText } from "./prompts/shared.js";
import { PROSE_QUALITY_GATE_VERSION } from "../../shared/prose-quality-gate.js";

export async function createPipelineMatrixNarrativePlayerScript(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const characterArchives = validateCharacterArchives(input.characterArchives, config, setting, truthBible);
  const clueNetwork = validateClueNetwork(input.clueNetwork, config, characterArchives, truthBible, setting);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, characterArchives, setting, truthBible, clueNetwork);
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
  const terminologyGroundingContract = buildTerminologyGroundingContract({
    setting,
    synopsis,
    styleCard,
    characterArchive,
    matrixRow,
    clueLedger: buildClueLedger(infoMatrix, actKey, { roleKey, config }),
    actMaterials: (infoMatrix.clues || []).filter((clue) => clue.actKey === actKey && clue.physicalForm),
    roleKey,
    actKey
  });
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
  const maxAttempts = 2;
  let script;
  let model;
  let qualityGates;
  let killerInjections = [];
  let accepted = false;

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
          roleRoster: {
            roles: characterArchives.roles.map((role) => ({
              key: role.key,
              name: role.name,
              publicIdentity: role.publicIdentity,
              pronouns: role.pronouns
            }))
          },
          terminologyGroundingContract,
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
            roleKey,
            pov: styleCard.pov,
            terminologyGroundingContract
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

    let gated = applyScriptQualityGates(script.body, {
      spoilerContract,
      infoMatrix,
      matrixRow,
      actKey,
      config,
      isKillerInnocentMode: killerInnocentMode,
      actIndex: actIdx,
      isKiller,
      finalActIndex: finalIdx,
      characterArchives,
      truthBible,
      pov: styleCard.pov,
      roleName: characterArchive.name
    });
    if (!gated.gates.playerProse.passed) {
      const repair = await requestDeepseekJson(
        buildMatrixDeAiPassMessages({
          body: gated.body,
          styleCard,
          targetWords,
          spoilerContract,
          characterArchive,
          roleRoster: {
            roles: characterArchives.roles.map((role) => ({
              key: role.key,
              name: role.name,
              publicIdentity: role.publicIdentity,
              pronouns: role.pronouns
            }))
          },
          terminologyGroundingContract,
          isKiller,
          actIndex: actIdx,
          finalActIndex: finalIdx,
          repairFeedback: gated.gates.playerProse.issues
        }),
        {
          maxTokens: Math.min(12000, targetWords * 3),
          temperature: 0.22,
          phase: "pipeline.script.prose_repair",
          context: { roleKey, actKey, attempt: attempt + 1 }
        }
      );
      const repairedBody = cleanText(repair.value?.body, 12000);
      if (repairedBody.length >= minWords) {
        script = { ...script, body: repairedBody };
        gated = applyScriptQualityGates(script.body, {
          spoilerContract,
          infoMatrix,
          matrixRow,
          actKey,
          config,
          isKillerInnocentMode: killerInnocentMode,
          actIndex: actIdx,
          isKiller,
          finalActIndex: finalIdx,
          characterArchives,
          truthBible,
          pov: styleCard.pov,
          roleName: characterArchive.name
        });
      }
    }
    script = { ...script, body: gated.body };
    qualityGates = gated.gates;
    if (gated.passed) {
      accepted = true;
      break;
    }
  }

  if (!accepted) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "剧本正文未通过人物边界、场景化正文或剧透门禁", {
      roleKey,
      actKey,
      qualityGates
    });
  }

  const prosePolicy = {
    humanAuthorshipVersion: HUMAN_AUTHORSHIP_VERSION,
    proseGateVersion: PROSE_QUALITY_GATE_VERSION,
    terminologyGroundingVersion: TERMINOLOGY_GROUNDING_VERSION,
    defaultGenerationMode: "scene_first"
  };
  script = { ...script, proseDiagnostics: qualityGates?.playerProse, prosePolicy };

  return {
    provider: "deepseek",
    model,
    script,
    scriptGenerationMode: "narrative",
    prosePolicy,
    qualityGates,
    killerInnocentMode,
    killerInjections
  };
}
