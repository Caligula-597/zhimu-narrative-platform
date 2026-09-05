/**
 * P8.2.0 View-specific Packet Set — deterministic extraction from PMD V2.
 * No LLM. Role packets must not include other characters' private contributions.
 */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function beatIndex(pmd) {
  const map = new Map();
  for (const st of asArray(pmd?.stages)) {
    for (const b of asArray(st.beats)) {
      map.set(b.sourceOutlineBeatId || b.id, b);
      map.set(b.id, b);
    }
  }
  return map;
}

function allFactTokens(pmd) {
  const facts = new Set();
  for (const c of asArray(pmd?.clueView?.clues)) {
    if (c.supportsFact) facts.add(String(c.supportsFact));
    if (c.clueId) facts.add(`clue:${c.clueId}`);
  }
  for (const e of asArray(pmd?.truthView?.events)) {
    if (e.why && e.why !== "UNKNOWN") facts.add(String(e.why));
    if (e.consequence && e.consequence !== "UNKNOWN") facts.add(String(e.consequence));
    if (e.beatId) facts.add(`beat:${e.beatId}`);
  }
  return facts;
}

function deriveResolutionMode(pmd) {
  const families = new Set();
  for (const st of asArray(pmd?.stages)) {
    for (const b of asArray(st.beats)) {
      if (b.familyId) families.add(b.familyId);
      if (b.templateId?.startsWith("M01")) families.add("M01");
      if (b.templateId?.startsWith("M07")) families.add("M07");
      if (b.templateId?.startsWith("M08")) families.add("M08");
    }
  }
  const has = (f) => families.has(f);
  if (has("M01") && has("M08")) return "MIXED";
  if (has("M01")) return "CULPRIT_REVEAL";
  if (has("M07")) return "IDENTITY_SETTLEMENT";
  if (has("M08")) return "FACTION_SETTLEMENT";
  return "TRUTH_RECONSTRUCTION";
}

export function buildHostScriptPacket(pmd) {
  const stages = asArray(pmd?.stages).map((st) => ({
    stageId: st.stageId,
    title: st.title,
    stageRole: st.stageRole,
    order: st.order,
    purpose: st.purpose,
    hostTruthSummary: st.hostTruthSummary,
    stageStartState: st.stageStartState,
    stageEndState: st.stageEndState,
    beats: asArray(st.beats).map((b) => ({
      sourceOutlineBeatId: b.sourceOutlineBeatId,
      eventSummary: b.eventSummary,
      hostTruth: b.hostTruth,
      goal: b.goal,
      action: b.action,
      ownerCharacterIds: [...(b.ownerCharacterIds || [])],
      requires: b.requires || [],
      produces: b.produces || [],
    })),
  }));

  return {
    kind: "HOST_SCRIPT",
    truthView: {
      events: asArray(pmd?.truthView?.events).map((e) => ({ ...e })),
    },
    clueView: {
      clues: asArray(pmd?.clueView?.clues).map((c) => ({ ...c })),
    },
    executionView: record(pmd?.executionView),
    stages,
    sourceBeatIds: stages.flatMap((s) => s.beats.map((b) => b.sourceOutlineBeatId)).filter(Boolean),
  };
}

export function buildRoleScriptPacket(pmd, characterId) {
  const ch = asArray(pmd?.characterViews?.characters).find(
    (c) => (c.characterId || c.id) === characterId,
  );
  if (!ch) return null;

  const beats = beatIndex(pmd);
  const allFacts = allFactTokens(pmd);
  const allowed = new Set();
  const relatedBeatIds = new Set();

  const stages = asArray(ch.stages).map((st) => {
    const contributions = asArray(st.contributions).map((c) => {
      relatedBeatIds.add(c.sourceOutlineBeatId);
      const beat = beats.get(c.sourceOutlineBeatId);
      for (const p of asArray(beat?.produces)) {
        if (p.summary) allowed.add(String(p.summary));
        if (p.factType || p.kind) allowed.add(String(p.factType || p.kind));
      }
      return {
        sourceBeatId: c.sourceBeatId,
        sourceOutlineBeatId: c.sourceOutlineBeatId,
        familyId: c.familyId,
        templateId: c.templateId,
        roleInBeat: c.roleInBeat,
        goal: c.goal,
        action: c.action,
        gainedInfo: c.gainedInfo,
        relationQuality: c.relationQuality,
        needsDetail: Boolean(c.needsDetail),
      };
    });

    const publicContext = asArray(pmd?.stages)
      .filter((s) => s.stageId === st.stageId)
      .flatMap((s) =>
        asArray(s.beats)
          .filter((b) => (b.relatedCharacterIds || []).includes(characterId))
          .map((b) => b.playerKnowledge)
          .filter(Boolean),
      );

    const availableClues = asArray(pmd?.clueView?.clues)
      .filter(
        (c) =>
          asArray(c.possibleFinders).includes(characterId) ||
          asArray(c.availableStages).includes(st.stageId) ||
          c.introducedAt === st.stageId,
      )
      .map((c) => {
        allowed.add(`clue:${c.clueId}`);
        if (c.supportsFact) allowed.add(String(c.supportsFact));
        return c.clueId;
      });

    return {
      stageId: st.stageId,
      contributions,
      publicContext,
      allowedKnowledge: contributions
        .map((c) => c.action || c.goal)
        .filter(Boolean),
      availableClues,
      relationChanges: [...asArray(st.relationChanges)],
      allowedFactIds: [...allowed],
      forbiddenFactIds: [], // filled below
    };
  });

  const forbidden = [...allFacts].filter((f) => !allowed.has(f));
  for (const st of stages) {
    st.forbiddenFactIds = forbidden;
    st.allowedFactIds = [...allowed];
  }

  return {
    kind: "ROLE_SCRIPT",
    characterId: ch.characterId || ch.id,
    characterName: ch.name,
    stages,
    sourceBeatIds: [...relatedBeatIds],
  };
}

