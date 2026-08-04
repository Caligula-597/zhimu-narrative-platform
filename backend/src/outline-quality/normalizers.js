/** Shape normalization and branch simulation for one outline candidate. */

import {
  OUTLINE_VERSION,
  OUTLINE_REVISION,
  OUTLINE_REVISIONS,
  PLACEHOLDER_NAME,
  UNRESOLVED_LOGIC,
  GENERIC_FINGERPRINT,
  GENERIC_ACTION_ONLY,
  GENERIC_EFFECT_ONLY,
  GENERIC_CAUSAL_SEQUENCE,
  GENERIC_ENDING_TITLE,
  GENERIC_TRUST_STATE,
  MECHANIC_USE_SECTIONS,
  GENRE_MODES,
  PROGRESS_MODES,
  GENRE_PROGRESS,
  STATE_OPERATIONS,
  RESOURCE_OPERATIONS,
  ENTITY_TYPES,
  RESPONSIBILITY_TYPES,
  ACTION_COMMITMENT_MODES,
  AUTHORIZATION_STATUSES,
  FACT_TRUTH_VALUES,
  OPTION_EFFECT_TARGET_TYPES,
  OPTION_EFFECT_OPERATIONS,
  RESOURCE_VALUE_TYPES,
  RESOURCE_OWNER_TYPES,
  CONTRIBUTION_ANCHOR_TYPES,
  INTERNAL_CHOICE_LANGUAGE,
  INTERNAL_NARRATIVE_LANGUAGE,
  SOURCE_SHELL_ENTITY,
  GENERIC_DECISION_CAPACITY,
  GENERIC_RESPONSIBILITY_ACTION,
  GENERIC_RESPONSIBILITY_EFFECT,
  GENRE_ANCHOR_TYPES,
  REQUIREMENT_TARGET_TYPES,
  ENTRY_CONDITION_MODES,
  MISDIRECTION_KINDS,
  BATCH_FINGERPRINT_FIELDS
} from "./constants.js";

import {
  inferEntityTypesFromName,
  isSourceTypeCompatible
} from "../story-outline-contract/vocabulary.js";

import {
  list,
  object,
  text,
  unique,
  uniqueScalars,
  duplicateValues,
  requireText,
  number,
  scalarValue,
  hasScalarValue,
  stateValueSignature,
  chapterIndex,
  normalizedAction,
  isGenericAction,
  isGenericEffect,
  requireKnownRefs
} from "./primitives.js";

export function normalizeOption(raw) {
  const value = object(raw);
  const choiceText = text(value.choiceText ?? value.choice, 500);
  const hiddenStateKey = text(value.sets?.stateKey, 80);
  const hiddenValue = scalarValue(value.sets?.value ?? value.setsValue, 120);
  return {
    key: text(value.key, 80),
    choiceText,
    choice: choiceText,
    sets: {
      stateKey: hiddenStateKey,
      value: hiddenValue
    },
    setsValue: hiddenValue,
    effects: list(value.effects).slice(0, 16).map(normalizeOptionEffect),
    immediateConsequence: text(value.immediateConsequence, 800)
  };
}

export function normalizeOptionEffect(raw) {
  const value = object(raw);
  return {
    targetType: text(value.targetType, 20),
    targetKey: text(value.targetKey, 80),
    operation: text(value.operation, 40),
    value: scalarValue(value.value, 160),
    amount: typeof value.amount === "number" && Number.isFinite(value.amount) ? value.amount : null,
    consequence: text(value.consequence, 800)
  };
}

export function normalizeStateWrite(raw) {
  const value = object(raw);
  return {
    stateKey: text(value.stateKey, 80),
    operation: STATE_OPERATIONS.has(value.operation) ? value.operation : text(value.operation, 40),
    value: scalarValue(value.value, 160)
  };
}

export function normalizeStateRead(raw) {
  const value = object(raw);
  return {
    stateKey: text(value.stateKey, 80),
    operator: ["equals", "not_equals", "includes", "gte", "lte"].includes(value.operator) ? value.operator : "equals",
    value: scalarValue(value.value, 160)
  };
}

