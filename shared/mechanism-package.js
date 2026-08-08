import {
  isMechanismInteractionKind,
  normalizeMechanismInteraction,
  normalizeMechanismOptionPresentation,
} from "./mechanism-interactions.js";

export const MECHANISM_PACKAGE_SCHEMA_VERSION = 1;

const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const cleanKey = (value) =>
  String(value ?? "")
    .trim()
    .slice(0, 120);
const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

function uniqueByKey(rows, label) {
  const seen = new Set();
  for (const row of rows) {
    const key = cleanKey(row?.key);
    if (!key) throw new TypeError(`${label} contains an entry without a key`);
    if (seen.has(key))
      throw new TypeError(`${label} contains duplicate key ${key}`);
    seen.add(key);
  }
  return seen;
}

function requireReference(known, key, label) {
  const normalized = cleanKey(key);
  if (normalized && !known.has(normalized))
    throw new TypeError(`${label} references unknown key ${normalized}`);
}

function resourceDeltaReferences(rows, resourceKeys, label) {
  for (const row of asArray(rows))
    requireReference(resourceKeys, row?.resourceKey, label);
}

function stateWriteReferences(rows, stateKeys, label) {
  for (const row of asArray(rows))
    requireReference(stateKeys, row?.stateKey, label);
}

function evidenceReferences(rows, evidenceKeys, label) {
  for (const key of asArray(rows)) requireReference(evidenceKeys, key, label);
}

function optionEffects(option, decisionStateKey) {
  const effects = asArray(option?.effects).map(clone);
  const legacyStateKey = cleanKey(option?.sets?.stateKey || decisionStateKey);
  const legacyValue = option?.sets?.value ?? option?.setsValue;
  if (
    legacyStateKey &&
    legacyValue !== undefined &&
    legacyValue !== null &&
    !effects.some(
      (effect) =>
        effect?.targetType === "state" &&
        cleanKey(effect?.targetKey) === legacyStateKey,
    )
  ) {
    effects.push({
      targetType: "state",
      targetKey: legacyStateKey,
      operation: "set",
      value: clone(legacyValue),
      consequence: String(option?.immediateConsequence ?? "").trim(),
    });
  }
  return effects;
}

function compileDecision(beat) {
  const decision = asObject(beat?.decision);
  const key = cleanKey(decision.key || `${beat.chapterKey}-decision`);
  if (!key || !asArray(decision.options).length) return null;
  const requestedInteractionKind = cleanKey(
    decision.interaction?.kind || decision.interactionKind,
  );
  if (
    requestedInteractionKind &&
    !isMechanismInteractionKind(requestedInteractionKind)
  ) {
    throw new TypeError(
      `Decision ${key} has unsupported interaction kind ${requestedInteractionKind}`,
    );
  }
  return {
    key,
    roundKey: cleanKey(beat.chapterKey),
    question: String(decision.question ?? "").trim(),
    stateKey: cleanKey(decision.stateKey),
    interaction: normalizeMechanismInteraction({
      ...asObject(decision.interaction),
      kind: requestedInteractionKind,
    }),
    options: asArray(decision.options).map((option) => ({
      key: cleanKey(option?.key),
      choiceText: String(option?.choiceText ?? option?.choice ?? "").trim(),
      immediateConsequence: String(option?.immediateConsequence ?? "").trim(),
      presentation: normalizeMechanismOptionPresentation(option?.presentation),
      effects: optionEffects(option, decision.stateKey),
    })),
  };
}