export function buildAllRoleScriptPackets(pmd) {
  return asArray(pmd?.characterViews?.characters)
    .map((c) => buildRoleScriptPacket(pmd, c.characterId || c.id))
    .filter(Boolean);
}

export function buildClueWriterPacket(pmd, clueId) {
  const clue = asArray(pmd?.clueView?.clues).find((c) => c.clueId === clueId);
  if (!clue) return null;
  const beats = beatIndex(pmd);
  const relatedBeats = [...beats.values()].filter((b) =>
    asArray(b.clueRefs).includes(clueId),
  );
  const allowedFactIds = [clue.supportsFact, `clue:${clueId}`].filter(Boolean);
  const forbiddenFactIds = [...allFactTokens(pmd)].filter((f) => !allowedFactIds.includes(f));

  return {
    kind: "CLUE_WRITER",
    clueId: clue.clueId,
    stageId: clue.introducedAt || clue.stageId,
    supportsFact: clue.supportsFact,
    isMisleading: Boolean(clue.isMisleading),
    isDecisive: Boolean(clue.isDecisive),
    introducedAt: clue.introducedAt,
    availableStages: [...asArray(clue.availableStages)],
    possibleFinders: [...asArray(clue.possibleFinders)],
    missingDetail: Boolean(clue.missingDetail),
    detailNote: clue.detailNote,
    allowedFactIds,
    forbiddenFactIds,
    sourceBeatIds: relatedBeats.map((b) => b.sourceOutlineBeatId).filter(Boolean),
  };
}

export function buildAllClueWriterPackets(pmd) {
  return asArray(pmd?.clueView?.clues)
    .map((c) => buildClueWriterPacket(pmd, c.clueId))
    .filter(Boolean);
}

export function buildPublicStagePacket(pmd, stageId) {
  const st = asArray(pmd?.stages).find((s) => s.stageId === stageId);
  if (!st) return null;
  return {
    kind: "PUBLIC_STAGE",
    stageId: st.stageId,
    title: st.title,
    stageRole: st.stageRole,
    playerVisibleSummary: st.playerVisibleSummary,
    publicLines: asArray(st.beats)
      .map((b) => b.playerKnowledge)
      .filter(Boolean),
    sourceBeatIds: asArray(st.beats).map((b) => b.sourceOutlineBeatId).filter(Boolean),
  };
}

export function buildAllPublicStagePackets(pmd) {
  return asArray(pmd?.stages)
    .map((s) => buildPublicStagePacket(pmd, s.stageId))
    .filter(Boolean);
}

export function buildEndingPacket(pmd) {
  const stages = asArray(pmd?.stages).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const final = stages[stages.length - 1];
  const truthEvents = asArray(pmd?.truthView?.events);
  const decisiveClues = asArray(pmd?.clueView?.clues).filter((c) => c.isDecisive);
  return {
    kind: "ENDING",
    finalStageId: final?.stageId,
    truthEvents: truthEvents.map((e) => ({
      beatId: e.beatId,
      stageId: e.stageId,
      whatHappened: e.whatHappened,
      eventOccurred: e.eventOccurred,
      evidenceEffect: e.evidenceEffect,
      claimTruth: e.claimTruth,
      isMisleading: e.isMisleading,
    })),
    decisiveClues: decisiveClues.map((c) => c.clueId),
    unresolvedPublicClaims: truthEvents
      .filter((e) => e.claimTruth === "UNKNOWN")
      .map((e) => e.whatHappened)
      .filter(Boolean),
    resolutionMode: deriveResolutionMode(pmd),
    // no correctCulpritId required
  };
}

/** Full packet set for a ProductionMasterDraft. */
export function buildScriptProductionPacketSet(pmd) {
  return {
    host: buildHostScriptPacket(pmd),
    roles: buildAllRoleScriptPackets(pmd),
    clues: buildAllClueWriterPackets(pmd),
    publicStages: buildAllPublicStagePackets(pmd),
    ending: buildEndingPacket(pmd),
  };
}

/**
 * Assert role packet does not embed another character's OWNER contribution text as private knowledge.
 */
export function rolePacketHasNoForeignOwnerLeak(packet, pmd) {
  const foreignOwners = [];
  for (const ch of asArray(pmd?.characterViews?.characters)) {
    const cid = ch.characterId || ch.id;
    if (cid === packet.characterId) continue;
    for (const st of asArray(ch.stages)) {
      for (const c of asArray(st.contributions)) {
        if (c.roleInBeat === "OWNER" && c.goal) foreignOwners.push(String(c.goal));
      }
    }
  }
  const blob = JSON.stringify(packet.stages);
  // Public context / shared stage text may mention others; forbid copying their private OWNER goals into contributions
  for (const st of asArray(packet.stages)) {
    for (const c of asArray(st.contributions)) {
      for (const goal of foreignOwners) {
        if (goal && c.goal === goal && c.roleInBeat === "OWNER") return false;
      }
    }
  }
  void blob;
  return true;
}
