import { cleanText } from "../../../prompts/shared.js";
import { MISDIRECTION_KINDS } from "../../../story-outline-contract/vocabulary.js";

export function validateBlueprintGenreStateResource(context) {
  const {
    brief,
    contract,
    entities,
    expectedRevision,
    isV23,
    isV23Plus,
    isV24,
    issues,
    normalizedName,
    players,
    routes,
    spec,
    states,
    value
  } = context;

  if (contract.genreMode && value.genreProfile?.mode !== contract.genreMode) {
    issues.push(`蓝图 genreProfile.mode 必须为 ${contract.genreMode}`);
  }
  if (cleanText(value.genreMechanic?.name, 160).length < 2) {
    issues.push("蓝图 genreMechanic.name 缺失或过短");
  }
  for (const [field, minimumLength] of Object.entries({
    playerFacingRule: 12,
    playerOperation: 12,
    trigger: 12,
    resolutionProcedure: 20,
    successEffect: 12,
    failureEffect: 12,
    limits: 12,
    payoff: 12
  })) {
    if (cleanText(value.genreMechanic?.[field], 1200).length < minimumLength) {
      issues.push(`蓝图 genreMechanic.${field} 缺失或过短`);
    }
  }
  if (!Array.isArray(value.styleContract?.signatureDevices) || value.styleContract.signatureDevices.length < 3) {
    issues.push("蓝图 styleContract.signatureDevices 至少需要3项");
  }

  const stateKeys = states.map((state) => cleanText(state?.key, 80));
  if (contract.stateKeys?.length) {
    const expected = [...contract.stateKeys].sort();
    const actual = [...stateKeys].sort();
    if (isV24 && !contract.stateKeysAreExhaustive) {
      const missing = expected.filter((key) => !actual.includes(key));
      if (missing.length) issues.push(`蓝图缺少生成前合同要求的状态：${missing.join("、")}`);
    } else if (JSON.stringify(expected) !== JSON.stringify(actual)) issues.push("蓝图状态 key 必须与生成前合同完全一致");
  }
  for (const [index, state] of states.entries()) {
    const contractStateIndex = (contract.stateKeys || []).indexOf(cleanText(state?.key, 80));
    if (contractStateIndex >= 0 && contract.stateTypes?.[contractStateIndex] && state?.valueType !== contract.stateTypes[contractStateIndex]) {
      issues.push(`蓝图 stateVariables[${index}].valueType 必须为 ${contract.stateTypes[contractStateIndex]}`);
    }
    if (contractStateIndex >= 0 && contract.stateSetChapterKeys?.[contractStateIndex] && state?.setInChapterKey !== contract.stateSetChapterKeys[contractStateIndex]) {
      issues.push(`蓝图 stateVariables[${index}].setInChapterKey 必须为 ${contract.stateSetChapterKeys[contractStateIndex]}`);
    }
    if (contractStateIndex >= 0 && contract.stateControlModes?.[contractStateIndex]
      && state?.controlMode !== contract.stateControlModes[contractStateIndex]) {
      issues.push(`蓝图 stateVariables[${index}].controlMode 必须为 ${contract.stateControlModes[contractStateIndex]}`);
    }
    if (!["enum", "number", "boolean", "set"].includes(state?.valueType)) issues.push(`蓝图 stateVariables[${index}].valueType 无效`);
    if (state?.valueType === "number" && typeof state.initialValue !== "number") issues.push(`蓝图数值状态 ${state?.key} 必须使用 JSON 数字`);
    if (state?.valueType === "boolean" && typeof state.initialValue !== "boolean") issues.push(`蓝图布尔状态 ${state?.key} 必须使用 true/false`);
    if (state?.valueType === "enum" && (!Array.isArray(state.allowedValues) || state.allowedValues.length < 2 || !state.allowedValues.includes(state.initialValue))) {
      issues.push(`蓝图枚举状态 ${state?.key} 的 initialValue/allowedValues 不一致`);
    }
    if (isV23Plus && state?.valueType === "enum") {
      const semantics = Array.isArray(state?.valueSemantics) ? state.valueSemantics : [];
      const semanticValues = semantics.map((entry) => entry?.value);
      if (semantics.length !== state.allowedValues.length || state.allowedValues.some((allowedValue) => !semanticValues.includes(allowedValue))) {
        issues.push(`蓝图枚举状态 ${state?.key}.valueSemantics 必须逐一覆盖 allowedValues`);
      }
      for (const [semanticIndex, semantic] of semantics.entries()) {
        if (cleanText(semantic?.worldMeaning, 1000).length < 8) issues.push(`蓝图状态 ${state?.key}.valueSemantics[${semanticIndex}].worldMeaning 必须用至少8字写明对象与世界内事实`);
        if (!Array.isArray(semantic?.incompatibleClaims) || !semantic.incompatibleClaims.length) issues.push(`蓝图状态 ${state?.key}.valueSemantics[${semanticIndex}].incompatibleClaims 至少一项`);
      }
    }
    if (isV24) {
      if (cleanText(state?.subjectKey, 80).length < 2) issues.push(`蓝图 stateVariables[${index}].subjectKey 缺失`);
      if (cleanText(state?.dimension, 120).length < 3) issues.push(`蓝图 stateVariables[${index}].dimension 缺失`);
      if (!["observed", "adjudicated", "player-decision", "derived"].includes(state?.controlMode)) issues.push(`蓝图 stateVariables[${index}].controlMode 无效`);
      if (state?.controlMode === "derived" && cleanText(state?.derivedByRuleKey, 80).length < 2) issues.push(`蓝图派生状态 ${state?.key} 必须声明 derivedByRuleKey`);
      const hasDirectPlayerInfluence = (contract.roleEndingInfluences || []).some((entry) => (
        cleanText(entry?.stateKey, 80) === cleanText(state?.key, 80)
        && cleanText(entry?.influenceMode, 40) === "direct"
      ));
      if (hasDirectPlayerInfluence && ["observed", "derived"].includes(state?.controlMode)) {
        issues.push(`蓝图状态 ${state?.key} 已分配给玩家直接影响，controlMode 不能是 ${state?.controlMode}`);
      }
      const fixedValue = contract.fixedStateValues?.[contractStateIndex];
      if (state?.controlMode === "observed" && fixedValue
        && !Array.isArray(state?.allowedValues)) {
        issues.push(`蓝图客观状态 ${state?.key} 必须声明 allowedValues`);
      } else if (state?.controlMode === "observed" && fixedValue
        && !state.allowedValues.includes(fixedValue)) {
        issues.push(`蓝图客观状态 ${state?.key}.allowedValues 必须包含合同真值 ${fixedValue}`);
      }
    }
  }
  if (isV24) {
    const decisionStateCountByChapter = new Map();
    for (const state of states.filter((entry) => ["adjudicated", "player-decision"].includes(entry?.controlMode))) {
      const chapterKey = cleanText(state?.setInChapterKey, 80);
      decisionStateCountByChapter.set(chapterKey, (decisionStateCountByChapter.get(chapterKey) || 0) + 1);
    }
    for (const [chapterKey, count] of decisionStateCountByChapter.entries()) {
      if (count > 1) issues.push(`蓝图 ${chapterKey} 同时安排 ${count} 个玩家裁决状态，但每章只有一个公共 decision`);
    }
  }
  const misdirections = Array.isArray(value.misdirections) ? value.misdirections : [];
  const allowedMisdirectionKinds = MISDIRECTION_KINDS[contract.genreMode || value.genreProfile?.mode]
    || MISDIRECTION_KINDS.hybrid;
  const minimumMisdirections = (contract.genreMode || value.genreProfile?.mode) === "mystery" ? 2 : 1;
  if (misdirections.length < minimumMisdirections) {
    issues.push(`蓝图 ${contract.genreMode || value.genreProfile?.mode} 至少需要 ${minimumMisdirections} 条题材适配 misdirections`);
  }
  for (const [index, misdirection] of misdirections.entries()) {
    if (!allowedMisdirectionKinds.has(cleanText(misdirection?.kind, 60))) {
      issues.push(`蓝图 misdirections[${index}].kind=${cleanText(misdirection?.kind, 60)} 与题材不匹配`);
    }
    for (const field of ["apparentInterpretation", "trueCause", "mainlineImpact", "lastingConsequence"]) {
      if (cleanText(misdirection?.[field], 1200).length < 8) {
        issues.push(`蓝图 misdirections[${index}].${field} 缺失或过短`);
      }
    }
  }
  const resourceKeys = (Array.isArray(value.resources) ? value.resources : [])
    .map((resource) => cleanText(resource?.key, 80));
  if (contract.resourceKeys) {
    const expected = [...contract.resourceKeys].sort();
    const actual = [...resourceKeys].sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      issues.push("蓝图资源 key 必须与生成前合同完全一致；合同为空时不得创建装饰性资源");
    }
  }
  if (isV23Plus) {
    for (const expectedResource of contract.resourceContracts || []) {
      const actualResource = (Array.isArray(value.resources) ? value.resources : [])
        .find((resource) => cleanText(resource?.key, 80) === expectedResource.key);
      if (!actualResource) continue;
      for (const field of ["name", "meaning", "initialValue", "minimum", "maximum", "ownerType", "ownerKey", "recoverable"]) {
        if (actualResource[field] !== expectedResource[field]) issues.push(`蓝图资源 ${expectedResource.key}.${field} 必须遵守题材资源合同`);
      }
    }
  }

  context.registries.stateKeys = stateKeys;
  context.registries.resourceKeys = resourceKeys;
}