function compileRound(beat, index) {
  const chapterKey = cleanKey(beat?.chapterKey || `chapter-${index + 1}`);
  return {
    key: chapterKey,
    sequence: index + 1,
    title: String(beat?.title ?? chapterKey).trim(),
    goal: String(beat?.goal ?? "").trim(),
    turn: String(beat?.turn ?? "").trim(),
    hostNotes: String(beat?.hostNotes ?? "").trim(),
    triggerRoleKeys: asArray(beat?.triggerRoleKeys)
      .map(cleanKey)
      .filter(Boolean),
    playerAction: String(beat?.playerAction ?? "").trim(),
    actionObject: String(beat?.actionObject ?? "").trim(),
    actionTargetKey: cleanKey(beat?.actionTargetKey),
    irreversibleConsequence: String(beat?.irreversibleConsequence ?? "").trim(),
    nextState: String(beat?.nextState ?? "").trim(),
    progressMode: String(beat?.progressMode ?? "").trim(),
    stateReads: clone(asArray(beat?.stateReads)),
    entryConditionMode:
      String(beat?.entryConditionMode ?? "none").trim() || "none",
    onReadPass: clone(asObject(beat?.onReadPass)),
    onReadFail: clone(asObject(beat?.onReadFail)),
    stateWrites: clone(asArray(beat?.stateWrites)),
    resourceDeltas: clone(asArray(beat?.resourceDeltas)),
    // Effects committed when a round without a decision is advanced. This is
    // also the author-facing hook used to publish role-scoped clue grants.
    settlementEffects: clone(asArray(beat?.settlementEffects)),
    unlocksEvidenceKeys: asArray(beat?.unlocksEvidenceKeys)
      .map(cleanKey)
      .filter(Boolean),
    locksEvidenceKeys: asArray(beat?.locksEvidenceKeys)
      .map(cleanKey)
      .filter(Boolean),
    evidenceKeys: asArray(beat?.evidenceKeys).map(cleanKey).filter(Boolean),
    genreMechanicUse: String(beat?.genreMechanicUse ?? "").trim(),
    sharedSpotlightConflict: String(beat?.sharedSpotlightConflict ?? "").trim(),
    decisionKey: cleanKey(
      beat?.decision?.key ||
        (asArray(beat?.decision?.options).length
          ? `${chapterKey}-decision`
          : ""),
    ),
  };
}

function compileActions(players) {
  return asArray(players).flatMap((player) =>
    asArray(player?.chapterActions).map((action, index) => ({
      key: cleanKey(
        action?.key ||
          `${player?.key || "role"}-${action?.chapterKey || index + 1}-action`,
      ),
      roundKey: cleanKey(action?.chapterKey),
      roleKey: cleanKey(player?.key),
      action: String(action?.action ?? "").trim(),
      actionTarget: String(action?.actionTarget ?? "").trim(),
      actionTargetKey: cleanKey(action?.actionTargetKey),
      method: String(action?.method ?? "").trim(),
      consequence: String(action?.consequence ?? "").trim(),
      commitmentMode: String(action?.commitmentMode ?? "").trim(),
      decisionKey: cleanKey(action?.decisionKey),
      optionKeys: asArray(action?.optionKeys).map(cleanKey).filter(Boolean),
      eventKeys: asArray(action?.eventKeys).map(cleanKey).filter(Boolean),
      stateWriteKeys: asArray(action?.stateWriteKeys)
        .map(cleanKey)
        .filter(Boolean),
      resourceKeys: asArray(action?.resourceKeys).map(cleanKey).filter(Boolean),
      evidenceEffectKeys: asArray(action?.evidenceEffectKeys)
        .map(cleanKey)
        .filter(Boolean),
      evidenceKeys: asArray(action?.evidenceKeys).map(cleanKey).filter(Boolean),
      affectsRoleKeys: asArray(action?.affectsRoleKeys)
        .map(cleanKey)
        .filter(Boolean),
    })),
  );
}

function compileInvestigationActions(evidenceRows) {
  return asArray(evidenceRows).map((evidence) => ({
    key: cleanKey(`investigate-${evidence?.key || "evidence"}`),
    roundKey: cleanKey(evidence?.availableChapterKey),
    evidenceKey: cleanKey(evidence?.key),
    sourceOwnerRoleKey: cleanKey(evidence?.sourceOwnerRoleKey),
    action: String(evidence?.obtainedBy ?? "").trim(),
    operation: String(
      evidence?.methodOperation ?? evidence?.collectionMethod ?? "",
    ).trim(),
    input: {
      originRootKeys: asArray(evidence?.originRootKeys)
        .map(cleanKey)
        .filter(Boolean),
      storageEntityKey: cleanKey(evidence?.storageEntityKey),
      methodDomain: String(evidence?.methodDomain ?? "").trim(),
    },
    success: {
      unlocksEvidenceKeys: cleanKey(evidence?.key)
        ? [cleanKey(evidence.key)]
        : [],
      artifactProduced: String(evidence?.artifactProduced ?? "").trim(),
    },
    failure: null,
  }));
}