export function normalizeResourceDelta(raw) {
  const value = object(raw);
  return {
    resourceKey: text(value.resourceKey, 80),
    operation: RESOURCE_OPERATIONS.has(value.operation) ? value.operation : text(value.operation, 40),
    amount: typeof value.amount === "number" && Number.isFinite(value.amount) ? value.amount : null,
    affectsRoleKeys: unique(list(value.affectsRoleKeys).map((item) => text(item, 80))),
    consequence: text(value.consequence, 800)
  };
}

export function normalizeEntity(raw) {
  const value = object(raw);
  return {
    key: text(value.key, 80),
    type: text(value.type, 40),
    name: text(value.name, 160),
    aliases: unique(list(value.aliases).map((item) => text(item, 120))),
    meaning: text(value.meaning, 600)
  };
}

export function expectedEntityTypes(entity) {
  return inferEntityTypesFromName(entity.name);
}

export function sourceTypeCompatible(sourceType, entityType) {
  return isSourceTypeCompatible(sourceType, entityType);
}

export function normalizeResource(raw) {
  const value = object(raw);
  return {
    key: text(value.key, 80),
    name: text(value.name, 160),
    valueType: text(value.valueType, 20),
    initialValue: typeof value.initialValue === "number" && Number.isFinite(value.initialValue) ? value.initialValue : null,
    minimum: typeof value.minimum === "number" && Number.isFinite(value.minimum) ? value.minimum : null,
    maximum: typeof value.maximum === "number" && Number.isFinite(value.maximum) ? value.maximum : null,
    ownerType: text(value.ownerType, 20),
    ownerKey: text(value.ownerKey, 80),
    recoverable: value.recoverable === true,
    meaning: text(value.meaning, 800)
  };
}

export function normalizeResponsibilityRole(raw) {
  const value = object(raw);
  return {
    roleKey: text(value.roleKey, 80),
    responsibilityType: text(value.responsibilityType, 40),
    eventKeys: unique(list(value.eventKeys).map((item) => text(item, 80))),
    action: text(value.action, 1000),
    causalEffect: text(value.causalEffect, 1000)
  };
}

export function normalizeTimelineEvent(raw) {
  const value = object(raw);
  return {
    key: text(value.key, 80),
    order: Number.isInteger(value.order) ? value.order : Number(value.order),
    event: text(value.event, 1200),
    actorKeys: unique(list(value.actorKeys).map((item) => text(item, 80))),
    actionType: text(value.actionType, 80),
    targetKey: text(value.targetKey, 80),
    parameterKey: text(value.parameterKey, 120),
    purposeKey: text(value.purposeKey, 120),
    beforeValue: scalarValue(value.beforeValue, 240),
    afterValue: scalarValue(value.afterValue, 240),
    authorizationGrantKey: text(value.authorizationGrantKey, 80),
    authorizationStatus: text(value.authorizationStatus, 40),
    factKeys: unique(list(value.factKeys).map((item) => text(item, 80))),
    responsibilityTypes: unique(list(value.responsibilityTypes).map((item) => text(item, 40))),
    actorResponsibilities: list(value.actorResponsibilities).slice(0, 16).map((entry) => ({
      actorKey: text(entry?.actorKey, 80),
      responsibilityType: text(entry?.responsibilityType, 40)
    })),
    preconditionKeys: unique(list(value.preconditionKeys).map((item) => text(item, 80))),
    outcomeStateKeys: unique(list(value.outcomeStateKeys).map((item) => text(item, 80)))
  };
}

export function normalizeChapterAction(raw) {
  const value = object(raw);
  return {
    chapterKey: text(value.chapterKey, 80),
    action: text(value.action, 800),
    actionTarget: text(value.actionTarget, 400),
    actionTargetKey: text(value.actionTargetKey, 80),
    method: text(value.method, 500),
    consequence: text(value.consequence, 800),
    commitmentMode: text(value.commitmentMode, 40),
    decisionKey: text(value.decisionKey, 80),
    optionKeys: unique(list(value.optionKeys).map((item) => text(item, 80))),
    eventKeys: unique(list(value.eventKeys).map((item) => text(item, 80))),
    stateWriteKeys: unique(list(value.stateWriteKeys).map((item) => text(item, 80))),
    resourceKeys: unique(list(value.resourceKeys).map((item) => text(item, 80))),
    evidenceEffectKeys: unique(list(value.evidenceEffectKeys).map((item) => text(item, 80))),
    affectsRoleKeys: unique(list(value.affectsRoleKeys).map((item) => text(item, 80))),
    evidenceKeys: unique(list(value.evidenceKeys).map((item) => text(item, 80)))
  };
}

