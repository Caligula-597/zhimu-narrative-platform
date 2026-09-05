/**
 * P8.2.0 Deterministic draft assembler — copies PMD-authored fields into Package sections.
 * Not a Writer / not LLM. Fills structure for compile-path proof; fillable clue gaps get placeholders.
 */

import { normalizeCompleteScriptPackage } from "./complete-script-package-contracts.js";
import { evaluateScriptProductionReadiness } from "./script-production-gate.js";
import { buildScriptProductionPacketSet } from "./script-production-packets.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Build a CompleteScriptPackage draft from PMD + packets (deterministic projection).
 */
export function assembleCompleteScriptDraftFromPmd(pmd, { projectId = "project", now = () => new Date().toISOString() } = {}) {
  const gate = evaluateScriptProductionReadiness(pmd);
  const packets = buildScriptProductionPacketSet(pmd);
  const provenanceIndex = {};

  const hostRole = {
    id: "role_host",
    name: "主持人",
    type: "HOST",
    playerAssignable: false,
  };
  const playerRoles = asArray(pmd?.characterViews?.characters).map((c, i) => {
    const characterId = c.characterId || c.id || String(i);
    const isNpc = /^NPC_/i.test(String(characterId));
    return {
      id: `role_${characterId}`,
      name: c.name || characterId,
      type: "PLAYER",
      characterId,
      playerAssignable: !isNpc,
    };
  });

  const stages = asArray(pmd?.stages)
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((st, index) => ({
      id: st.stageId,
      order: st.order ?? index,
      title: st.title,
      stageRole: st.stageRole,
      enterCondition: index === 0 ? { type: "HOST_START" } : { type: "HOST_ADVANCE" },
      exitCondition: { type: "HOST_ADVANCE" },
      mechanismAnnotationIds: [],
    }));

  const hostSections = asArray(packets.host?.stages).map((st) => {
    const paragraphs = [
      st.hostTruthSummary,
      ...asArray(st.beats).map((b) => b.hostTruth || b.eventSummary),
    ].filter(Boolean);
    const secId = `host_${st.stageId}`;
    provenanceIndex[secId] = {
      sourceBeatIds: asArray(st.beats).map((b) => b.sourceOutlineBeatId).filter(Boolean),
      sourceFactIds: [],
    };
    return {
      id: secId,
      stageId: st.stageId,
      title: `主持·${st.title || st.stageId}`,
      paragraphs: paragraphs.length ? paragraphs : [`【待写】${st.stageId} 主持内容`],
      provenance: provenanceIndex[secId],
    };
  });

  const roleScripts = {};
  for (const rolePkt of asArray(packets.roles)) {
    const roleId = `role_${rolePkt.characterId}`;
    roleScripts[roleId] = asArray(rolePkt.stages).map((st) => {
      const paragraphs = asArray(st.contributions).map((c) => {
        if (c.roleInBeat === "OWNER" && c.goal && c.action) {
          return `你为了${c.goal}，${c.action}`;
        }
        return c.action || c.goal || null;
      }).filter(Boolean);
      const pub = asArray(st.publicContext);
      const all = [...paragraphs, ...pub];
      const secId = `role:${rolePkt.characterId}:${st.stageId}`;
      provenanceIndex[secId] = {
        sourceCharacterId: rolePkt.characterId,
        sourceBeatIds: asArray(st.contributions).map((c) => c.sourceOutlineBeatId).filter(Boolean),
        sourceFactIds: [...asArray(st.allowedFactIds)].slice(0, 20),
      };
      return {
        id: secId.replace(/[^a-zA-Z0-9_\-.:]/g, "_"),
        stageId: st.stageId,
        title: `${rolePkt.characterName}·${st.stageId}`,
        paragraphs: all.length ? all : [`【待写】${rolePkt.characterName} 在 ${st.stageId} 的行动`],
        provenance: provenanceIndex[secId],
      };
    });
  }

  const publicScripts = asArray(packets.publicStages).map((st) => {
    const secId = `public_${st.stageId}`;
    provenanceIndex[secId] = { sourceBeatIds: st.sourceBeatIds || [] };
    return {
      id: secId,
      stageId: st.stageId,
      title: `公共·${st.title || st.stageId}`,
      paragraphs: [
        st.playerVisibleSummary,
        ...asArray(st.publicLines),
      ].filter(Boolean),
      provenance: provenanceIndex[secId],
    };
  });

  const clues = asArray(packets.clues).map((c) => {
    const body = c.missingDetail
      ? [`【可补细节】线索「${c.clueId}」支持事实：${c.supportsFact || "未标注"}。Writer 可具体化表象，不得改 isMisleading/isDecisive。`]
      : [`线索：${c.supportsFact || c.clueId}${c.isMisleading ? "（误导）" : ""}${c.isDecisive ? "（决定性）" : ""}`];
    const key = `clue:${c.clueId}`;
    provenanceIndex[key] = {
      sourceClueId: c.clueId,
      sourceBeatIds: c.sourceBeatIds || [],
    };
    return {
      id: c.clueId,
      title: c.supportsFact || c.clueId,
      stageId: c.introducedAt || c.stageId || stages[0]?.id,
      delivery: "HOST_RELEASE",
      visibility: c.possibleFinders?.length === 1 ? "PRIVATE" : "PUBLIC",
      paragraphs: body,
      documentId: `doc_${c.clueId}`,
      roleIds: (c.possibleFinders || []).map((id) => `role_${id}`),
      isMisleading: c.isMisleading,
      isDecisive: c.isDecisive,
      supportsFact: c.supportsFact,
      provenance: provenanceIndex[key],
    };
  });

  const ending = packets.ending;
  const endingSections = [
    {
      id: "ending_truth",
      stageId: ending?.finalStageId || stages[stages.length - 1]?.id,
      title: "终局揭示",
      paragraphs: [
        `结算模式：${ending?.resolutionMode || "MIXED"}`,
        ...asArray(ending?.truthEvents).map(
          (e) =>
            `${e.whatHappened}（发生=${e.eventOccurred}；证据效应=${e.evidenceEffect}；主张真假=${e.claimTruth}）`,
        ),
      ],
      provenance: {
        sourceBeatIds: asArray(ending?.truthEvents).map((e) => e.beatId).filter(Boolean),
      },
    },
  ];
  provenanceIndex["ending_truth"] = endingSections[0].provenance;

  let status = "DRAFT";
  if (gate.status === "BLOCKED") status = "BLOCKED";
  else if (gate.status === "READY_WITH_WARNINGS") status = "READY_FOR_REVIEW";
  else status = "READY_TO_COMPILE";

  const pkg = normalizeCompleteScriptPackage({
    id: `csp-${pmd?.id || projectId}`,
    projectId,
    source: {
      productionMasterDraftId: pmd?.id,
      productionMasterDraftRevision: String(pmd?.sourceMasterOutlineRevision || pmd?.revision || ""),
      sourceStoryStateRevision: pmd?.sourceStoryStateRevision || 0,
      sourceMasterOutlineRevision: pmd?.sourceMasterOutlineRevision,
    },
    status,
    metadata: {
      title: pmd?.title || "完整剧本包（确定性草稿）",
      premiseSummary: pmd?.premiseSummary,
      revision: 1,
    },
    roles: [hostRole, ...playerRoles],
    stages,
    hostScript: { documentId: "doc_host_manual", sections: hostSections },
    roleScripts,
    sharedScripts: [],
    publicScripts,
    clues,
    endingContent: {
      finalStageId: ending?.finalStageId,
      resolutionMode: ending?.resolutionMode,
      sections: endingSections,
    },
    mechanismAnnotations: [],
    permissions: [],
    provenanceIndex,
    diagnostics: [
      ...gate.blockers.map((b) => ({ ...b, lane: "blocker" })),
      ...gate.fillableGaps.map((b) => ({ ...b, lane: "fillable" })),
      ...gate.advisories.map((b) => ({ ...b, lane: "advisory" })),
    ],
    revision: 1,
    updatedAt: typeof now === "function" ? now() : now,
  });

  return { package: pkg, gate, packets };
}
