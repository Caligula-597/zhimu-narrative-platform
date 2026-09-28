/**
 * Player-facing state contract V1.
 *
 * This module is deliberately deterministic: it resolves what a writer may
 * see from state, audience and reveal timing, and audits claims after render.
 * It does not infer Canon and it never repairs a contradiction.
 */

export const ACTION_OWNERSHIP = Object.freeze([
  "SYSTEM_FIXED",
  "PLAYER_CONTROLLED",
  "STATE_DERIVED",
  "CONDITIONAL",
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value ?? "").trim();
}

function clone(value) {
  return structuredClone(value);
}

function isHardRevealAssertion(source, pattern) {
  const index = source.indexOf(pattern);
  if (index < 0) return false;
  const prefix = source.slice(Math.max(0, index - 12), index);
  return !/(?:可能|也许|或许|怀疑|猜测|猜想|不能证明|无法证明|不知道|不确定|未必|没有证据|没法确定)\s*$/.test(prefix);
}

export function normalizeActionOwnership(value = {}) {
  const src = record(value);
  const ownership = ACTION_OWNERSHIP.includes(src.ownership) ? src.ownership : null;
  return {
    actionId: text(src.actionId || src.id),
    ownership,
    phaseId: text(src.phaseId) || null,
    actorRoleId: text(src.actorRoleId) || null,
    sourceRef: text(src.sourceRef) || null,
  };
}

export function normalizeRevealSchedule(value = {}) {
  const src = record(value);
  return {
    version: Math.max(1, Math.trunc(Number(src.version) || 1)),
    entries: array(src.entries).map((entry) => {
      const row = record(entry);
      return {
        factId: text(row.factId || row.id),
        audience: text(row.audience || "PUBLIC"),
        fromPhase: text(row.fromPhase || "OPENING"),
        condition: row.condition ? clone(row.condition) : null,
        publicPatterns: array(row.publicPatterns).map(text).filter(Boolean),
      };
    }).filter((entry) => entry.factId),
  };
}