export function normalizePlayer(raw) {
  const value = object(raw);
  return {
    key: text(value.key, 80),
    name: text(value.name, 80),
    identity: text(value.identity, 500),
    publicGoal: text(value.publicGoal, 800),
    hiddenGoal: text(value.hiddenGoal, 800),
    coreSecret: text(value.coreSecret, 1200),
    secretFactKeys: unique(list(value.secretFactKeys).map((item) => text(item, 80))),
    authorizationGrantKeys: unique(list(value.authorizationGrantKeys).map((item) => text(item, 80))),
    exclusiveAnchorKey: text(value.exclusiveAnchorKey, 80),
    activePlan: text(value.activePlan, 1000),
    arc: text(value.arc, 1000),
    spotlightChapterKey: text(value.spotlightChapterKey, 80),
    contribution: {
      anchorType: text(value.contribution?.anchorType, 40),
      anchorKeys: unique(list(value.contribution?.anchorKeys).map((item) => text(item, 80))),
      turnChapterKeys: unique(list(value.contribution?.turnChapterKeys).map((item) => text(item, 80))),
      affectsRoleKeys: unique(list(value.contribution?.affectsRoleKeys).map((item) => text(item, 80)))
    },
    chapterActions: list(value.chapterActions).slice(0, 12).map(normalizeChapterAction)
  };
}

export function normalizeEvidence(raw) {
  const value = object(raw);
  return {
    key: text(value.key, 80),
    label: text(value.label, 160),
    sourceType: text(value.sourceType, 120),
    provenanceGroup: text(value.provenanceGroup, 160),
    originRootKeys: unique(list(value.originRootKeys).map((item) => text(item, 80))),
    storageEntityKey: text(value.storageEntityKey, 80),
    commonCauseKeys: unique(list(value.commonCauseKeys).map((item) => text(item, 80))),
    independenceDomain: text(value.independenceDomain, 120),
    originActorKey: text(value.originActorKey, 80),
    collectionMethod: text(value.collectionMethod, 500),
    methodDomain: text(value.methodDomain, 80),
    methodOperation: text(value.methodOperation, 160),
    artifactProduced: text(value.artifactProduced, 240),
    derivedFromEvidenceKeys: unique(list(value.derivedFromEvidenceKeys).map((item) => text(item, 80))),
    sourceOwnerRoleKey: text(value.sourceOwnerRoleKey, 80),
    availableChapterKey: text(value.availableChapterKey, 80),
    obtainedBy: text(value.obtainedBy, 800),
    supportsConclusionKeys: unique(list(value.supportsConclusionKeys).map((item) => text(item, 80))),
    alsoExplains: text(value.alsoExplains, 800)
  };
}

export function normalizeConclusion(raw) {
  const value = object(raw);
  return {
    key: text(value.key, 80),
    statement: text(value.statement, 1000),
    evidenceKeys: unique(list(value.evidenceKeys).map((item) => text(item, 80)))
  };
}

export function normalizeMisdirection(raw) {
  const value = object(raw);
  return {
    key: text(value.key, 80),
    kind: text(value.kind, 40),
    apparentInterpretation: text(value.apparentInterpretation, 800),
    trueCause: text(value.trueCause, 800),
    mainlineImpact: text(value.mainlineImpact, 800),
    supportKeys: unique(list(value.supportKeys).map((item) => text(item, 80))),
    disproofKeys: unique(list(value.disproofKeys).map((item) => text(item, 80))),
    lastingConsequence: text(value.lastingConsequence, 800)
  };
}

export function normalizeReadPass(raw) {
  const value = object(raw);
  return {
    variantKey: text(value.variantKey, 80),
    effectSummary: text(value.effectSummary, 800)
  };
}

