import { throwErr } from "./api-errors.js";
import { requestDeepseekJson, resolveCreativePipeline } from "./deepseek.js";
import { applyScriptQualityGates } from "./pipeline-matrix-script-gates.js";
import {
  applySceneContractGates,
  applyStructuredGates,
  buildPublicActionBrief,
  fillFeelingPack,
  sanitizeMatrixRowForStructured,
  validateActionLog,
  validateDialogueLog,
  validateSceneContract
} from "./pipeline-matrix-structured-script.js";
import {
  pipelineWordTargets,
  validateCharacterArchives,
  validateClueNetwork,
  validateInfoMatrix,
  validateMatrixPlayerScript,
  validateTruthBible
} from "./pipeline-matrix-model.js";
import { buildMatrixDeAiPassMessages } from "./prompts/matrix-player-script.js";
import { buildLiteraryStyleCard } from "./prompts/matrix-literary-styles.js";
import { HUMAN_AUTHORSHIP_VERSION } from "./prompts/human-authorship.js";
import {
  actIndex,
  buildMatrixScriptPromptBundle,
  resolveKillerRoleKey
} from "./prompts/matrix-prompt-engine.js";
import {
  buildActionLogMessages,
  buildDialogueLogMessages,
  buildSceneCompositionMessages,
  buildSceneContractMessages
} from "./prompts/matrix-structured-script.js";
import { cleanText } from "./prompts/shared.js";
import { TERMINOLOGY_GROUNDING_VERSION } from "./prompts/matrix-terminology-grounding.js";
import { PROSE_QUALITY_GATE_VERSION } from "../../shared/prose-quality-gate.js";

