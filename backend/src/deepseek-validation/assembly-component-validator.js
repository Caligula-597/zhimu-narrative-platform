import { throwErr } from "../api-errors.js";
import { cleanText } from "../prompts/shared.js";
import {
  findUnexpectedOutlineAssemblyFields,
  getOutlineAssemblyField
} from "../story-outline-contract/structure.js";
import { INTERNAL_CHOICE_LANGUAGE } from "../story-outline-contract/vocabulary.js";
export function validateStoryOutlineAssemblyComponent(
  rawComponent,
  component,
  blueprint,
  spec,
  { generationContract = null } = {}
) {
  const value = rawComponent && typeof rawComponent === "object" && !Array.isArray(rawComponent)
    ? rawComponent
    : {};
  const field = getOutlineAssemblyField(component);
  if (!field) throwErr("DEEPSEEK_OUTPUT_INVALID", `未知章节装配组件：${component}`);
  const issues = [];
  const extraFields = findUnexpectedOutlineAssemblyFields(value, [field]);
  if (extraFields.length) issues.push(`${component} 组件不得输出额外字段：${extraFields.join("、")}`);
  const fieldIsArray = Array.isArray(value[field]);
  if (!fieldIsArray) {
    issues.push(`${field} 必须是 JSON 数组，不得输出以 roleKey 或 chapterKey 为键的对象映射`);
  }
  const rows = fieldIsArray ? value[field] : [];

  if (component === "playerActions") {
    const players = Array.isArray(blueprint?.players) ? blueprint.players : [];
    const expectedRoleKeys = players.map((player) => cleanText(player?.key, 80));
    const actualRoleKeys = rows.map((row) => cleanText(row?.roleKey, 80));
    if (rows.length !== players.length) issues.push(`playerChapterActions 必须恰好 ${players.length} 项`);
    if (JSON.stringify(actualRoleKeys) !== JSON.stringify(expectedRoleKeys)) issues.push("playerChapterActions.roleKey 必须按蓝图玩家顺序一致");
    for (const [index, row] of rows.entries()) {
      const actions = Array.isArray(row?.chapterActions) ? row.chapterActions : [];
      const plan = generationContract?.roleActionChapterKeys?.find((entry) => entry?.roleKey === expectedRoleKeys[index]);
      const influence = generationContract?.roleEndingInfluences?.find((entry) => entry?.roleKey === expectedRoleKeys[index]);
      const requiredAffectsRoleKeys = Array.isArray(players[index]?.contribution?.affectsRoleKeys)
        ? players[index].contribution.affectsRoleKeys.map((key) => cleanText(key, 80)).filter(Boolean)
        : [];
      const expectedChapterKeys = Array.isArray(plan?.chapterKeys) ? plan.chapterKeys : [];
      const actualChapterKeys = actions.map((action) => cleanText(action?.chapterKey, 80));
      if (plan && JSON.stringify(actualChapterKeys) !== JSON.stringify(expectedChapterKeys)) {
        issues.push(`${expectedRoleKeys[index]}.chapterActions 必须逐章遵守生成前分配：${expectedChapterKeys.join("、")}`);
      }
      for (const [actionIndex, action] of actions.entries()) {
        if (cleanText(action?.action, 1200).length < 8) issues.push(`${expectedRoleKeys[index]}.chapterActions[${actionIndex}].action 缺失或过短`);
        if (cleanText(action?.actionTarget, 800).length < 2) issues.push(`${expectedRoleKeys[index]}.chapterActions[${actionIndex}].actionTarget 缺失`);
        if (cleanText(action?.method, 1200).length < 4) issues.push(`${expectedRoleKeys[index]}.chapterActions[${actionIndex}].method 缺失或过短`);
        if (cleanText(action?.consequence, 1200).length < 4) issues.push(`${expectedRoleKeys[index]}.chapterActions[${actionIndex}].consequence 缺失或过短`);
        const affectsRoleKeys = Array.isArray(action?.affectsRoleKeys)
          ? action.affectsRoleKeys.map((key) => cleanText(key, 80)).filter(Boolean)
          : [];
        if (!affectsRoleKeys.some((roleKey) => roleKey !== expectedRoleKeys[index])) {
          issues.push(`${expectedRoleKeys[index]}.chapterActions[${actionIndex}].affectsRoleKeys 必须包含至少一名其他玩家`);
        }
        if (requiredAffectsRoleKeys.length
          && !affectsRoleKeys.some((roleKey) => requiredAffectsRoleKeys.includes(roleKey))) {
          issues.push(`${expectedRoleKeys[index]}.chapterActions[${actionIndex}].affectsRoleKeys 必须落实蓝图既有关系对象：${requiredAffectsRoleKeys.join("、")}`);
        }
        if (generationContract?.outlineRevision === "2.3") {
          const actualStateWriteKeys = Array.isArray(action?.stateWriteKeys)
            ? action.stateWriteKeys.map((key) => cleanText(key, 80)).filter(Boolean)
            : [];
          const expectedStateWriteKeys = influence?.chapterKey === actualChapterKeys[actionIndex]
            ? [cleanText(influence?.stateKey, 80)]
            : [];
          if (influence && JSON.stringify(actualStateWriteKeys) !== JSON.stringify(expectedStateWriteKeys)) {
            issues.push(`${expectedRoleKeys[index]}.chapterActions[${actionIndex}].stateWriteKeys 必须逐项照抄玩家行动骨架：${JSON.stringify(expectedStateWriteKeys)}`);
          }
          const evidenceEffectKeys = Array.isArray(action?.evidenceEffectKeys) ? action.evidenceEffectKeys : [];
          if (evidenceEffectKeys.length) {
            issues.push(`${expectedRoleKeys[index]}.chapterActions[${actionIndex}].evidenceEffectKeys 必须为空；证据开关只在 chapterBeats 记录`);
          }
          const resourceKeys = Array.isArray(action?.resourceKeys)
            ? action.resourceKeys.map((key) => cleanText(key, 80)).filter(Boolean)
            : [];
          if (resourceKeys.length) {
            issues.push(`${expectedRoleKeys[index]}.chapterActions[${actionIndex}].resourceKeys 必须为空；公共资源变化只在 chapterBeats 记录`);
          }
        }
        if (generationContract?.outlineRevision === "2.4") {
          if (!["proposal", "attempt", "conditional", "committed"].includes(action?.commitmentMode)) issues.push(`${expectedRoleKeys[index]}.chapterActions[${actionIndex}].commitmentMode 无效`);
          if (action?.commitmentMode === "conditional") {
            if (cleanText(action?.decisionKey, 80).length < 2 || !Array.isArray(action?.optionKeys) || !action.optionKeys.length) {
              issues.push(`${expectedRoleKeys[index]}.chapterActions[${actionIndex}] conditional 行动必须声明 decisionKey 与 optionKeys`);
            }
          }
          if (!Array.isArray(action?.eventKeys)) issues.push(`${expectedRoleKeys[index]}.chapterActions[${actionIndex}].eventKeys 必须是数组`);
        }
      }
    }
  } else if (component === "chapterBeats") {
    const chapterKeys = rows.map((beat) => cleanText(beat?.chapterKey, 80));
    if (fieldIsArray && rows.length !== spec.chapterKeys.length) {
      issues.push(`chapterBeats 必须恰好 ${spec.chapterKeys.length} 项，实际为 ${rows.length} 项`);
    } else if (fieldIsArray && JSON.stringify(chapterKeys) !== JSON.stringify(spec.chapterKeys)) {
      issues.push(`chapterBeats 章节顺序必须为：${spec.chapterKeys.join("、")}`);
    }
    const stateVariables = Array.isArray(blueprint?.endingLogic?.stateVariables)
      ? blueprint.endingLogic.stateVariables
      : [];
    const resourceUsagePlans = Array.isArray(generationContract?.resourceUsagePlans)
      ? generationContract.resourceUsagePlans
      : [];
    for (const [beatIndex, beat] of rows.entries()) {
      const options = Array.isArray(beat?.decision?.options) ? beat.decision.options : [];
      for (const [optionIndex, option] of options.entries()) {
        const visibleText = cleanText(option?.choiceText ?? option?.choice, 800);
        const consequence = cleanText(option?.immediateConsequence, 1200);
        if (visibleText.length < 4) issues.push(`chapterBeats[${beatIndex}].decision.options[${optionIndex}].choiceText 缺失`);
        if (INTERNAL_CHOICE_LANGUAGE.test(visibleText) || INTERNAL_CHOICE_LANGUAGE.test(consequence)) {
          issues.push(`chapterBeats[${beatIndex}].decision.options[${optionIndex}] 暴露内部状态机语言`);
        }
        if (generationContract?.outlineRevision === "2.3") {
          const decisionStateKey = cleanText(beat?.decision?.stateKey, 80);
          if (cleanText(option?.sets?.stateKey, 80) !== decisionStateKey) {
            issues.push(`chapterBeats[${beatIndex}].decision.options[${optionIndex}].sets.stateKey 必须等于 decision.stateKey`);
          }
          if (option?.sets?.value === undefined || option?.sets?.value === null || option?.sets?.value === "") {
            issues.push(`chapterBeats[${beatIndex}].decision.options[${optionIndex}].sets.value 缺失`);
          }
        }
        if (generationContract?.outlineRevision === "2.4") {
          const effects = Array.isArray(option?.effects) ? option.effects : [];
          if (!effects.length) issues.push(`chapterBeats[${beatIndex}].decision.options[${optionIndex}].effects 至少需要一项`);
          for (const [effectIndex, effect] of effects.entries()) {
            if (!["state", "resource", "evidence", "event"].includes(effect?.targetType)) issues.push(`chapterBeats[${beatIndex}].decision.options[${optionIndex}].effects[${effectIndex}].targetType 无效`);
            if (cleanText(effect?.targetKey, 80).length < 2) issues.push(`chapterBeats[${beatIndex}].decision.options[${optionIndex}].effects[${effectIndex}].targetKey 缺失`);
            if (cleanText(effect?.consequence, 800).length < 8) issues.push(`chapterBeats[${beatIndex}].decision.options[${optionIndex}].effects[${effectIndex}].consequence 缺失或过短`);
          }
        }
      }
      const stateReads = Array.isArray(beat?.stateReads) ? beat.stateReads : [];
      const fail = beat?.onReadFail && typeof beat.onReadFail === "object" ? beat.onReadFail : {};
      const failWrites = Array.isArray(fail.stateWrites) ? fail.stateWrites : [];
      const failCosts = Array.isArray(fail.additionalCosts) ? fail.additionalCosts : [];
      const failLocks = Array.isArray(fail.locksEvidenceKeys) ? fail.locksEvidenceKeys : [];
      const failUnlocks = Array.isArray(fail.unlocksEvidenceKeys) ? fail.unlocksEvidenceKeys : [];
      const expectedResourceDeltas = resourceUsagePlans
        .filter((plan) => Array.isArray(plan?.chapterKeys) && plan.chapterKeys.includes(spec.chapterKeys[beatIndex]))
        .map((plan) => `${cleanText(plan?.resourceKey, 80)}:${cleanText(plan?.operation, 40)}:${Number(plan?.amount)}`)
        .sort();
      const actualResourceDeltas = (Array.isArray(beat?.resourceDeltas) ? beat.resourceDeltas : [])
        .map((delta) => `${cleanText(delta?.resourceKey, 80)}:${cleanText(delta?.operation, 40)}:${Number(delta?.amount)}`)
        .sort();
      if (generationContract?.outlineRevision === "2.3"
        && JSON.stringify(actualResourceDeltas) !== JSON.stringify(expectedResourceDeltas)) {
        issues.push(`chapterBeats[${beatIndex}].resourceDeltas 必须逐项照抄本章资源骨架：${expectedResourceDeltas.length ? expectedResourceDeltas.join("、") : "[]"}`);
      }
      if (generationContract?.outlineRevision === "2.4") {
        const expectedEntryMode = stateReads.length ? ["all", "any"] : ["none"];
        if (!expectedEntryMode.includes(beat?.entryConditionMode)) issues.push(`chapterBeats[${beatIndex}].entryConditionMode 与 stateReads 不一致`);
        if (stateReads.length) {
          if (cleanText(beat?.onReadPass?.variantKey, 120).length < 2 || cleanText(fail?.variantKey, 120).length < 2) issues.push(`chapterBeats[${beatIndex}] 有条件读取时必须提供通过与失败 variantKey`);
          if (cleanText(fail?.fallbackAction, 1200).length < 12) issues.push(`chapterBeats[${beatIndex}].onReadFail.fallbackAction 必须写明世界内继续方式`);
          if (!failWrites.length && !failCosts.length && !failLocks.length && !failUnlocks.length) issues.push(`chapterBeats[${beatIndex}].onReadFail 必须产生真实结构化代价`);
        } else if (failWrites.length || failCosts.length || failLocks.length || failUnlocks.length) {
          issues.push(`chapterBeats[${beatIndex}] 没有 stateReads，onReadFail 结构化代价必须为空`);
        }
      } else {
      const availableState = stateVariables
        .filter((state) => spec.chapterKeys.indexOf(state?.setInChapterKey) < beatIndex)
        .at(-1);
      const expectedReads = availableState ? [{
        stateKey: availableState.key,
        operator: "not_equals",
        value: availableState.initialValue
      }] : [];
      const actualReads = stateReads.map((read) => ({
        stateKey: cleanText(read?.stateKey, 80),
        operator: cleanText(read?.operator, 40),
        value: read?.value
      }));
      if (JSON.stringify(actualReads) !== JSON.stringify(expectedReads)) {
        issues.push(`chapterBeats[${beatIndex}].stateReads 必须逐项遵守预分配读取计划`);
      }
      const expectedEntryMode = expectedReads.length ? "all" : "none";
      if (beat?.entryConditionMode !== expectedEntryMode) {
        issues.push(`chapterBeats[${beatIndex}].entryConditionMode 必须为 ${expectedEntryMode}`);
      }
      if (expectedReads.length) {
        const expectedPassVariantKey = `${spec.chapterKeys[beatIndex]}-condition-pass`;
        const expectedFailVariantKey = `${spec.chapterKeys[beatIndex]}-condition-fail`;
        if (cleanText(beat?.onReadPass?.variantKey, 120) !== expectedPassVariantKey) {
          issues.push(`chapterBeats[${beatIndex}].onReadPass.variantKey 必须为 ${expectedPassVariantKey}`);
        }
        if (cleanText(fail?.variantKey, 120) !== expectedFailVariantKey) {
          issues.push(`chapterBeats[${beatIndex}].onReadFail.variantKey 必须为 ${expectedFailVariantKey}`);
        }
        if (cleanText(fail?.fallbackAction, 1200).length < 12) {
          issues.push(`chapterBeats[${beatIndex}].onReadFail.fallbackAction 必须写明至少十二字的世界内继续方式`);
        }
        const establishedStates = stateVariables.filter(
          (state) => spec.chapterKeys.indexOf(state?.setInChapterKey) < beatIndex
        );
        const failState = establishedStates.find(
          (state) => state?.key === cleanText(failWrites[0]?.stateKey, 80)
        );
        if (
          failWrites.length !== 1
          || !failState
          || failWrites[0]?.operation !== "set"
          || !Array.isArray(failState?.allowedValues)
          || !failState.allowedValues.includes(failWrites[0]?.value)
        ) {
          issues.push(`chapterBeats[${beatIndex}].onReadFail.stateWrites 必须写入一个本章前已建立状态的合法枚举值`);
        }
        if (failCosts.length || failLocks.length || failUnlocks.length) {
          issues.push(`chapterBeats[${beatIndex}].onReadFail 已预分配状态代价，不得再扣资源或改证据开关`);
        }
      } else if (failWrites.length || failCosts.length || failLocks.length || failUnlocks.length) {
        issues.push(`chapterBeats[${beatIndex}] 没有 stateReads，onReadFail 结构化代价必须为空`);
      }
      }
    }
  } else {
    const chapterKeys = rows.map((entry) => cleanText(entry?.chapterKey, 80));
    if (fieldIsArray && rows.length !== spec.chapterKeys.length) {
      issues.push(`styleChapterExpressions 必须恰好 ${spec.chapterKeys.length} 项，实际为 ${rows.length} 项`);
    } else if (fieldIsArray && JSON.stringify(chapterKeys) !== JSON.stringify(spec.chapterKeys)) {
      issues.push(`styleChapterExpressions 章节顺序必须为：${spec.chapterKeys.join("、")}`);
    }
    for (const [index, entry] of rows.entries()) {
      if (cleanText(entry?.sceneOrDialogue, 1200).length < 8) issues.push(`styleChapterExpressions[${index}].sceneOrDialogue 缺失或过短`);
    }
  }

  if (issues.length) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 章节装配组件 ${component} 未通过合同（${issues.length} 项）`, {
      outlineVersion: 2,
      outlineRevision: generationContract?.outlineRevision || "2.3",
      repairMode: "regenerate-assembly-component",
      generationAcceptanceMode: "reject-and-regenerate-component",
      issues
    });
  }
  return structuredClone(value);
}