export function normalizeReadFail(raw) {
  const value = object(raw);
  return {
    variantKey: text(value.variantKey, 80),
    fallbackAction: text(value.fallbackAction, 1000),
    additionalCosts: list(value.additionalCosts).slice(0, 12).map(normalizeResourceDelta),
    stateWrites: list(value.stateWrites).slice(0, 12).map(normalizeStateWrite),
    locksEvidenceKeys: unique(list(value.locksEvidenceKeys).map((item) => text(item, 80))),
    unlocksEvidenceKeys: unique(list(value.unlocksEvidenceKeys).map((item) => text(item, 80)))
  };
}

export function normalizeBeat(raw, fallbackKey, index) {
  const value = object(raw);
  const decision = object(value.decision);
  return {
    chapterKey: text(value.chapterKey, 80) || fallbackKey,
    title: text(value.title, 120) || `第 ${index + 1} 章`,
    goal: text(value.goal, 800),
    turn: text(value.turn, 800),
    hostNotes: text(value.hostNotes, 1000),
    triggerRoleKeys: unique(list(value.triggerRoleKeys).map((item) => text(item, 80))),
    playerAction: text(value.playerAction, 1000),
    actionObject: text(value.actionObject, 500),
    actionTargetKey: text(value.actionTargetKey, 80),
    irreversibleConsequence: text(value.irreversibleConsequence, 1000),
    nextState: text(value.nextState, 1000),
    progressMode: text(value.progressMode, 80),
    stateReads: list(value.stateReads).slice(0, 20).map(normalizeStateRead),
    entryConditionMode: text(value.entryConditionMode, 20),
    onReadPass: normalizeReadPass(value.onReadPass),
    onReadFail: normalizeReadFail(value.onReadFail),
    stateWrites: list(value.stateWrites).slice(0, 20).map(normalizeStateWrite),
    unlocksEvidenceKeys: unique(list(value.unlocksEvidenceKeys).map((item) => text(item, 80))),
    locksEvidenceKeys: unique(list(value.locksEvidenceKeys).map((item) => text(item, 80))),
    resourceDeltas: list(value.resourceDeltas).slice(0, 12).map(normalizeResourceDelta),
    evidenceKeys: unique(list(value.evidenceKeys).map((item) => text(item, 80))),
    genreMechanicUse: text(value.genreMechanicUse, 1000),
    sharedSpotlightConflict: text(value.sharedSpotlightConflict, 1000),
    decision: {
      key: text(decision.key, 80),
      stateKey: text(decision.stateKey, 80),
      question: text(decision.question, 800),
      options: list(decision.options).slice(0, 6).map(normalizeOption)
    }
  };
}

export function normalizeRequirement(raw) {
  const value = object(raw);
  return {
    targetType: text(value.targetType, 20),
    targetKey: text(value.targetKey, 80),
    operator: ["equals", "not_equals", "includes", "gte", "lte"].includes(value.operator) ? value.operator : "equals",
    value: scalarValue(value.value, 160)
  };
}

export function normalizeEndingRoute(raw) {
  const value = object(raw);
  return {
    key: text(value.key, 80),
    title: text(value.title, 160),
    priority: number(value.priority, 0),
    isDefault: value.isDefault === true,
    requirementMode: text(value.requirementMode, 20),
    requirements: list(value.requirements).slice(0, 12).map(normalizeRequirement),
    preconditionFactKeys: unique(list(value.preconditionFactKeys).map((item) => text(item, 80))),
    preconditionRuleKeys: unique(list(value.preconditionRuleKeys).map((item) => text(item, 80))),
    consequence: text(value.consequence, 1200)
  };
}

export function requirementSatisfied(value, operator, expected) {
  if (operator === "equals") return stateValueSignature(value) === stateValueSignature(expected);
  if (operator === "not_equals") return stateValueSignature(value) !== stateValueSignature(expected);
  if (operator === "includes") return Array.isArray(value) ? value.includes(expected) : String(value ?? "").includes(String(expected));
  const currentNumber = Number(value);
  const expectedNumber = Number(expected);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(expectedNumber)) return false;
  if (operator === "gte") return currentNumber >= expectedNumber;
  if (operator === "lte") return currentNumber <= expectedNumber;
  return false;
}