function compileBranchFragments(outline) {
  const eventFragments = asArray(
    outline?.semanticConstitution?.branchEvents,
  ).map((event) => ({
    key: cleanKey(event?.key),
    roundKey: cleanKey(event?.chapterKey),
    branch: "event",
    description: String(event?.description ?? "").trim(),
    stateWrites: [],
    resourceDeltas: [],
    unlocksEvidenceKeys: [],
    locksEvidenceKeys: [],
  }));
  const readFragments = asArray(outline?.chapterBeats).flatMap((beat) => {
    const result = [];
    const pass = asObject(beat?.onReadPass);
    if (cleanKey(pass.variantKey))
      result.push({
        key: cleanKey(pass.variantKey),
        roundKey: cleanKey(beat?.chapterKey),
        branch: "read_pass",
        description: String(pass.effectSummary ?? "").trim(),
        stateWrites: [],
        resourceDeltas: [],
        unlocksEvidenceKeys: [],
        locksEvidenceKeys: [],
      });
    const fail = asObject(beat?.onReadFail);
    if (cleanKey(fail.variantKey))
      result.push({
        key: cleanKey(fail.variantKey),
        roundKey: cleanKey(beat?.chapterKey),
        branch: "read_fail",
        description: String(fail.fallbackAction ?? "").trim(),
        stateWrites: clone(asArray(fail.stateWrites)),
        resourceDeltas: clone(asArray(fail.additionalCosts)),
        unlocksEvidenceKeys: asArray(fail.unlocksEvidenceKeys)
          .map(cleanKey)
          .filter(Boolean),
        locksEvidenceKeys: asArray(fail.locksEvidenceKeys)
          .map(cleanKey)
          .filter(Boolean),
      });
    return result;
  });
  return [...eventFragments, ...readFragments];
}

function compileRoleDisclosureStates(players) {
  return asArray(players).map((player) => ({
    roleKey: cleanKey(player?.key),
    publicGoal: String(player?.publicGoal ?? "").trim(),
    hiddenGoal: String(player?.hiddenGoal ?? "").trim(),
    coreSecret: String(player?.coreSecret ?? "").trim(),
    secretFactKeys: asArray(player?.secretFactKeys)
      .map(cleanKey)
      .filter(Boolean),
    authorizationGrantKeys: asArray(player?.authorizationGrantKeys)
      .map(cleanKey)
      .filter(Boolean),
    disclosureStateKey: cleanKey(player?.disclosureStateKey),
  }));
}

export function compileMechanismPackage(
  outline,
  { source = "outline_import" } = {},
) {
  const value = asObject(outline);
  const beats = asArray(value.chapterBeats);
  const evidence = asArray(value.evidenceGraph?.evidence);
  const decisions = beats.map(compileDecision).filter(Boolean);
  const packageValue = {
    schemaVersion: MECHANISM_PACKAGE_SCHEMA_VERSION,
    source: String(source || "outline_import"),
    factLedger: clone(asArray(value.semanticConstitution?.facts)),
    entities: clone(asArray(value.entities)),
    authorizationMatrix: clone(
      asArray(value.semanticConstitution?.authorizationGrants),
    ),
    eventLedger: clone(asArray(value.causalTimeline)),
    stateRegistry: clone(asArray(value.endingLogic?.stateVariables)),
    resourceRegistry: clone(asArray(value.resources)),
    rounds: beats.map(compileRound),
    actions: compileActions(value.players),
    investigationActions: compileInvestigationActions(evidence),
    evidenceGraph: {
      evidence: clone(evidence),
      conclusions: clone(asArray(value.evidenceGraph?.conclusions)),
      misdirections: clone(asArray(value.misdirections)),
    },
    decisionNodes: decisions,
    branchFragments: compileBranchFragments(value),
    endingRoutes: clone(asArray(value.endingLogic?.routes)),
    endingResolution: {
      defaultRouteKey: cleanKey(value.endingLogic?.defaultRouteKey),
      conflictResolution: String(
        value.endingLogic?.conflictResolution ?? "",
      ).trim(),
    },
    roleDisclosureStates: compileRoleDisclosureStates(value.players),
    worldRules: clone(asArray(value.semanticConstitution?.worldRules)),
  };
  return assertMechanismPackage(packageValue);
}

