import { throwErr } from "../api-errors.js";
import { cleanText } from "../prompts/shared.js";
import {
  findUnexpectedOutlineAssemblyFields,
  getOutlineAssemblyField
} from "../story-outline-contract/structure.js";
import { INTERNAL_CHOICE_LANGUAGE } from "../story-outline-contract/vocabulary.js";
export function mergeStoryOutlineAssembly(blueprint, rawAssembly, spec, { generationContract = null } = {}) {
  const assembly = rawAssembly && typeof rawAssembly === "object" && !Array.isArray(rawAssembly)
    ? rawAssembly
    : {};
  const playerActionsField = getOutlineAssemblyField("playerActions");
  const chapterBeatsField = getOutlineAssemblyField("chapterBeats");
  const styleExpressionsField = getOutlineAssemblyField("styleExpressions");
  const rows = Array.isArray(assembly[playerActionsField]) ? assembly[playerActionsField] : [];
  const chapterBeats = Array.isArray(assembly[chapterBeatsField]) ? assembly[chapterBeatsField] : [];
  const styleChapterExpressions = Array.isArray(assembly[styleExpressionsField])
    ? assembly[styleExpressionsField]
    : [];
  const blueprintPlayers = Array.isArray(blueprint?.players) ? blueprint.players : [];
  const expectedRoleKeys = blueprintPlayers.map((player) => cleanText(player?.key, 80));
  const actualRoleKeys = rows.map((row) => cleanText(row?.roleKey, 80));
  const issues = [];

  if (rows.length !== blueprintPlayers.length) {
    issues.push(`章节装配 playerChapterActions 必须恰好 ${blueprintPlayers.length} 项`);
  }
  if (JSON.stringify(actualRoleKeys) !== JSON.stringify(expectedRoleKeys)) {
    issues.push("章节装配 roleKey 必须按蓝图玩家顺序逐项一致");
  }
  for (const [index, row] of rows.entries()) {
    if (!Array.isArray(row?.chapterActions)) {
      issues.push(`章节装配 playerChapterActions[${index}].chapterActions 必须是数组`);
      continue;
    }
    const actionPlan = generationContract?.roleActionChapterKeys?.find(
      (entry) => entry?.roleKey === expectedRoleKeys[index]
    );
    if (actionPlan) {
      if (row.chapterActions.length !== actionPlan.chapterKeys.length) {
        issues.push(`章节装配 ${expectedRoleKeys[index]} 的 chapterActions 必须恰好覆盖 ${actionPlan.chapterKeys.length} 章`);
      }
    }
  }
  if (chapterBeats.length !== spec.chapterKeys.length) {
    issues.push(`章节装配 chapterBeats 必须恰好 ${spec.chapterKeys.length} 项`);
  }
  const actualChapterKeys = chapterBeats.map((beat) => cleanText(beat?.chapterKey, 80));
  if (JSON.stringify(actualChapterKeys) !== JSON.stringify(spec.chapterKeys)) {
    issues.push("章节装配 chapterBeats 必须按规格章节顺序逐项一致");
  }
  const styleChapterKeys = styleChapterExpressions.map((entry) => cleanText(entry?.chapterKey, 80));
  if (JSON.stringify(styleChapterKeys) !== JSON.stringify(spec.chapterKeys)) {
    issues.push("章节装配 styleChapterExpressions 必须按规格章节顺序逐项一致");
  }
  for (const [index, entry] of styleChapterExpressions.entries()) {
    if (cleanText(entry?.sceneOrDialogue, 1200).length < 8) {
      issues.push(`章节装配 styleChapterExpressions[${index}].sceneOrDialogue 缺失或过短`);
    }
  }
  if (generationContract?.outlineRevision === "2.3") {
    for (const [beatIndex, beat] of chapterBeats.entries()) {
      const options = Array.isArray(beat?.decision?.options) ? beat.decision.options : [];
      for (const [optionIndex, option] of options.entries()) {
        const visibleText = cleanText(option?.choiceText ?? option?.choice, 800);
        const immediateConsequence = cleanText(option?.immediateConsequence, 1200);
        if (visibleText.length < 4) issues.push(`章节装配 chapterBeats[${beatIndex}].decision.options[${optionIndex}].choiceText 缺失或过短`);
        if (INTERNAL_CHOICE_LANGUAGE.test(visibleText) || INTERNAL_CHOICE_LANGUAGE.test(immediateConsequence)) {
          issues.push(`章节装配 chapterBeats[${beatIndex}].decision.options[${optionIndex}] 暴露内部状态机语言`);
        }
        const hiddenStateKey = cleanText(option?.sets?.stateKey, 80);
        if (!hiddenStateKey || hiddenStateKey !== cleanText(beat?.decision?.stateKey, 80)) {
          issues.push(`章节装配 chapterBeats[${beatIndex}].decision.options[${optionIndex}].sets.stateKey 必须等于 decision.stateKey`);
        }
        if (option?.sets?.value === undefined || option?.sets?.value === null || option?.sets?.value === "") {
          issues.push(`章节装配 chapterBeats[${beatIndex}].decision.options[${optionIndex}].sets.value 缺失`);
        }
      }
    }
  }
  const extraFields = findUnexpectedOutlineAssemblyFields(assembly);
  if (extraFields.length) {
    issues.push(`章节装配不得输出蓝图字段或额外字段：${extraFields.join("、")}`);
  }
  if (issues.length) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 章节装配未通过机械合同（${issues.length} 项）`, {
      outlineVersion: 2,
      outlineRevision: generationContract?.outlineRevision || "2.2",
      repairMode: "restart-full-draft",
      generationAcceptanceMode: "reject-and-restart-full-draft",
      issues
    });
  }

  if (["2.3", "2.4"].includes(generationContract?.outlineRevision)) {
    const outline = structuredClone(blueprint);
    outline.players = blueprintPlayers.map((player, index) => ({
      ...player,
      chapterActions: structuredClone(rows[index].chapterActions)
    }));
    outline.chapterBeats = structuredClone(chapterBeats);
    outline.styleContract = {
      ...outline.styleContract,
      chapterExpressions: structuredClone(styleChapterExpressions)
    };
    return outline;
  }

  const outline = structuredClone(blueprint);
  outline.players = blueprintPlayers.map((player, index) => {
    const chapterActions = structuredClone(rows[index].chapterActions);
    const actionPlan = generationContract?.roleActionChapterKeys?.find(
      (entry) => entry?.roleKey === player?.key
    );
    if (actionPlan && chapterActions.length === actionPlan.chapterKeys.length) {
      for (const [actionIndex, chapterKey] of actionPlan.chapterKeys.entries()) {
        chapterActions[actionIndex].chapterKey = chapterKey;
      }
    }
    return {
      ...player,
      chapterActions
    };
  });
  if (!generationContract) {
    outline.chapterBeats = structuredClone(chapterBeats);
    outline.styleContract = {
      ...outline.styleContract,
      chapterExpressions: structuredClone(styleChapterExpressions)
    };
    return outline;
  }
  if (generationContract) {
    for (const player of outline.players) {
      const influence = generationContract.roleEndingInfluences?.find(
        (entry) => entry?.roleKey === player.key
      );
      for (const action of player.chapterActions) {
        action.evidenceEffectKeys = [];
        action.resourceKeys = [];
        action.stateWriteKeys = influence && action.chapterKey === influence.chapterKey
          ? [influence.stateKey]
          : [];
      }
    }
  }
  outline.chapterBeats = structuredClone(chapterBeats);
  for (const beat of outline.chapterBeats) {
    beat.stateWrites = [];
    beat.resourceDeltas = [];
    if (beat?.onReadFail) {
      beat.onReadFail.stateWrites = [];
      beat.onReadFail.additionalCosts = [];
    }
  }
  if (outline.genreProfile?.mode === "mystery") {
    const availableEvidenceKeys = (Array.isArray(outline.evidenceGraph?.evidence)
      ? outline.evidenceGraph.evidence
      : []).map((entry) => entry?.key).filter(Boolean);
    for (const [index, beat] of outline.chapterBeats.entries()) {
      if (!Array.isArray(beat.evidenceKeys) || !beat.evidenceKeys.length) {
        beat.evidenceKeys = availableEvidenceKeys.length
          ? [availableEvidenceKeys[index % availableEvidenceKeys.length]]
          : [];
      }
    }
  }
  outline.styleContract = {
    ...outline.styleContract,
    chapterExpressions: structuredClone(styleChapterExpressions).map((entry, index) => ({
      ...entry,
      device: (
        generationContract?.styleDeviceSeeds?.[index % Math.max(1, generationContract.styleDeviceSeeds.length)]
        || outline.styleContract?.signatureDevices?.[index % Math.max(1, outline.styleContract.signatureDevices.length)]
        || entry?.device
      )
    }))
  };
  const stateVariables = Array.isArray(outline.endingLogic?.stateVariables)
    ? outline.endingLogic.stateVariables
    : [];
  const routes = Array.isArray(outline.endingLogic?.routes) ? outline.endingLogic.routes : [];
  for (const state of stateVariables) {
    const routeValues = [...new Set(routes.flatMap((route) => (
      Array.isArray(route?.requirements)
        ? route.requirements
          .filter((requirement) => requirement?.targetType === "state" && requirement?.targetKey === state.key)
          .map((requirement) => requirement.value)
        : []
    )))];
    if (!routeValues.length) continue;
    const beat = outline.chapterBeats.find((entry) => entry?.chapterKey === state.setInChapterKey);
    if (!beat) continue;
    const existingOptions = Array.isArray(beat.decision?.options) ? beat.decision.options : [];
    const candidateValues = [...new Set([
      ...routeValues,
      ...existingOptions.map((option) => option?.setsValue),
      ...(Array.isArray(state.allowedValues) ? state.allowedValues : [])
    ].filter((value) => value !== undefined && value !== null))];
    const decisionValues = candidateValues.slice(0, Math.max(2, routeValues.length));
    beat.decision = {
      stateKey: state.key,
      question: cleanText(beat.decision?.question, 800)
        || `本章必须把“${cleanText(state.meaning, 120)}”确定为何种可执行状态？`,
      options: decisionValues.map((value, index) => {
        const existing = existingOptions.find((option) => option?.setsValue === value);
        return existing || {
          key: `option-${state.key.replace(/^state[-_]?/u, "")}-${index + 1}`,
          choice: `将${cleanText(state.meaning, 80) || state.key}确定为“${String(value)}”`,
          setsValue: value,
          immediateConsequence: `立即写入状态“${String(value)}”，后续章节与结局据此开放或关闭对应路线`
        };
      })
    };
  }
  const stateByKey = new Map(stateVariables.map((state) => [state?.key, state]));
  const chapterIndexByKey = new Map(spec.chapterKeys.map((chapterKey, index) => [chapterKey, index]));
  const progressModePlan = {
    mystery: ["evidence", "mixed"],
    emotional: ["relationship", "commitment", "memory", "mixed"],
    political: ["resource", "authority", "alliance", "mixed"],
    variety: ["task", "performance", "audience", "mixed"],
    survival: ["resource", "risk", "mixed"],
    hybrid: ["mixed", "task", "relationship", "authority", "risk"]
  }[outline.genreProfile?.mode] || ["mixed"];
  for (const [index, beat] of outline.chapterBeats.entries()) {
    if (!progressModePlan.includes(beat?.progressMode)) {
      beat.progressMode = progressModePlan[index % progressModePlan.length];
    }
    const availableStates = stateVariables.filter((state) => (
      (chapterIndexByKey.get(state?.setInChapterKey) ?? Number.POSITIVE_INFINITY) <= index
    ));
    const currentState = stateByKey.get(beat?.decision?.stateKey);
    const decisionState = currentState
      && (chapterIndexByKey.get(currentState.setInChapterKey) ?? Number.POSITIVE_INFINITY) <= index
      ? currentState
      : availableStates.at(-1);
    if (decisionState) {
      const allowedValues = Array.isArray(decisionState.allowedValues)
        ? decisionState.allowedValues
        : [];
      const existingOptions = Array.isArray(beat?.decision?.options) ? beat.decision.options : [];
      const values = [...new Set([
        ...existingOptions.map((option) => option?.setsValue).filter((value) => allowedValues.includes(value)),
        ...allowedValues
      ])].slice(0, Math.max(2, Math.min(3, allowedValues.length)));
      beat.decision = {
        stateKey: decisionState.key,
        question: cleanText(beat?.decision?.question, 800)
          || `本章如何确定“${cleanText(decisionState.meaning, 120) || decisionState.key}”的执行结果？`,
        options: values.map((value, optionIndex) => {
          const existing = existingOptions.find((option) => option?.setsValue === value);
          return existing || {
            key: `option-${decisionState.key.replace(/^state[-_]?/u, "")}-${index + 1}-${optionIndex + 1}`,
            choice: `把${cleanText(decisionState.meaning, 80) || decisionState.key}写为“${String(value)}”`,
            setsValue: value,
            immediateConsequence: `本章立即写入“${String(value)}”，后续权限、材料与结局路线按该状态继续执行`
          };
        })
      };
    }
    if (cleanText(beat?.nextState, 1200).length < 8) {
      beat.nextState = decisionState
        ? `本章把“${cleanText(decisionState.meaning, 120) || decisionState.key}”写入可执行结果，后续章节与累计结局据此开放或关闭对应权限。`
        : "本章产生的证据、关系或资源变化将由下一章的结构化条件继续读取，并进入累计结局判定。";
    }
    beat.stateReads = (Array.isArray(beat.stateReads) ? beat.stateReads : [])
      .filter((read) => stateByKey.has(read?.stateKey))
      .map((read) => {
        const state = stateByKey.get(read.stateKey);
        if (state.valueType === "enum") {
          return {
            ...read,
            operator: ["equals", "not_equals"].includes(read.operator) ? read.operator : "equals",
            value: state.allowedValues.includes(read.value) ? read.value : state.initialValue
          };
        }
        return read;
      });
    if (!beat.stateReads.length) beat.entryConditionMode = "none";
  }
  const registeredResources = Array.isArray(outline.resources) ? outline.resources : [];
  if (registeredResources.length) {
    const usageCount = Math.min(3, outline.chapterBeats.length);
    for (const [resourceIndex, resource] of registeredResources.entries()) {
      const usageIndexes = [...new Set([
        0,
        Math.max(1, Math.floor((outline.chapterBeats.length - 1) / 2)),
        Math.max(1, outline.chapterBeats.length - 2)
      ])].slice(0, usageCount);
      for (const usageIndex of usageIndexes) {
        const beat = outline.chapterBeats[usageIndex];
        if (!beat) continue;
        const affectedRoles = Array.isArray(beat.triggerRoleKeys) && beat.triggerRoleKeys.length
          ? beat.triggerRoleKeys.slice(0, 2)
          : [outline.players[(usageIndex + resourceIndex) % Math.max(1, outline.players.length)]?.key].filter(Boolean);
        beat.resourceDeltas.push({
          resourceKey: resource.key,
          operation: "lose",
          amount: 1,
          consequence: `本章执行题材机制后永久消耗1点“${cleanText(resource.meaning, 80) || resource.key}”，减少后续可调用次数`,
          affectsRoleKeys: affectedRoles
        });
      }
    }
  }
  for (const beat of outline.chapterBeats) {
    if (!beat?.onReadFail || !Array.isArray(beat.stateReads) || !beat.stateReads.length) continue;
    const hasFailureEffect = (Array.isArray(beat.onReadFail.additionalCosts) && beat.onReadFail.additionalCosts.length)
      || (Array.isArray(beat.onReadFail.stateWrites) && beat.onReadFail.stateWrites.length)
      || (Array.isArray(beat.onReadFail.locksEvidenceKeys) && beat.onReadFail.locksEvidenceKeys.length)
      || (Array.isArray(beat.onReadFail.unlocksEvidenceKeys) && beat.onReadFail.unlocksEvidenceKeys.length);
    if (hasFailureEffect) continue;
    const evidenceKey = Array.isArray(beat.evidenceKeys) ? beat.evidenceKeys[0] : "";
    if (evidenceKey) {
      beat.onReadFail.locksEvidenceKeys = [evidenceKey];
      beat.onReadFail.unlocksEvidenceKeys = [];
      continue;
    }
    const fallbackState = stateByKey.get(beat?.decision?.stateKey);
    const fallbackValue = fallbackState?.valueType === "enum"
      ? fallbackState.allowedValues?.[0]
      : fallbackState?.initialValue;
    if (fallbackState && fallbackValue !== undefined) {
      beat.onReadFail.stateWrites = [{
        stateKey: fallbackState.key,
        operation: "set",
        value: fallbackValue
      }];
    }
  }
  return outline;
}