export function applyRuntimeEffect(snapshot, effect) {
  const next = structuredClone(snapshot);
  if (effect.targetType === "state") {
    const current = next.states[effect.targetKey];
    if (effect.operation === "set") next.states[effect.targetKey] = effect.value;
    if (effect.operation === "increment") next.states[effect.targetKey] = Number(current || 0) + Number(effect.value || 0);
    if (effect.operation === "decrement") next.states[effect.targetKey] = Number(current || 0) - Number(effect.value || 0);
    if (effect.operation === "add") next.states[effect.targetKey] = [...new Set([...(Array.isArray(current) ? current : []), effect.value])];
    if (effect.operation === "remove") next.states[effect.targetKey] = (Array.isArray(current) ? current : []).filter((value) => value !== effect.value);
  }
  if (effect.targetType === "resource") {
    const current = Number(next.resources[effect.targetKey] || 0);
    if (effect.operation === "gain") next.resources[effect.targetKey] = current + Number(effect.amount || 0);
    if (effect.operation === "lose") next.resources[effect.targetKey] = current - Number(effect.amount || 0);
    if (effect.operation === "set") next.resources[effect.targetKey] = Number(effect.amount || 0);
  }
  if (effect.targetType === "evidence") next.evidence[effect.targetKey] = effect.operation === "unlock" ? "available" : "locked";
  if (effect.targetType === "event" && effect.operation === "trigger") next.events[effect.targetKey] = true;
  return next;
}

export function enumerateBranchSnapshots(outline, chapterKeys, limit = 4096) {
  const factValues = Object.fromEntries(outline.semanticConstitution.facts.map((fact) => [fact.key, fact.truthValue]));
  let snapshots = [{
    states: Object.fromEntries(outline.endingLogic.stateVariables.map((state) => [state.key, state.initialValue])),
    resources: Object.fromEntries(outline.resources.map((resource) => [resource.key, resource.initialValue])),
    evidence: Object.fromEntries(outline.evidenceGraph.evidence.map((evidence) => [evidence.key, "unavailable"])),
    events: {
      ...Object.fromEntries(outline.causalTimeline.map((event) => [event.key, true])),
      ...Object.fromEntries(outline.semanticConstitution.branchEvents.map((event) => [event.key, false]))
    }
  }];
  const applyStateWrite = (snapshot, write) => applyRuntimeEffect(snapshot, {
    targetType: "state",
    targetKey: write.stateKey,
    operation: write.operation,
    value: write.value
  });
  const applyResourceDelta = (snapshot, delta) => applyRuntimeEffect(snapshot, {
    targetType: "resource",
    targetKey: delta.resourceKey,
    operation: delta.operation,
    amount: delta.amount
  });
  const deduplicate = (rows) => {
    const bySignature = new Map();
    for (const row of rows) {
      const signature = JSON.stringify(row);
      if (!bySignature.has(signature)) bySignature.set(signature, row);
      if (bySignature.size >= limit) break;
    }
    return [...bySignature.values()];
  };
  const applyWorldRules = (rawSnapshot, chapterKey) => {
    let snapshot = structuredClone(rawSnapshot);
    for (const rule of outline.semanticConstitution.worldRules.filter((entry) => entry.evaluationChapterKey === chapterKey)) {
      const triggerSatisfied = rule.triggerEventKeys.every((eventKey) => snapshot.events[eventKey] === true);
      const preconditionsSatisfied = rule.preconditions.every((precondition) => {
        const collection = precondition.targetType === "fact"
          ? factValues
          : precondition.targetType === "state"
            ? snapshot.states
            : precondition.targetType === "resource"
              ? snapshot.resources
              : snapshot.evidence;
        return requirementSatisfied(collection?.[precondition.targetKey], precondition.operator, precondition.value);
      });
      if (!triggerSatisfied || !preconditionsSatisfied) continue;
      for (const effect of rule.effects) snapshot = applyRuntimeEffect(snapshot, effect);
      snapshot.events[`world-rule:${rule.key}`] = true;
    }
    return snapshot;
  };
  for (const chapterKey of chapterKeys) {
    const beat = outline.chapterBeats.find((entry) => entry.chapterKey === chapterKey);
    if (!beat) continue;
    const nextSnapshots = [];
    for (const rawSnapshot of snapshots) {
      let snapshot = structuredClone(rawSnapshot);
      for (const evidence of outline.evidenceGraph.evidence.filter((entry) => entry.availableChapterKey === chapterKey)) {
        snapshot.evidence[evidence.key] = "available";
      }
      const readResults = beat.stateReads.map((read) => requirementSatisfied(snapshot.states[read.stateKey], read.operator, read.value));
      const readPassed = !readResults.length || (beat.entryConditionMode === "any" ? readResults.some(Boolean) : readResults.every(Boolean));
      if (!readPassed) {
        for (const write of beat.onReadFail.stateWrites) snapshot = applyStateWrite(snapshot, write);
        for (const delta of beat.onReadFail.additionalCosts) snapshot = applyResourceDelta(snapshot, delta);
        for (const key of beat.onReadFail.locksEvidenceKeys) snapshot.evidence[key] = "locked";
        for (const key of beat.onReadFail.unlocksEvidenceKeys) snapshot.evidence[key] = "available";
      }
      for (const write of beat.stateWrites) snapshot = applyStateWrite(snapshot, write);
      for (const delta of beat.resourceDeltas) snapshot = applyResourceDelta(snapshot, delta);
      for (const key of beat.locksEvidenceKeys) snapshot.evidence[key] = "locked";
      for (const key of beat.unlocksEvidenceKeys) snapshot.evidence[key] = "available";
      if (!beat.decision.options.length) {
        nextSnapshots.push(applyWorldRules(snapshot, chapterKey));
        continue;
      }
      for (const option of beat.decision.options) {
        let optionSnapshot = structuredClone(snapshot);
        const effects = option.effects.length
          ? option.effects
          : (option.sets.stateKey ? [{ targetType: "state", targetKey: option.sets.stateKey, operation: "set", value: option.sets.value }] : []);
        for (const effect of effects) optionSnapshot = applyRuntimeEffect(optionSnapshot, effect);
        nextSnapshots.push(applyWorldRules(optionSnapshot, chapterKey));
      }
    }
    snapshots = deduplicate(nextSnapshots);
  }
  return snapshots;
}