export function assertMechanismPackage(packageValue) {
  const value = asObject(packageValue);
  if (value.schemaVersion !== MECHANISM_PACKAGE_SCHEMA_VERSION) {
    throw new TypeError(
      `Unsupported mechanism package schema version ${value.schemaVersion ?? "missing"}`,
    );
  }
  const requiredArrays = [
    "factLedger",
    "entities",
    "authorizationMatrix",
    "eventLedger",
    "stateRegistry",
    "resourceRegistry",
    "rounds",
    "actions",
    "investigationActions",
    "decisionNodes",
    "branchFragments",
    "endingRoutes",
    "roleDisclosureStates",
    "worldRules",
  ];
  for (const field of requiredArrays) {
    if (!Array.isArray(value[field]))
      throw new TypeError(`Mechanism package field ${field} must be an array`);
  }
  if (
    !value.evidenceGraph ||
    !Array.isArray(value.evidenceGraph.evidence) ||
    !Array.isArray(value.evidenceGraph.conclusions)
  ) {
    throw new TypeError("Mechanism package evidenceGraph is invalid");
  }

  const roundKeys = uniqueByKey(value.rounds, "rounds");
  const factKeys = uniqueByKey(value.factLedger, "factLedger");
  uniqueByKey(value.entities, "entities");
  const authorizationKeys = uniqueByKey(
    value.authorizationMatrix,
    "authorizationMatrix",
  );
  uniqueByKey(value.eventLedger, "eventLedger");
  const stateKeys = uniqueByKey(value.stateRegistry, "stateRegistry");
  const resourceKeys = uniqueByKey(value.resourceRegistry, "resourceRegistry");
  const evidenceKeys = uniqueByKey(
    value.evidenceGraph.evidence,
    "evidenceGraph.evidence",
  );
  const conclusionKeys = uniqueByKey(
    value.evidenceGraph.conclusions,
    "evidenceGraph.conclusions",
  );
  uniqueByKey(
    asArray(value.evidenceGraph.misdirections),
    "evidenceGraph.misdirections",
  );
  const decisionKeys = uniqueByKey(value.decisionNodes, "decisionNodes");
  uniqueByKey(value.actions, "actions");
  uniqueByKey(value.investigationActions, "investigationActions");
  uniqueByKey(value.branchFragments, "branchFragments");
  uniqueByKey(value.endingRoutes, "endingRoutes");
  uniqueByKey(value.worldRules, "worldRules");
  const roleKeys = new Set();
  for (const disclosure of value.roleDisclosureStates) {
    const roleKey = cleanKey(disclosure?.roleKey);
    if (!roleKey)
      throw new TypeError(
        "roleDisclosureStates contains an entry without a roleKey",
      );
    if (roleKeys.has(roleKey))
      throw new TypeError(
        `roleDisclosureStates contains duplicate roleKey ${roleKey}`,
      );
    roleKeys.add(roleKey);
    evidenceReferences(
      disclosure?.secretFactKeys,
      factKeys,
      `Role disclosure ${roleKey}`,
    );
    for (const grantKey of asArray(disclosure?.authorizationGrantKeys)) {
      requireReference(
        authorizationKeys,
        grantKey,
        `Role disclosure ${roleKey}`,
      );
    }
  }

  const validateSettlementEffects = (effects, label) => {
    const clueGrantKeys = new Set();
    for (const effect of asArray(effects)) {
      if (effect?.targetType !== "clue") continue;
      const clueKey = cleanKey(effect.targetKey);
      const roleKey = cleanKey(effect.roleKey);
      if (effect.operation !== "grant" || !clueKey || !roleKey) {
        throw new TypeError(
          `${label} clue grants require targetKey, roleKey and operation grant`,
        );
      }
      if (!roleKeys.has(roleKey)) {
        throw new TypeError(`${label} references unknown role ${roleKey}`);
      }
      const grantKey = `${clueKey}:${roleKey}`;
      if (clueGrantKeys.has(grantKey)) {
        throw new TypeError(`${label} contains duplicate clue grant ${grantKey}`);
      }
      clueGrantKeys.add(grantKey);
    }
  };

  for (const state of value.stateRegistry) {
    requireReference(roundKeys, state?.setInChapterKey, `State ${state.key}`);
  }
  if (value.endingResolution?.defaultRouteKey) {
    const endingKeys = new Set(
      value.endingRoutes.map((route) => cleanKey(route.key)),
    );
    requireReference(
      endingKeys,
      value.endingResolution.defaultRouteKey,
      "endingResolution",
    );
  }
  for (const evidence of value.evidenceGraph.evidence) {
    requireReference(
      roundKeys,
      evidence?.availableChapterKey,
      `Evidence ${evidence.key}`,
    );
    for (const derivedKey of asArray(evidence?.derivedFromEvidenceKeys)) {
      requireReference(evidenceKeys, derivedKey, `Evidence ${evidence.key}`);
    }
    for (const conclusionKey of asArray(evidence?.supportsConclusionKeys)) {
      requireReference(
        conclusionKeys,
        conclusionKey,
        `Evidence ${evidence.key}`,
      );
    }
  }
  for (const conclusion of value.evidenceGraph.conclusions) {
    evidenceReferences(
      conclusion?.evidenceKeys,
      evidenceKeys,
      `Conclusion ${conclusion.key}`,
    );
  }

  for (const round of value.rounds) {
    validateSettlementEffects(
      round.settlementEffects,
      `Round ${round.key} settlement`,
    );
    stateWriteReferences(round.stateReads, stateKeys, `Round ${round.key}`);
    stateWriteReferences(round.stateWrites, stateKeys, `Round ${round.key}`);
    stateWriteReferences(
      round.onReadFail?.stateWrites,
      stateKeys,
      `Round ${round.key} fail branch`,
    );
    resourceDeltaReferences(
      round.resourceDeltas,
      resourceKeys,
      `Round ${round.key}`,
    );
    resourceDeltaReferences(
      round.onReadFail?.additionalCosts,
      resourceKeys,
      `Round ${round.key} fail branch`,
    );
    evidenceReferences(round.evidenceKeys, evidenceKeys, `Round ${round.key}`);
    evidenceReferences(
      round.unlocksEvidenceKeys,
      evidenceKeys,
      `Round ${round.key}`,
    );
    evidenceReferences(
      round.locksEvidenceKeys,
      evidenceKeys,
      `Round ${round.key}`,
    );
    requireReference(decisionKeys, round.decisionKey, `Round ${round.key}`);
  }

  for (const action of value.actions) {
    if (action.roundKey && !roundKeys.has(action.roundKey)) {
      throw new TypeError(
        `Action ${action.key} references unknown round ${action.roundKey}`,
      );
    }
    requireReference(decisionKeys, action.decisionKey, `Action ${action.key}`);
    evidenceReferences(
      action.evidenceKeys,
      evidenceKeys,
      `Action ${action.key}`,
    );
    evidenceReferences(
      action.evidenceEffectKeys,
      evidenceKeys,
      `Action ${action.key}`,
    );
    for (const stateKey of asArray(action.stateWriteKeys))
      requireReference(stateKeys, stateKey, `Action ${action.key}`);
    for (const resourceKey of asArray(action.resourceKeys))
      requireReference(resourceKeys, resourceKey, `Action ${action.key}`);
  }
  for (const action of value.investigationActions) {
    if (action.roundKey && !roundKeys.has(action.roundKey)) {
      throw new TypeError(
        `Investigation ${action.key} references unknown round ${action.roundKey}`,
      );
    }
    if (action.evidenceKey && !evidenceKeys.has(action.evidenceKey)) {
      throw new TypeError(
        `Investigation ${action.key} references unknown evidence ${action.evidenceKey}`,
      );
    }
    for (const [outcome, branch] of [
      ["success", action.success],
      ["failure", action.failure],
    ]) {
      if (!branch) continue;
      stateWriteReferences(
        branch.stateWrites,
        stateKeys,
        `Investigation ${action.key} ${outcome}`,
      );
      resourceDeltaReferences(
        branch.resourceDeltas,
        resourceKeys,
        `Investigation ${action.key} ${outcome}`,
      );
      evidenceReferences(
        branch.unlocksEvidenceKeys,
        evidenceKeys,
        `Investigation ${action.key} ${outcome}`,
      );
      evidenceReferences(
        branch.locksEvidenceKeys,
        evidenceKeys,
        `Investigation ${action.key} ${outcome}`,
      );
    }
  }
  for (const decision of value.decisionNodes) {
    if (!roundKeys.has(decision.roundKey))
      throw new TypeError(
        `Decision ${decision.key} references unknown round ${decision.roundKey}`,
      );
    const interaction = normalizeMechanismInteraction(decision.interaction);
    if (
      decision.interaction &&
      interaction.kind !== decision.interaction.kind
    ) {
      throw new TypeError(
        `Decision ${decision.key} has unsupported interaction kind ${decision.interaction?.kind ?? "missing"}`,
      );
    }
    if (interaction.resourceKey)
      requireReference(
        resourceKeys,
        interaction.resourceKey,
        `Decision ${decision.key} interaction`,
      );
    if (!isMechanismInteractionKind(interaction.kind)) {
      throw new TypeError(
        `Decision ${decision.key} has an unknown interaction kind`,
      );
    }
    const optionKeys = new Set();
    for (const option of decision.options) {
      const optionKey = cleanKey(option?.key);
      if (!optionKey || optionKeys.has(optionKey))
        throw new TypeError(
          `Decision ${decision.key} has an invalid or duplicate option key`,
        );
      optionKeys.add(optionKey);
      validateSettlementEffects(
        option.effects,
        `Decision ${decision.key} option ${optionKey}`,
      );
      for (const effect of option.effects) {
        if (
          effect.targetType === "state" &&
          !stateKeys.has(cleanKey(effect.targetKey))
        ) {
          throw new TypeError(
            `Decision ${decision.key} references unknown state ${effect.targetKey}`,
          );
        }
        if (
          effect.targetType === "resource" &&
          !resourceKeys.has(cleanKey(effect.targetKey))
        ) {
          throw new TypeError(
            `Decision ${decision.key} references unknown resource ${effect.targetKey}`,
          );
        }
        if (
          effect.targetType === "evidence" &&
          !evidenceKeys.has(cleanKey(effect.targetKey))
        ) {
          throw new TypeError(
            `Decision ${decision.key} references unknown evidence ${effect.targetKey}`,
          );
        }
      }
    }
    if (
      interaction.kind === "timed_crisis" &&
      (interaction.deadlineSeconds <= 0 || !interaction.defaultOptionKey)
    ) {
      throw new TypeError(
        `Decision ${decision.key} timed crisis requires a positive deadline and a default option`,
      );
    }
    if (
      interaction.defaultOptionKey &&
      !optionKeys.has(interaction.defaultOptionKey)
    ) {
      throw new TypeError(
        `Decision ${decision.key} deadline default references unknown option ${interaction.defaultOptionKey}`,
      );
    }
  }
  for (const fragment of value.branchFragments) {
    requireReference(
      roundKeys,
      fragment.roundKey,
      `Branch fragment ${fragment.key}`,
    );
    stateWriteReferences(
      fragment.stateWrites,
      stateKeys,
      `Branch fragment ${fragment.key}`,
    );
    resourceDeltaReferences(
      fragment.resourceDeltas,
      resourceKeys,
      `Branch fragment ${fragment.key}`,
    );
    evidenceReferences(
      fragment.unlocksEvidenceKeys,
      evidenceKeys,
      `Branch fragment ${fragment.key}`,
    );
    evidenceReferences(
      fragment.locksEvidenceKeys,
      evidenceKeys,
      `Branch fragment ${fragment.key}`,
    );
  }
  for (const route of value.endingRoutes) {
    for (const requirement of asArray(route?.requirements)) {
      if (requirement?.targetType === "state")
        requireReference(
          stateKeys,
          requirement.targetKey,
          `Ending ${route.key}`,
        );
      if (requirement?.targetType === "resource")
        requireReference(
          resourceKeys,
          requirement.targetKey,
          `Ending ${route.key}`,
        );
    }
  }
  return value;
}

