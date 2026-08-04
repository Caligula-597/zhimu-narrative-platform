import { cleanText } from "../prompts/shared.js";
import { resetOutlineAssemblyBlueprintSlots } from "../story-outline-contract/structure.js";
import { BATCH_FINGERPRINT_FIELDS } from "../story-outline-contract/vocabulary.js";

export function materializeBlueprintGenerationContract(value, contract, spec) {
  value = structuredClone(value);
  // V2.3+ 的门禁用于约束生成过程；任何缺失的创意内容都必须拒绝重生，
  // 不得再由后端补写人物贡献、证据来源、结局条件或玩家可见文案。
  if (["2.3", "2.4"].includes(contract.outlineRevision)) return value;
  const players = Array.isArray(value.players) ? value.players : [];
  for (const [index, player] of players.entries()) {
    if (contract.playerNames?.[index]) player.name = contract.playerNames[index];
    player.key = `role-${index + 1}`;
    if (player.contribution && contract.contributionTypes?.[index]) {
      player.contribution.anchorType = contract.contributionTypes[index];
    }
    if (contract.spotlightChapterKeys?.[index]) {
      player.spotlightChapterKey = contract.spotlightChapterKeys[index];
    }
    const influence = contract.roleEndingInfluences?.[index];
    if (player.contribution && influence?.stateKey) {
      const contributionType = contract.contributionTypes?.[index];
      if (contributionType === "evidence") {
        const evidenceKey = index === players.length - 1 ? "evidence-6" : "evidence-1";
        player.contribution.anchorKeys = [evidenceKey];
      } else if (contributionType === "resource" && contract.resourceKeys?.length) {
        player.contribution.anchorKeys = [contract.resourceKeys[0]];
      } else {
        player.contribution.anchorKeys = [influence.stateKey];
      }
    }
    if (player.contribution) {
      player.contribution.turnChapterKeys = [...new Set([
        ...(Array.isArray(player.contribution.turnChapterKeys) ? player.contribution.turnChapterKeys : []),
        influence?.chapterKey,
        contract.spotlightChapterKeys?.[index]
      ].filter(Boolean))];
    }
  }
  if (value.sourceFidelity && typeof value.sourceFidelity === "object") {
    const premiseElements = Array.isArray(value.sourceFidelity.premiseElements)
      ? value.sourceFidelity.premiseElements
      : [];
    for (const [index, anchor] of (contract.premiseAnchors || []).entries()) {
      if (!premiseElements[index]) continue;
      premiseElements[index].element = anchor;
    }
  }

  const states = Array.isArray(value.endingLogic?.stateVariables)
    ? value.endingLogic.stateVariables
    : [];
  for (const [index, state] of states.entries()) {
    if (contract.stateKeys?.[index]) state.key = contract.stateKeys[index];
    if (contract.stateTypes?.[index]) state.valueType = contract.stateTypes[index];
    if (contract.stateSetChapterKeys?.[index]) state.setInChapterKey = contract.stateSetChapterKeys[index];
  }

  if (value.styleContract && typeof value.styleContract === "object") {
    value.styleContract.signatureDevices = [...new Set([
      ...(contract.styleDeviceSeeds || []),
      ...(Array.isArray(value.styleContract.signatureDevices) ? value.styleContract.signatureDevices : [])
    ])];
  }

  const evidence = Array.isArray(value.evidenceGraph?.evidence) ? value.evidenceGraph.evidence : [];
  const entities = Array.isArray(value.entities) ? value.entities : [];

  if (contract.genreMode === "mystery" && value.evidenceGraph) {
    const conclusions = Array.isArray(value.evidenceGraph.conclusions)
      ? value.evidenceGraph.conclusions
      : [];
    if (conclusions.length) {
      const conclusion = conclusions[0];
      conclusion.key = cleanText(conclusion.key, 80) || "conclusion-1";
      conclusion.evidenceKeys = [...new Set([
        "evidence-1",
        "evidence-2",
        "evidence-6",
        ...(Array.isArray(conclusion.evidenceKeys) ? conclusion.evidenceKeys : [])
      ])].filter((key) => evidence.some((entry) => entry?.key === key));
      value.evidenceGraph.conclusions = [conclusion];
      for (const entry of evidence) {
        if (conclusion.evidenceKeys.includes(entry.key)) {
          entry.supportsConclusionKeys = [...new Set([
            ...(Array.isArray(entry.supportsConclusionKeys) ? entry.supportsConclusionKeys : []),
            conclusion.key
          ])];
        }
      }
    }
    const hooks = Array.isArray(value.hookPromises) ? value.hookPromises.slice(0, 2) : [];
    const requiredHookEvidence = [
      ["evidence-1", "evidence-3"],
      ["evidence-2", "evidence-4", "evidence-6"]
    ];
    for (const [index, hook] of hooks.entries()) {
      hook.supportKeys = [...new Set([
        ...(requiredHookEvidence[index] || []),
        ...(Array.isArray(hook.supportKeys) ? hook.supportKeys : [])
      ])];
    }
    value.hookPromises = hooks;
  } else if (value.evidenceGraph && typeof value.evidenceGraph === "object") {
    value.evidenceGraph.conclusions = [];
  }
  const validConclusionKeys = new Set(
    (Array.isArray(value.evidenceGraph?.conclusions) ? value.evidenceGraph.conclusions : [])
      .map((conclusion) => cleanText(conclusion?.key, 80))
      .filter(Boolean)
  );
  for (const entry of evidence) {
    entry.supportsConclusionKeys = (Array.isArray(entry?.supportsConclusionKeys)
      ? entry.supportsConclusionKeys
      : []).filter((key) => validConclusionKeys.has(cleanText(key, 80)));
  }
  const stableHookSupportKeys = new Set([
    ...evidence.map((entry) => cleanText(entry?.key, 80)),
    ...states.map((state) => cleanText(state?.key, 80)),
    ...(Array.isArray(value.resources) ? value.resources : []).map((resource) => cleanText(resource?.key, 80)),
    ...entities.map((entity) => cleanText(entity?.key, 80))
  ].filter(Boolean));
  const fallbackHookSupportKeys = [
    ...(contract.stateKeys || []),
    ...(contract.resourceKeys || []),
    ...evidence.map((entry) => cleanText(entry?.key, 80)),
    ...entities.map((entity) => cleanText(entity?.key, 80))
  ].filter((key) => stableHookSupportKeys.has(key));
  for (const hook of (Array.isArray(value.hookPromises) ? value.hookPromises : [])) {
    hook.supportKeys = [...new Set([
      ...(Array.isArray(hook?.supportKeys) ? hook.supportKeys : [])
        .map((key) => cleanText(key, 80))
        .filter((key) => stableHookSupportKeys.has(key)),
      ...fallbackHookSupportKeys
    ])].slice(0, Math.max(2, Math.min(5, fallbackHookSupportKeys.length)));
  }
  for (const [index, premiseElement] of (Array.isArray(value.sourceFidelity?.premiseElements)
    ? value.sourceFidelity.premiseElements
    : []).entries()) {
    premiseElement.chapterKeys = (Array.isArray(premiseElement?.chapterKeys)
      ? premiseElement.chapterKeys
      : []).filter((chapterKey) => spec.chapterKeys.includes(chapterKey));
    if (!premiseElement.chapterKeys.length && spec.chapterKeys.length) {
      premiseElement.chapterKeys = [spec.chapterKeys[index % spec.chapterKeys.length]];
    }
    premiseElement.supportKeys = [...new Set([
      ...(Array.isArray(premiseElement?.supportKeys) ? premiseElement.supportKeys : [])
        .map((key) => cleanText(key, 80))
        .filter((key) => stableHookSupportKeys.has(key)),
      ...fallbackHookSupportKeys
    ])].slice(0, 2);
  }
  const misdirections = Array.isArray(value.misdirections) ? value.misdirections : [];
  const mysteryEvidenceKeys = evidence.map((entry) => cleanText(entry?.key, 80)).filter(Boolean);
  for (const [index, misdirection] of misdirections.entries()) {
    const candidates = contract.genreMode === "mystery"
      ? mysteryEvidenceKeys
      : fallbackHookSupportKeys;
    if (!candidates.length) continue;
    const supportKey = candidates[(index * 2) % candidates.length];
    const disproofKey = candidates[(index * 2 + 1) % candidates.length] || supportKey;
    misdirection.supportKeys = [supportKey];
    misdirection.disproofKeys = [disproofKey];
  }

  const routes = Array.isArray(value.endingLogic?.routes) ? value.endingLogic.routes : [];
  for (const [index, token] of (contract.endingTitleTokens || []).entries()) {
    if (!routes[index] || cleanText(routes[index].title, 160).includes(token)) continue;
    routes[index].title = `${token}·${cleanText(routes[index].title, 120) || "结局路线"}`;
  }
  const statesByKey = new Map(states.map((state) => [cleanText(state?.key, 80), state]));
  const stateKeys = contract.stateKeys || [];
  const midpoint = Math.max(1, Math.floor((spec.chapterKeys.length - 1) / 2));
  const stateChapterIndex = (stateKey) => spec.chapterKeys.indexOf(
    cleanText(statesByKey.get(stateKey)?.setInChapterKey, 80)
  );
  const earlyStateKeys = stateKeys.filter((stateKey) => {
    const chapterIndex = stateChapterIndex(stateKey);
    return chapterIndex >= 0 && chapterIndex < midpoint;
  });
  const lateBeforeFinalStateKeys = stateKeys.filter((stateKey) => {
    const chapterIndex = stateChapterIndex(stateKey);
    return chapterIndex >= midpoint && chapterIndex < spec.chapterKeys.length - 1;
  });
  for (let index = 0; index < Math.min(3, routes.length); index += 1) {
    const route = routes[index];
    if (!route || route.isDefault === true || stateKeys.length < 3) continue;
    const earlyStateKey = earlyStateKeys[index % Math.max(1, earlyStateKeys.length)] || stateKeys[0];
    const lateStateKey = lateBeforeFinalStateKeys[
      index % Math.max(1, lateBeforeFinalStateKeys.length)
    ] || stateKeys[Math.min(1, stateKeys.length - 1)];
    const earlyState = statesByKey.get(earlyStateKey);
    const lateState = statesByKey.get(lateStateKey);
    const pickEnumValue = (state, offset) => {
      const allowed = Array.isArray(state?.allowedValues) ? state.allowedValues : [];
      const nonInitial = allowed.filter((value) => value !== state?.initialValue);
      return nonInitial.length ? nonInitial[offset % nonInitial.length] : allowed[offset % Math.max(1, allowed.length)];
    };
    const earlyValue = index === 2 && earlyState?.initialValue !== undefined
      ? earlyState.initialValue
      : pickEnumValue(earlyState, index);
    const lateValue = pickEnumValue(lateState, index);
    route.requirements = [
      { targetType: "state", targetKey: earlyStateKey, operator: "equals", value: earlyValue },
      {
        targetType: "state",
        targetKey: lateStateKey,
        operator: "equals",
        value: lateValue
      }
    ];
    if (contract.resourceKeys?.length && index === 0) {
      const resource = (Array.isArray(value.resources) ? value.resources : [])
        .find((entry) => entry?.key === contract.resourceKeys[0]);
      route.requirements.push({
        targetType: "resource",
        targetKey: contract.resourceKeys[0],
        operator: "gte",
        value: typeof resource?.initialValue === "number" ? resource.initialValue : 0
      });
    }
  }
  for (const [stateIndex, stateKey] of stateKeys.entries()) {
    if (routes.slice(0, 3).some((route) => (
      Array.isArray(route?.requirements)
      && route.requirements.some((requirement) => (
        requirement?.targetType === "state" && requirement?.targetKey === stateKey
      ))
    ))) continue;
    const route = routes[stateIndex % Math.min(3, routes.length)];
    const state = statesByKey.get(stateKey);
    if (!route || route.isDefault === true || !state) continue;
    route.requirements.push({
      targetType: "state",
      targetKey: stateKey,
      operator: "equals",
      value: Array.isArray(state.allowedValues)
        ? (state.allowedValues.find((entry) => entry !== state.initialValue) ?? state.initialValue)
        : state.initialValue
    });
  }

  if (value.batchFingerprint && typeof value.batchFingerprint === "object") {
    for (const field of BATCH_FINGERPRINT_FIELDS) {
      if (contract[field]) value.batchFingerprint[field] = contract[field];
    }
  }
  return resetOutlineAssemblyBlueprintSlots(value);
}
