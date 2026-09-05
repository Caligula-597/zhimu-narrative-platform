/**
 * P9.3 — thin projection of Context + GameNarrativePlan onto Writer packets.
 * Does not mutate PMD. Does not dump full plan/profile into every packet.
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

function lexiconFromContext(contextProfile) {
  const bindings = record(contextProfile?.bindings);
  return unique(Object.values(bindings).map((b) => b?.label).filter(Boolean));
}

function runtimeTruthFromBinding(binding) {
  const familyId = binding?.familyId;
  const winnerOutcome = asArray(binding?.outcomes).find(
    (o) => record(o.outcomeMatcher).type === "WINNER",
  );
  const grant = asArray(winnerOutcome?.effects).find((e) => e.type === "PERMISSION_GRANT");
  if (familyId === "M03") {
    return {
      winnerCount: 1,
      resolution: "HIGHEST_BID",
      grantedPermissionId: grant?.permissionId || null,
    };
  }
  if (familyId === "M09") {
    return {
      winnerCount: null,
      resolution: "MAJORITY_VOTE",
      grantedPermissionId:
        asArray(binding?.outcomes)
          .flatMap((o) => asArray(o.effects))
          .find((e) => e.type === "PERMISSION_GRANT")?.permissionId || null,
      playerDecisionRewritesCanonTruth: false,
    };
  }
  return null;
}

function narrativeSurface(binding) {
  return {
    bindingId: binding.id,
    familyId: binding.familyId,
    stageId: binding.stageId,
    causeSummary: binding.narrative?.causeSummary || "",
    stakeLabel: binding.narrative?.stake?.label || "",
    participantReason: binding.narrative?.participantReason || "",
    publicPrompt: binding.narrative?.publicPrompt || "",
    outcomes: asArray(binding.outcomes).map((o) => ({
      matcherType: record(o.outcomeMatcher).type || null,
      narrativeMeaning: o.narrativeMeaning || "",
    })),
    runtimeTruth: runtimeTruthFromBinding(binding),
  };
}

/**
 * Enrich an existing packet set in-place-clone with contextLexicon + gameNarrative slices.
 */
export function enrichPacketSetWithNarrativeContext(
  packetSet,
  { contextProfile = null, gameNarrativePlan = null } = {},
) {
  const lexicon = lexiconFromContext(contextProfile);
  const bindings = asArray(gameNarrativePlan?.bindings).map(narrativeSurface);
  const byStage = new Map();
  for (const b of bindings) {
    if (!byStage.has(b.stageId)) byStage.set(b.stageId, []);
    byStage.get(b.stageId).push(b);
  }

  const host = {
    ...packetSet.host,
    contextLexicon: lexicon,
    gameNarrative: bindings,
    allowedKnowledgeLabels: unique([
      ...asArray(packetSet.host?.allowedKnowledgeLabels),
      ...lexicon,
      ...bindings.flatMap((b) => [b.stakeLabel, b.causeSummary]),
    ]),
  };

  const publicStages = asArray(packetSet.publicStages).map((p) => ({
    ...p,
    contextLexicon: lexicon,
    gameNarrative: byStage.get(p.stageId) || [],
    allowedKnowledgeLabels: unique([
      ...asArray(p.allowedKnowledgeLabels),
      ...lexicon,
      ...(byStage.get(p.stageId) || []).flatMap((b) => [b.stakeLabel, b.publicPrompt]),
    ]),
  }));

  const roles = asArray(packetSet.roles).map((role) => {
    // Role may know public stake/prompt only — never full outcome secret matrix beyond publicMeaning
    const roleGameSurface = bindings.map((b) => ({
      stageId: b.stageId,
      familyId: b.familyId,
      stakeLabel: b.stakeLabel,
      publicPrompt: b.publicPrompt,
      participantReason: b.participantReason,
    }));
    return {
      ...role,
      contextLexicon: lexicon,
      roleGameSurface,
      allowedKnowledgeLabels: unique([
        ...asArray(role.allowedKnowledgeLabels),
        ...lexicon,
        ...roleGameSurface.flatMap((g) => [g.stakeLabel, g.publicPrompt]),
      ]),
    };
  });

  const clues = asArray(packetSet.clues).map((c) => ({
    ...c,
    contextLexicon: lexicon,
    allowedKnowledgeLabels: unique([...asArray(c.allowedKnowledgeLabels), ...lexicon]),
  }));

  const ending = {
    ...packetSet.ending,
    contextLexicon: lexicon,
    gameNarrative: bindings.filter((b) => b.familyId === "M09"),
    settlementPresentation: {
      playerDecisionRewritesCanonTruth: false,
      note: "多数/平票/无决议只影响公开结算呈现，不改写 Canon 真相。",
    },
    allowedKnowledgeLabels: unique([
      ...asArray(packetSet.ending?.allowedKnowledgeLabels),
      ...lexicon,
    ]),
  };

  return { host, roles, clues, publicStages, ending };
}
