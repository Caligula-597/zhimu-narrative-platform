/**
 * P8.2.0/0.1 View-specific Packet Set — deterministic extraction from PMD V2.
 * P8.2.1: allowedFactIds are real SemanticFact.factId only; beats/clues/labels separated.
 */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function unique(list) {
  return [...new Set(asArray(list).filter(Boolean).map(String))];
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

function factIdOf(f) {
  return f?.factId || f?.id || null;
}

function collectAllFactIds(pmd) {
  const ids = new Set();
  for (const st of asArray(pmd?.stages)) {
    for (const b of asArray(st.beats)) {
      for (const f of [...asArray(b.produces), ...asArray(b.requires)]) {
        const id = factIdOf(f);
        if (id) ids.add(String(id));
      }
    }
  }
  return ids;
}

function factIdsFromBeat(beat) {
  const ids = [];
  for (const f of [...asArray(beat?.produces), ...asArray(beat?.requires)]) {
    const id = factIdOf(f);
    if (id) ids.push(String(id));
  }
  return ids;
}

function knowledgeLabelsFromBeat(beat) {
  return unique([
    beat?.goal,
    beat?.action,
    ...(asArray(beat?.produces).map((p) => p.summary).filter(Boolean)),
  ]);
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
  const allFactIds = [...collectAllFactIds(pmd)];
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
  const sourceBeatIds = unique(
    stages.flatMap((s) => s.beats.map((b) => b.sourceOutlineBeatId)),
  );
  const clueIds = unique(asArray(pmd?.clueView?.clues).map((c) => c.clueId));

  return {
    kind: "HOST_SCRIPT",
    truthView: { events: asArray(pmd?.truthView?.events).map((e) => ({ ...e })) },
    clueView: { clues: asArray(pmd?.clueView?.clues).map((c) => ({ ...c })) },
    executionView: record(pmd?.executionView),
    stages,
    stageIds: stages.map((s) => s.stageId),
    allowedSourceBeatIds: sourceBeatIds,
    allowedClueIds: clueIds,
    allowedFactIds: allFactIds,
    forbiddenFactIds: [],
    allowedKnowledgeLabels: unique(
      stages.flatMap((s) => [
        s.purpose,
        s.hostTruthSummary,
        ...s.beats.flatMap((b) => [b.hostTruth, b.eventSummary]),
      ]),
    ),
  };
}

export function buildRoleScriptPacket(pmd, characterId) {
  const ch = asArray(pmd?.characterViews?.characters).find(
    (c) => (c.characterId || c.id) === characterId,
  );
  if (!ch) return null;

  const beats = beatIndex(pmd);
  const allFactIds = collectAllFactIds(pmd);
  const allowedFacts = new Set();
  const relatedBeatIds = new Set();
  const allowedClues = new Set();
  const knowledge = new Set();

  const stages = asArray(ch.stages).map((st) => {
    const contributions = asArray(st.contributions).map((c) => {
      relatedBeatIds.add(c.sourceOutlineBeatId);
      const beat = beats.get(c.sourceOutlineBeatId);
      for (const id of factIdsFromBeat(beat)) allowedFacts.add(id);
      for (const label of knowledgeLabelsFromBeat(beat)) knowledge.add(label);
      if (c.goal) knowledge.add(c.goal);
      if (c.action) knowledge.add(c.action);
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
    for (const line of publicContext) knowledge.add(line);

    const availableClues = asArray(pmd?.clueView?.clues)
      .filter(
        (c) =>
          asArray(c.possibleFinders).includes(characterId) ||
          asArray(c.availableStages).includes(st.stageId) ||
          c.introducedAt === st.stageId,
      )
      .map((c) => {
        allowedClues.add(c.clueId);
        if (c.supportsFact) knowledge.add(String(c.supportsFact));
        return c.clueId;
      });

    return {
      stageId: st.stageId,
      contributions,
      publicContext,
      allowedKnowledgeLabels: unique([
        ...contributions.map((c) => c.action || c.goal).filter(Boolean),
        ...publicContext,
      ]),
      availableClues,
      relationChanges: [...asArray(st.relationChanges)],
    };
  });

  const allowedFactIds = [...allowedFacts];
  const forbiddenFactIds = [...allFactIds].filter((id) => !allowedFacts.has(id));

  return {
    kind: "ROLE_SCRIPT",
    characterId: ch.characterId || ch.id,
    characterName: ch.name,
    stages,
    stageIds: unique(stages.map((s) => s.stageId)),
    allowedSourceBeatIds: [...relatedBeatIds],
    allowedClueIds: [...allowedClues],
    allowedFactIds,
    forbiddenFactIds,
    allowedKnowledgeLabels: [...knowledge],
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
  const relatedBeats = [...new Map([...beats.values()].map((b) => [b.sourceOutlineBeatId || b.id, b])).values()].filter(
    (b) => asArray(b.clueRefs).includes(clueId),
  );
  const allowedFactIds = unique(relatedBeats.flatMap((b) => factIdsFromBeat(b)));
  const allFactIds = collectAllFactIds(pmd);
  const forbiddenFactIds = [...allFactIds].filter((id) => !allowedFactIds.includes(id));

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
    /** Locked lifecycle — Writer must not change these */
    lockedSemantics: {
      clueId: clue.clueId,
      introducedAt: clue.introducedAt,
      availableStages: [...asArray(clue.availableStages)],
      isMisleading: Boolean(clue.isMisleading),
      isDecisive: Boolean(clue.isDecisive),
      possibleFinders: [...asArray(clue.possibleFinders)],
    },
    stageIds: unique([clue.introducedAt || clue.stageId, ...asArray(clue.availableStages)]),
    allowedSourceBeatIds: unique(relatedBeats.map((b) => b.sourceOutlineBeatId)),
    allowedClueIds: [clue.clueId],
    allowedFactIds,
    forbiddenFactIds,
    allowedKnowledgeLabels: unique([clue.supportsFact, clue.label, clue.detailNote]),
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
  const beatIds = unique(asArray(st.beats).map((b) => b.sourceOutlineBeatId));
  const factIds = unique(asArray(st.beats).flatMap((b) => factIdsFromBeat(b)));
  return {
    kind: "PUBLIC_STAGE",
    stageId: st.stageId,
    title: st.title,
    stageRole: st.stageRole,
    playerVisibleSummary: st.playerVisibleSummary,
    publicLines: asArray(st.beats).map((b) => b.playerKnowledge).filter(Boolean),
    stageIds: [st.stageId],
    allowedSourceBeatIds: beatIds,
    allowedClueIds: [],
    allowedFactIds: factIds,
    forbiddenFactIds: [],
    allowedKnowledgeLabels: unique([
      st.playerVisibleSummary,
      ...asArray(st.beats).map((b) => b.playerKnowledge),
    ]),
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
  const beatIds = unique(truthEvents.map((e) => e.beatId));
  const beats = beatIndex(pmd);
  const factIds = unique(beatIds.flatMap((id) => factIdsFromBeat(beats.get(id))));

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
    stageIds: final?.stageId ? [final.stageId] : [],
    allowedSourceBeatIds: beatIds,
    allowedClueIds: decisiveClues.map((c) => c.clueId),
    allowedFactIds: factIds,
    forbiddenFactIds: [],
    allowedKnowledgeLabels: unique(truthEvents.map((e) => e.whatHappened)),
  };
}

export function buildScriptProductionPacketSet(pmd) {
  return {
    host: buildHostScriptPacket(pmd),
    roles: buildAllRoleScriptPackets(pmd),
    clues: buildAllClueWriterPackets(pmd),
    publicStages: buildAllPublicStagePackets(pmd),
    ending: buildEndingPacket(pmd),
  };
}

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
  for (const st of asArray(packet.stages)) {
    for (const c of asArray(st.contributions)) {
      for (const goal of foreignOwners) {
        if (goal && c.goal === goal && c.roleInBeat === "OWNER") return false;
      }
    }
  }
  return true;
}

/** Flatten packet allow-lists for Writer / Diff. */
export function packetAllowLists(packet) {
  const p = record(packet);
  return {
    stageIds: unique(p.stageIds || asArray(p.stages).map((s) => s.stageId || s)),
    allowedSourceBeatIds: unique(p.allowedSourceBeatIds || p.sourceBeatIds),
    allowedClueIds: unique(p.allowedClueIds),
    allowedFactIds: unique(p.allowedFactIds),
    forbiddenFactIds: unique(p.forbiddenFactIds),
    allowedKnowledgeLabels: unique(p.allowedKnowledgeLabels),
  };
}