export function normalizeFact(raw) {
  const value = object(raw);
  return {
    key: text(value.key, 80),
    subjectKey: text(value.subjectKey, 80),
    predicate: text(value.predicate, 120),
    objectKey: text(value.objectKey, 80),
    objectValue: scalarValue(value.objectValue, 240),
    scopeKey: text(value.scopeKey, 120),
    truthValue: typeof value.truthValue === "boolean" ? value.truthValue : null,
    validFromEventKey: text(value.validFromEventKey, 80),
    validToEventKey: text(value.validToEventKey, 80),
    evidenceKeys: unique(list(value.evidenceKeys).map((item) => text(item, 80)))
  };
}

export function normalizeAuthorizationGrant(raw) {
  const value = object(raw);
  return {
    key: text(value.key, 80),
    grantorKey: text(value.grantorKey, 80),
    granteeKey: text(value.granteeKey, 80),
    assetKey: text(value.assetKey, 80),
    allowedPurposeKeys: unique(list(value.allowedPurposeKeys).map((item) => text(item, 120))),
    forbiddenPurposeKeys: unique(list(value.forbiddenPurposeKeys).map((item) => text(item, 120))),
    validFromEventKey: text(value.validFromEventKey, 80),
    validToEventKey: text(value.validToEventKey, 80),
    evidenceKeys: unique(list(value.evidenceKeys).map((item) => text(item, 80)))
  };
}

export function normalizeBranchEvent(raw) {
  const value = object(raw);
  return {
    key: text(value.key, 80),
    chapterKey: text(value.chapterKey, 80),
    description: text(value.description, 1000)
  };
}

export function normalizeWorldRule(raw) {
  const value = object(raw);
  return {
    key: text(value.key, 80),
    statement: text(value.statement, 1400),
    evaluationChapterKey: text(value.evaluationChapterKey, 80),
    triggerEventKeys: unique(list(value.triggerEventKeys).map((item) => text(item, 80))),
    authorizedActorKeys: unique(list(value.authorizedActorKeys).map((item) => text(item, 80))),
    preconditions: list(value.preconditions).slice(0, 16).map(normalizeRequirement),
    effects: list(value.effects).slice(0, 16).map(normalizeOptionEffect),
    auditEvidenceKeys: unique(list(value.auditEvidenceKeys).map((item) => text(item, 80))),
    failureMode: text(value.failureMode, 1000)
  };
}