export function projectMechanismRound(
  packageValue,
  roundKey,
  { sequence = null } = {},
) {
  const value = assertMechanismPackage(packageValue);
  const requestedKey = cleanKey(roundKey);
  const round =
    value.rounds.find((entry) => entry.key === requestedKey) ||
    (Number.isInteger(sequence)
      ? value.rounds.find((entry) => entry.sequence === sequence)
      : null);
  if (!round) return null;
  const roundDecisions = value.decisionNodes.filter(
    (entry) => entry.roundKey === round.key,
  );
  const decisionEffects = [
    ...asArray(round.settlementEffects),
    ...roundDecisions.flatMap((decision) =>
      decision.options.flatMap((option) => option.effects),
    ),
  ];
  const stateTargets = new Set(
    [
      ...round.stateReads.map((entry) => cleanKey(entry?.stateKey)),
      ...round.stateWrites.map((entry) => cleanKey(entry?.stateKey)),
      ...asArray(round.onReadFail?.stateWrites).map((entry) =>
        cleanKey(entry?.stateKey),
      ),
      ...decisionEffects
        .filter((entry) => entry?.targetType === "state")
        .map((entry) => cleanKey(entry?.targetKey)),
    ].filter(Boolean),
  );
  const resourceTargets = new Set(
    [
      ...round.resourceDeltas.map((entry) => cleanKey(entry?.resourceKey)),
      ...asArray(round.onReadFail?.additionalCosts).map((entry) =>
        cleanKey(entry?.resourceKey),
      ),
      ...decisionEffects
        .filter((entry) => entry?.targetType === "resource")
        .map((entry) => cleanKey(entry?.targetKey)),
    ].filter(Boolean),
  );
  const endingRouteKeys = value.endingRoutes
    .filter((route) =>
      asArray(route?.requirements).some(
        (requirement) =>
          (requirement?.targetType === "state" &&
            stateTargets.has(cleanKey(requirement?.targetKey))) ||
          (requirement?.targetType === "resource" &&
            resourceTargets.has(cleanKey(requirement?.targetKey))),
      ),
    )
    .map((route) => cleanKey(route.key));
  return {
    schemaVersion: MECHANISM_PACKAGE_SCHEMA_VERSION,
    source: value.source,
    roundKey: round.key,
    sequence: round.sequence,
    round: clone(round),
    actions: clone(
      value.actions.filter((entry) => entry.roundKey === round.key),
    ),
    investigationActions: clone(
      value.investigationActions.filter(
        (entry) => entry.roundKey === round.key,
      ),
    ),
    decisionNodes: clone(roundDecisions),
    branchFragments: clone(
      value.branchFragments.filter((entry) => entry.roundKey === round.key),
    ),
    evidence: clone(
      value.evidenceGraph.evidence.filter((entry) =>
        round.evidenceKeys.includes(cleanKey(entry?.key)),
      ),
    ),
    endingRouteKeys,
  };
}