export async function createPipelineMatrixStructuredPlayerScript(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const characterArchives = validateCharacterArchives(input.characterArchives, config, setting, truthBible);
  const clueNetwork = validateClueNetwork(input.clueNetwork, config, characterArchives, truthBible, setting);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, characterArchives, setting, truthBible, clueNetwork);
  const roleKey = String(input.roleKey || "");
  const actKey = String(input.actKey || "");
  const characterArchive = characterArchives.roles.find((role) => role.key === roleKey);
  const matrixRow = infoMatrix.rows.find((row) => row.roleKey === roleKey && row.actKey === actKey);
  if (!characterArchive || !matrixRow) {
    throwErr("VALIDATION_ERROR", "roleKey 或 actKey 在矩阵中不存在");
  }

  const targets = pipelineWordTargets(setting);
  const minWords = config.wordsPerSectionMin || targets.minScript;
  const targetWords = targets.perScript;
  const actIdx = actIndex(config, actKey);
  const finalIdx = Math.max(0, (config.chapterKeys?.length || 1) - 1);
  const isKiller = resolveKillerRoleKey(truthBible, characterArchives) === roleKey;
  const safeMatrixRow = sanitizeMatrixRowForStructured({
    matrixRow,
    isKiller,
    actIndex: actIdx,
    finalActIndex: finalIdx
  });
  const styleCard = buildLiteraryStyleCard(input.setting || {});
  const actMaterials = (infoMatrix.clues || []).filter((clue) => clue.actKey === actKey && clue.physicalForm);
  const bundle = buildMatrixScriptPromptBundle({
    truthBible,
    infoMatrix,
    characterArchives,
    config,
    actKey,
    roleKey,
    matrixRow,
    existingScripts: input.scripts || {},
    setting,
    synopsis,
    styleCard,
    characterArchive,
    actMaterials
  });
  const spoilerContract = bundle.spoilerContract;
  const actOutline = input.actOutline || input.actOutlines?.[roleKey]?.[actKey];
  const publicActionBrief = buildPublicActionBrief({
    characterArchive,
    matrixRow: safeMatrixRow,
    actKey,
    actIndex: actIdx,
    actOutline
  });
  const feelingsPack = fillFeelingPack({
    matrixRow: safeMatrixRow,
    characterArchive,
    actKey,
    isKiller,
    actIndex: actIdx,
    finalActIndex: finalIdx,
    killerAwareness: setting?.killerAwareness || "self-aware"
  });
  const killerAwareness = setting?.killerAwareness || "self-aware";
  const truthConsistency = {
    roleKey,
    pronouns: characterArchive.pronouns,
    lockedRoleFacts: {
      hiddenIdentity: characterArchive.hiddenIdentity,
      motive: characterArchive.motive,
      timelineActions: characterArchive.timelineActions
    },
    ...(isKiller && killerAwareness === "self-aware"
      ? { lockedMotive: truthBible.motive, lockedMethod: truthBible.method }
      : {}),
    rule: "私人叙述不得否认或改写这些锁定事实；角色的对外谎言只能出现在引号内。尚未解锁的事实可以回避，但不得虚构相反记忆。"
  };
  const terminologyGroundingContract = bundle.terminologyGroundingContract;
  const maxAttempts = 2;
  let model;
  let script;
  let structuredGates;
  let qualityGates;
  let sceneContract;
  let accepted = false;
  const sharedActContract = (infoMatrix.actContracts || []).find((contract) => contract.actKey === actKey) || null;
  const sharedRoleScenes = (sharedActContract?.sceneSequence || []).filter((scene) =>
    !scene.presentRoleKeys?.length || scene.presentRoleKeys.includes(roleKey)
  );
  const expectedSceneCount = sharedRoleScenes.length || (targetWords >= 2500 ? 4 : targetWords >= 1200 ? 3 : 2);
  const actDecision = (infoMatrix.decisions || []).find((decision) => decision.actKey === actKey) || null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const sceneResult = await requestDeepseekJson(
      buildSceneContractMessages({
        publicActionBrief,
        roleKey,
        actKey,
        targetWords,
        expectedSceneCount,
        sharedActContract: sharedActContract ? { ...sharedActContract, sceneSequence: sharedRoleScenes } : null,
        actDecision,
        actMaterials,
        spoilerContract,
        roleRoster: bundle.roleRoster,
        entityUnlockContract: bundle.entityUnlockContract,
        styleCard,
        characterArchive,
        actOutline,
        truthConsistency,
        terminologyGroundingContract
      }),
      {
        maxTokens: 5200,
        temperature: 0.28,
        phase: "pipeline.script.scene_contract",
        context: { roleKey, actKey, attempt: attempt + 1 }
      }
    );
    model = sceneResult.model;
    sceneContract = validateSceneContract(sceneResult.value);
    const sceneContractGate = applySceneContractGates(sceneContract, {
      expectedSceneCount,
      roleRoster: bundle.roleRoster,
      sharedActContract: sharedActContract ? { ...sharedActContract, sceneSequence: sharedRoleScenes } : null
    });
    if (!sceneContractGate.passed) {
      structuredGates = { sceneContract: sceneContractGate };
      continue;
    }
    const actionResult = await requestDeepseekJson(
      buildActionLogMessages({
        publicActionBrief,
        sceneContract,
        roleKey,
        actKey,
        targetWords,
        spoilerContract,
        roleRoster: bundle.roleRoster,
        entityUnlockContract: bundle.entityUnlockContract,
        isKiller,
        actIndex: actIdx,
        finalActIndex: finalIdx,
        styleCard,
        killerAwareness,
        characterArchive,
        actOutline,
        truthConsistency,
        pov: styleCard.pov,
        terminologyGroundingContract
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
        sceneContract,
        actionLog,
        feelingsPack,
        roleKey,
        actKey,
        targetWords,
        spoilerContract,
        roleRoster: bundle.roleRoster,
        clueLedger: bundle.clueLedger,
        entityUnlockContract: bundle.entityUnlockContract,
        peerScriptDigest: bundle.peerScriptDigest,
        isKiller,
        actIndex: actIdx,
        finalActIndex: finalIdx,
        styleCard,
        killerAwareness,
        characterArchive,
        actOutline,
        truthConsistency,
        pov: styleCard.pov,
        terminologyGroundingContract
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
      matrixRow: safeMatrixRow,
      actKey,
      config,
      isKiller,
      actIndex: actIdx,
      finalActIndex: finalIdx,
      minWords,
      killerAwareness
    });
    structuredGates = { sceneContract: sceneContractGate, ...gated.gates };
    if (!gated.passed) continue;
    const composition = await requestDeepseekJson(
      buildSceneCompositionMessages({
        sceneContract,
        actionLog: gated.actionLog,
        dialogueLog: gated.dialogueLog,
        feelingsPack: gated.feelingsPack,
        publicActionBrief,
        roleKey,
        actKey,
        targetWords,
        spoilerContract,
        roleRoster: bundle.roleRoster,
        styleCard,
        characterArchive,
        truthConsistency,
        isKiller,
        actIndex: actIdx,
        finalActIndex: finalIdx,
        killerAwareness,
        pov: styleCard.pov,
        terminologyGroundingContract
      }),
      {
        maxTokens: Math.min(12000, targetWords * 3),
        temperature: 0.34,
        phase: "pipeline.script.scene_composition",
        context: { roleKey, actKey, attempt: attempt + 1 }
      }
    );
    const finalBody = cleanText(composition.value?.body, 12000);
    if (finalBody.length < minWords) {
      qualityGates = { compositionLength: { passed: false, actual: finalBody.length, minWords } };
      continue;
    }

    script = {
      roleKey,
      actKey,
      title: `${actKey} · ${characterArchive.name.split("·")[0].trim()}记录`,
      body: finalBody,
      tasks: safeMatrixRow.tasks?.length ? [...safeMatrixRow.tasks] : [],
      closingHook: cleanText(safeMatrixRow.suspicion, 200) || "还有几处时间对不上。",
      structured: {
        sceneContract,
        actionLog: gated.actionLog,
        feelingsPack: gated.feelingsPack,
        dialogueLog: gated.dialogueLog
      }
    };
    let finalGates = applyScriptQualityGates(finalBody, {
      spoilerContract,
      infoMatrix,
      matrixRow,
      actKey,
      config,
      isKillerInnocentMode: false,
      actIndex: actIdx,
      isKiller,
      finalActIndex: finalIdx,
      characterArchives,
      truthBible,
      pov: styleCard.pov,
      roleName: characterArchive.name
    });
    if (!finalGates.gates.playerProse.passed && input.deAiPass !== false) {
      const repair = await requestDeepseekJson(
        buildMatrixDeAiPassMessages({
          body: finalGates.body,
          styleCard,
          targetWords,
          spoilerContract,
          characterArchive,
          roleRoster: bundle.roleRoster,
          truthConsistency,
          terminologyGroundingContract,
          isKiller,
          actIndex: actIdx,
          finalActIndex: finalIdx,
          repairFeedback: finalGates.gates.playerProse.issues
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
        finalGates = applyScriptQualityGates(repairedBody, {
          spoilerContract,
          infoMatrix,
          matrixRow,
          actKey,
          config,
          isKillerInnocentMode: false,
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
    script.body = finalGates.body;
    qualityGates = finalGates.gates;
    if (script.body.length >= minWords && finalGates.passed) {
      accepted = true;
      break;
    }
  }

  if (!accepted) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "剧本正文未通过结构、人物边界或场景化正文门禁", {
      roleKey,
      actKey,
      structuredGates,
      qualityGates
    });
  }
  script = validateMatrixPlayerScript(script, roleKey, actKey, minWords);
  const prosePolicy = {
    humanAuthorshipVersion: HUMAN_AUTHORSHIP_VERSION,
    proseGateVersion: PROSE_QUALITY_GATE_VERSION,
    terminologyGroundingVersion: TERMINOLOGY_GROUNDING_VERSION,
    defaultGenerationMode: "scene_first"
  };
  script.proseDiagnostics = qualityGates?.playerProse;
  script.prosePolicy = prosePolicy;
  return {
    provider: "deepseek",
    model,
    script,
    scriptGenerationMode: "structured",
    prosePolicy,
    structuredGates,
    qualityGates,
    killerInnocentMode: false,
    killerInjections: []
  };
}
