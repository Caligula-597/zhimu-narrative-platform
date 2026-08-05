import { throwErr } from "./api-errors.js";
import { requestDeepseekJson, resolveCreativePipeline } from "./deepseek.js";
import { applyScriptQualityGates } from "./pipeline-matrix-script-gates.js";
import {
  applyStructuredGates,
  buildPublicActionBrief,
  fillFeelingPack,
  sanitizeMatrixRowForStructured,
  stitchStructuredScript,
  validateActionLog,
  validateDialogueLog
} from "./pipeline-matrix-structured-script.js";
import {
  pipelineWordTargets,
  validateCharacterArchives,
  validateInfoMatrix,
  validateMatrixPlayerScript,
  validateTruthBible
} from "./pipeline-matrix-model.js";
import { buildMatrixDeAiPassMessages } from "./prompts/matrix-player-script.js";
import { buildLiteraryStyleCard } from "./prompts/matrix-literary-styles.js";
import {
  actIndex,
  buildMatrixScriptPromptBundle,
  resolveKillerRoleKey
} from "./prompts/matrix-prompt-engine.js";
import { buildActionLogMessages, buildDialogueLogMessages } from "./prompts/matrix-structured-script.js";
import { cleanText } from "./prompts/shared.js";

export async function createPipelineMatrixStructuredPlayerScript(input) {
  const { setting, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config);
  const characterArchives = validateCharacterArchives(input.characterArchives, config);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, characterArchives);
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
  const styleCard = buildLiteraryStyleCard(input.setting || {});
  const maxAttempts = 2;
  let model;
  let script;
  let structuredGates;
  let qualityGates;
  let accepted = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const actionResult = await requestDeepseekJson(
      buildActionLogMessages({
        publicActionBrief,
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
        truthConsistency
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
        truthConsistency
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
    structuredGates = gated.gates;
    const body = stitchStructuredScript({
      actionLog: gated.actionLog,
      feelingsPack: gated.feelingsPack,
      dialogueLog: gated.dialogueLog,
      roleName: characterArchive.name
    });

    let finalBody = body;
    if (input.deAiPass !== false && styleCard.literaryStyle) {
      const polish = await requestDeepseekJson(
        buildMatrixDeAiPassMessages({
          body,
          styleCard,
          targetWords,
          spoilerContract,
          characterArchive,
          roleRoster: bundle.roleRoster,
          truthConsistency,
          isKiller,
          actIndex: actIdx,
          finalActIndex: finalIdx
        }),
        {
          maxTokens: Math.min(12000, targetWords * 3),
          temperature: 0.32,
          phase: "pipeline.script.deai",
          context: { roleKey, actKey, attempt: attempt + 1 }
        }
      );
      const polishedBody = cleanText(polish.value?.body, 12000);
      if (polishedBody.length >= minWords) finalBody = polishedBody;
    }

    script = {
      roleKey,
      actKey,
      title: `${actKey} · ${characterArchive.name.split("·")[0].trim()}记录`,
      body: finalBody,
      tasks: safeMatrixRow.tasks?.length ? [...safeMatrixRow.tasks] : [],
      closingHook: cleanText(safeMatrixRow.suspicion, 200) || "还有几处时间对不上。",
      structured: {
        actionLog: gated.actionLog,
        feelingsPack: gated.feelingsPack,
        dialogueLog: gated.dialogueLog
      }
    };
    const finalGates = applyScriptQualityGates(finalBody, {
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
    script.body = finalGates.body;
    qualityGates = finalGates.gates;
    if (script.body.length >= minWords && gated.passed && finalGates.passed) {
      accepted = true;
      break;
    }
  }

  if (!accepted) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "剧本正文未通过结构、人物边界或重复内容门禁", {
      roleKey,
      actKey,
      structuredGates,
      qualityGates
    });
  }
  script = validateMatrixPlayerScript(script, roleKey, actKey, minWords);
  return {
    provider: "deepseek",
    model,
    script,
    scriptGenerationMode: "structured",
    structuredGates,
    qualityGates,
    killerInnocentMode: false,
    killerInjections: []
  };
}