function phaseRank(phaseId) {
  const match = String(phaseId || "").match(/(?:act|phase|stage)[-_]?(\d+)/i)
    || String(phaseId || "").match(/(?:act|phase|stage)[-_]?[^0-9]{0,12}(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function conditionSatisfied(condition, state = {}) {
  const row = record(condition);
  if (!Object.keys(row).length) return true;
  if (row.flag && record(state.flags)[row.flag] !== (row.equals ?? true)) return false;
  if (row.statePath) {
    const value = String(row.statePath).split(".").reduce((current, key) => record(current)[key], state);
    if (row.equals !== undefined && value !== row.equals) return false;
  }
  return true;
}

export function isRevealAllowed(entry, { audience, phaseId, state = {} } = {}) {
  const row = record(entry);
  if (row.audience !== "PUBLIC" && row.audience !== audience) return false;
  if (phaseRank(phaseId) < phaseRank(row.fromPhase)) return false;
  return conditionSatisfied(row.condition, state);
}

export function buildStageResolvedState({ playerState = {}, phaseId = "", audience = "HOST", revealSchedule = null } = {}) {
  const state = clone(record(playerState));
  const schedule = normalizeRevealSchedule(revealSchedule || {});
  const knowledge = record(state.knowledge);
  const allOwnership = record(state.resourceOwnership);
  const scopedOwnership = audience === "HOST"
    ? allOwnership
    : Object.fromEntries(Object.entries(allOwnership).map(([resourceId, owner]) => [
        resourceId,
        owner === audience ? owner : "UNKNOWN",
      ]));
  const visibleFacts = schedule.entries
    .filter((entry) => isRevealAllowed(entry, { audience, phaseId, state }))
    .map((entry) => entry.factId);
  const revealableSet = new Set(visibleFacts);
  return {
    phaseId: text(phaseId),
    audience,
    resourceOwnership: { ...scopedOwnership },
    ownedResources: audience && audience !== "HOST"
      ? Object.entries(record(state.resourceOwnership)).filter(([, owner]) => owner === audience).map(([id]) => id)
      : [],
    knownFacts: audience === "HOST" ? [...new Set(Object.values(knowledge).flatMap(array))] : [...array(knowledge[audience])],
    publicSignals: [...array(state.publicSignals)],
    revealableFacts: [...new Set(visibleFacts)],
    forbiddenRevealFacts: audience === "HOST"
      ? []
      : [...new Set(schedule.entries.map((entry) => entry.factId).filter((factId) => !revealableSet.has(factId)))],
    canonicalTruth: audience === "HOST" ? [...array(state.canonicalTruth)] : [],
    recoverableTruth: audience === "HOST" ? [...array(state.recoverableTruth)] : [],
    flags: { ...record(state.flags) },
    actionLog: [...array(state.actionLog)],
  };
}

export function buildStageResolvedRolePacket({ packet = {}, playerState = {}, phaseId = "", roleId, revealSchedule = null, actionOwnership = [] } = {}) {
  const resolved = buildStageResolvedState({
    playerState,
    phaseId,
    audience: roleId,
    revealSchedule,
  });
  const ownership = array(actionOwnership).map(normalizeActionOwnership);
  return {
    ...clone(packet),
    phaseId,
    stateSnapshotRef: `state:${phaseId}:${roleId}`,
    stageResolvedState: resolved,
    ownedResources: resolved.ownedResources,
    knownFacts: resolved.knownFacts,
    revealableFacts: resolved.revealableFacts,
    systemFixedEventsSinceLastPhase: ownership.filter((item) => item.ownership === "SYSTEM_FIXED" && (!item.phaseId || item.phaseId === phaseId)),
    playerControlledActions: ownership.filter((item) => item.ownership === "PLAYER_CONTROLLED" && (!item.phaseId || item.phaseId === phaseId)).map((item) => ({
      actionId: item.actionId,
      status: "CONTEXT_ONLY",
      mustNotNarrateAsOccurred: true,
    })),
    forbiddenFutureFacts: ownership.filter((item) => item.ownership === "CONDITIONAL" && (!item.phaseId || phaseRank(item.phaseId) > phaseRank(phaseId))),
  };
}

export function validateRoleNarrativeSource(source = {}) {
  const row = record(source);
  const counts = {
    preGameHistoryEvents: array(row.preGameHistoryEvents).length,
    relationshipEdges: array(row.relationshipEdges).length,
    privateSecrets: array(row.privateSecrets).length,
    biasOrMisbelief: array(row.biasOrMisbelief).length,
    personalStake: array(row.personalStake).length,
    whyHere: text(row.whyHere) ? 1 : 0,
    openingKnowledge: array(row.openingKnowledge).length,
  };
  const issues = [];
  if (counts.preGameHistoryEvents < 3) issues.push({ code: "ROLE_NARRATIVE_HISTORY_THIN", count: counts.preGameHistoryEvents });
  if (counts.relationshipEdges < 3) issues.push({ code: "ROLE_NARRATIVE_RELATIONSHIPS_THIN", count: counts.relationshipEdges });
  if (counts.privateSecrets < 2) issues.push({ code: "ROLE_NARRATIVE_SECRETS_THIN", count: counts.privateSecrets });
  if (!counts.biasOrMisbelief) issues.push({ code: "ROLE_NARRATIVE_BIAS_MISSING" });
  if (!counts.personalStake) issues.push({ code: "ROLE_NARRATIVE_STAKE_MISSING" });
  if (!counts.whyHere) issues.push({ code: "ROLE_NARRATIVE_WHY_HERE_MISSING" });
  if (!counts.openingKnowledge) issues.push({ code: "ROLE_NARRATIVE_OPENING_KNOWLEDGE_MISSING" });
  return { ok: issues.length === 0, counts, issues };
}

export function auditStructuredClaims({ result = {}, roleId = null, playerState = {}, actionOwnership = [], revealSchedule = null } = {}) {
  const issues = [];
  const ownership = new Map(array(actionOwnership).map((item) => {
    const row = normalizeActionOwnership(item);
    return [row.actionId, row.ownership];
  }));
  const state = record(playerState);
  for (const section of array(result?.sections)) {
    for (const claim of array(section?.claims)) {
      const row = record(claim);
      if (row.type === "RESOURCE_OWNERSHIP" && row.resourceId) {
        const expectedOwner = record(state.resourceOwnership)[row.resourceId] ?? null;
        if (String(row.ownerRoleId || "") !== String(expectedOwner || "")) {
          issues.push({
            code: "STATE_FACT_CONTRADICTION",
            roleId,
            stageId: section.stageId || null,
            resourceId: row.resourceId,
            expectedOwner,
            claimedOwner: row.ownerRoleId || null,
          });
        }
      }
      if (row.type === "PLAYER_ACTION" && (row.occurred === true || row.status === "OCCURRED") && ownership.get(row.actionId) === "PLAYER_CONTROLLED") {
        issues.push({ code: "PLAYER_CONTROLLED_ACTION_PREEMPTED", roleId, stageId: section.stageId || null, actionId: row.actionId });
      }
      if (row.type === "REVEAL" && row.factId) {
        const entries = normalizeRevealSchedule(revealSchedule || {}).entries.filter((candidate) => candidate.factId === row.factId);
        if (entries.length && !entries.some((entry) => isRevealAllowed(entry, { audience: roleId, phaseId: section.stageId, state }))) {
          issues.push({ code: "REVEAL_TIMING_VIOLATION", roleId, stageId: section.stageId || null, factId: row.factId });
        }
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

export function auditPlayerFacingText({ text: value, roleId = null, stageId = null, playerState = null, revealSchedule = null, entityMap = {} } = {}) {
  const source = text(value);
  const issues = [];
  const entities = record(entityMap);
  const internalIds = Object.keys(entities).filter(Boolean);
  const idHits = internalIds.filter((id) => new RegExp(`(?:^|[\\s，,：:（(])${id}(?=$|[\\s，,。！？：:）)]|随后|几乎同时|落到|核验|留下|的|在|是)`).test(source));
  if (idHits.length) issues.push({ code: "INTERNAL_ROLE_ID_LEAK", roleId, stageId, ids: idHits });
  const systemTerms = ["RealScriptWriter", "roleId", "Packet", "PMD", "Kernel", "formationContext", "正式 packet", "sourceRef", "Beat ID"];
  const systemHits = systemTerms.filter((term) => source.includes(term));
  if (systemHits.length) issues.push({ code: "INTERNAL_SYSTEM_TERM_LEAK", roleId, stageId, terms: systemHits });
  const actionPatterns = [
    /你(?:没有立刻答应|没有立刻拒绝|选择了|把[^。！？\n]{0,30}(?:按|放|推|递|拿)在|保持沉默|让沉默看起来)/g,
    /你(?:没有|没|未)(?:先|立即)?(?:动|开口|抬手|举牌|出价|跟价|使用|交换|公开|承认|选择|决定|行动)/g,
    /你(?:举牌|抬价|加价|跟价|买下|拍下|拿下|拿到|获得|拥有|持有|使用|核验|验证|交换|交出|递给|公开|承认|保护|封锁|复原|选择|决定)(?!过|过了)/g,
  ];
  const actionHits = actionPatterns.flatMap((pattern) => source.match(pattern) || []);
  if (actionHits.length) issues.push({ code: "PLAYER_CONTROLLED_ACTION_PREEMPTED", roleId, stageId, hits: actionHits.slice(0, 20) });
  const globalTruthHits = source.match(/(?:历史上真正发生过的事|可恢复真相|只能决定哪些[^。！？\n]{0,30}被证明|不能改写历史)/g) || [];
  if (roleId && globalTruthHits.length) issues.push({ code: "HOST_TRUTH_LANGUAGE_IN_ROLE", roleId, stageId, hits: globalTruthHits.slice(0, 20) });
  if (playerState) {
    const ownership = record(playerState.resourceOwnership);
    const resourceNames = record(playerState.resourceNames || {});
    for (const [resourceId, owner] of Object.entries(ownership)) {
      if (!owner || owner !== roleId) {
        const name = resourceNames[resourceId] || resourceId;
        if (new RegExp(`(?:你手里|在你(?:手里|袖口|身上)|你拿着)[^。！？\\n]{0,20}${name}|${name}[^。！？\\n]{0,20}(?:在你(?:手里|袖口|身上)|你拿着)`).test(source)) {
          issues.push({ code: "STATE_FACT_CONTRADICTION", roleId, stageId, resourceId, expectedOwner: owner, claimedOwner: roleId });
        }
      }
    }
  }
  const schedule = normalizeRevealSchedule(revealSchedule || {});
  if (!roleId) return { ok: true, issues };
  const factEntries = new Map();
  for (const entry of schedule.entries) {
    const rows = factEntries.get(entry.factId) || [];
    rows.push(entry);
    factEntries.set(entry.factId, rows);
  }
  for (const [factId, entries] of factEntries) {
    const matched = entries.some((entry) => entry.publicPatterns.some((pattern) => isHardRevealAssertion(source, pattern)));
    const allowed = entries.some((entry) => isRevealAllowed(entry, { audience: roleId, phaseId: stageId, state: playerState || {} }));
    if (matched && !allowed) {
      issues.push({ code: "REVEAL_TIMING_VIOLATION", roleId, stageId, factId, fromPhase: entries.map((entry) => entry.fromPhase) });
    }
  }
  return { ok: issues.length === 0, issues };
}
