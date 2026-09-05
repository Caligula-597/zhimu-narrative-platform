/**
 * P8.2.1 Deterministic Test ScriptWriter — Packet → structured sections (not literary).
 * Implements ScriptWriterPort without LLM.
 */

import {
  buildScriptWriterRequest,
  normalizeScriptWriterResult,
} from "./script-writer-result-contracts.js";
import { packetAllowLists } from "./script-production-packets.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sectionBase(sectionId, stageId, title, paragraphs, provenance, claims = []) {
  return {
    sectionId,
    stageId,
    title,
    paragraphs,
    provenance,
    canonicalClaims: claims,
  };
}

export class DeterministicTestScriptWriter {
  async write(request) {
    const req = buildScriptWriterRequest(request);
    const packet = req.packet;
    const kind = req.packetKind || packet?.kind;
    const allows = packetAllowLists(packet);
    let sections = [];

    if (kind === "HOST_SCRIPT") {
      sections = asArray(packet.stages).map((st) => {
        const beatIds = asArray(st.beats).map((b) => b.sourceOutlineBeatId).filter(Boolean);
        const factIds = beatIds.length
          ? allows.allowedFactIds.filter((_, i) => i < 8)
          : [];
        return sectionBase(
          `host_${st.stageId}`,
          st.stageId,
          `主持·${st.title || st.stageId}`,
          [
            `【本幕主持目标】${st.purpose || "（无）"}`,
            `【真实发生】${st.hostTruthSummary || asArray(st.beats).map((b) => b.hostTruth).filter(Boolean).join(" / ") || "（无）"}`,
            `【可发线索】${allows.allowedClueIds.join("、") || "（无）"}`,
          ],
          {
            sourceBeatIds: beatIds,
            sourceClueIds: allows.allowedClueIds.slice(0, 4),
            sourceFactIds: factIds.slice(0, 4),
          },
          beatIds.slice(0, 2).map((id) => ({ beatId: id, summary: "host_truth" })),
        );
      });
    } else if (kind === "ROLE_SCRIPT") {
      sections = asArray(packet.stages).map((st) => {
        const contribs = asArray(st.contributions);
        const beatIds = contribs.map((c) => c.sourceOutlineBeatId).filter(Boolean);
        const goals = contribs.filter((c) => c.goal).map((c) => c.goal);
        const actions = contribs.filter((c) => c.action).map((c) => c.action);
        const citedFacts = allows.allowedFactIds.slice(0, 3);
        return sectionBase(
          `role_${packet.characterId}_${st.stageId}`,
          st.stageId,
          `${packet.characterName}·${st.stageId}`,
          [
            `【本幕目标】${goals.join("；") || "（无独立主目标）"}`,
            `【你的行动】${actions.join("；") || "（见参与）"}`,
            `【你掌握的信息】${asArray(st.allowedKnowledgeLabels || allows.allowedKnowledgeLabels).slice(0, 6).join("；") || "（无）"}`,
            `【关系变化】${asArray(st.relationChanges).join("；") || "（无）"}`,
          ],
          {
            sourceBeatIds: beatIds,
            sourceClueIds: asArray(st.availableClues).slice(0, 3),
            sourceFactIds: citedFacts,
          },
          citedFacts.map((factId) => ({ factId, summary: "role_known_fact" })),
        );
      });
    } else if (kind === "CLUE_WRITER") {
      sections = [
        sectionBase(
          `clue_${packet.clueId}`,
          packet.stageId || allows.stageIds[0],
          `线索·${packet.clueId}`,
          [
            `【线索】该线索支持：${packet.supportsFact || "（未标注）"}`,
            packet.missingDetail
              ? "【可补细节】表象待 Writer 具体化；不得改 isMisleading / isDecisive。"
              : `误导=${packet.isMisleading}；决定性=${packet.isDecisive}`,
          ],
          {
            sourceBeatIds: allows.allowedSourceBeatIds.slice(0, 4),
            sourceClueIds: [packet.clueId],
            sourceFactIds: allows.allowedFactIds.slice(0, 4),
          },
          [{ clueId: packet.clueId, summary: packet.supportsFact }],
        ),
      ];
    } else if (kind === "PUBLIC_STAGE") {
      sections = [
        sectionBase(
          `public_${packet.stageId}`,
          packet.stageId,
          `公共·${packet.title || packet.stageId}`,
          [
            `【公开】${packet.playerVisibleSummary || ""}`,
            ...asArray(packet.publicLines).slice(0, 6),
          ].filter(Boolean),
          {
            sourceBeatIds: allows.allowedSourceBeatIds,
            sourceClueIds: [],
            sourceFactIds: allows.allowedFactIds.slice(0, 4),
          },
        ),
      ];
    } else if (kind === "ENDING") {
      sections = [
        sectionBase(
          "ending_truth",
          packet.finalStageId || allows.stageIds[0],
          "终局揭示",
          [
            `【结算模式】${packet.resolutionMode || "MIXED"}`,
            ...asArray(packet.truthEvents).map(
              (e) =>
                `${e.whatHappened}（发生=${e.eventOccurred}；证据=${e.evidenceEffect}；主张=${e.claimTruth}）`,
            ),
          ],
          {
            sourceBeatIds: allows.allowedSourceBeatIds,
            sourceClueIds: allows.allowedClueIds,
            sourceFactIds: allows.allowedFactIds.slice(0, 8),
          },
          allows.allowedSourceBeatIds.slice(0, 3).map((beatId) => ({ beatId, summary: "truth_event" })),
        ),
      ];
    } else {
      return normalizeScriptWriterResult({
        requestId: req.requestId,
        packetKind: kind,
        sections: [],
        diagnostics: [{ code: "UNKNOWN_PACKET_KIND", message: String(kind), severity: "error" }],
      });
    }

    return normalizeScriptWriterResult({
      requestId: req.requestId,
      packetKind: kind,
      sections,
      proposedCanonicalChanges: [],
      diagnostics: [],
    });
  }
}

/** Factory helpers for bad-writer fixtures (tests). */
export function makeMutatingWriter(mutate) {
  const base = new DeterministicTestScriptWriter();
  return {
    async write(request) {
      const result = await base.write(request);
      return normalizeScriptWriterResult(mutate(result, request));
    },
  };
}
