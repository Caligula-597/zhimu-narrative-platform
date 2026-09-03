/**
 * Pass 2 — Temporal Reconciliation.
 * Candidates → dispositions (no silent drop) → CanonicalEvents + Transitions.
 * NEVER "consolidate = delete to 20".
 */

import { deepseekConfig } from "../../deepseek-config.js";
import { ACT_STATUS, TRUTH_STATUS, newCompilerId } from "../state.js";
import {
  CANDIDATE_DISPOSITION,
  TRANSITION_TYPE,
  TIMELINE_TRACK
} from "./constants.js";
import { ensureCandidateDispositions } from "./audit.js";

const SYSTEM = [
  "你是剧本杀主持手册时间线「时序和解」助手（Stage 3A Pass 2）。",
  "输入是 Pass 1 的 EventCandidates。任务：去重/归并/排序，并给出转移关系。",
  "硬性规则：",
  "1. 禁止静默删除。每个 candidateId 必须有 disposition：CANONICAL | MERGED_INTO | CHILD_OF | REJECTED。",
  "2. REJECTED 必须有 reason。",
  "3. MERGED_INTO / CHILD_OF 必须给 targetId（保留的 canonical candidateId）。",
  "4. 不要为了「好看条数」大量 REJECTED；DETAIL 默认可 CANONICAL。",
  "5. 不得新增原文没有的情节；不得发明新的 sourceSectionIds。",
  "6. truthStatus 只能 CONFIRMED 或 UNCERTAIN。",
  "只输出 JSON：",
  JSON.stringify({
    candidateDispositions: [
      {
        candidateId: "",
        type: "CANONICAL|MERGED_INTO|CHILD_OF|REJECTED",
        targetId: null,
        reason: null
      }
    ],
    canonicalEvents: [
      {
        candidateId: "",
        order: 1,
        title: "",
        summary: "",
        stageId: null,
        time: { exact: null, approximate: null },
        participants: [],
        locationHint: null,
        importance: "CORE",
        truthStatus: "CONFIRMED",
        sourceSectionIds: []
      }
    ],
    transitions: [
      {
        fromCandidateId: "",
        toCandidateId: "",
        type: "NEXT|BEFORE|CAUSES|TRIGGERS|REVEALS|ENABLES|INTERRUPTS|PARALLEL_WITH",
        sourceSectionIds: []
      }
    ]
  })
].join("\n");

function clean(s, max = 400) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const TRANS = new Set(Object.values(TRANSITION_TYPE));

/**
 * Deterministic fallback: all candidates → CANONICAL in input order + NEXT chain.
 */
export function reconcileCandidatesDeterministic(candidates = []) {
  const dispositions = candidates.map((c) => ({
    candidateId: c.candidateId,
    type: CANDIDATE_DISPOSITION.CANONICAL,
    targetId: null,
    reason: null
  }));

  const canonicalEvents = candidates.map((c, i) => ({
    id: newCompilerId("tev"),
    candidateId: c.candidateId,
    track: TIMELINE_TRACK.TRUE,
    order: i + 1,
    title: c.title,
    summary: c.summary,
    stageId: c.stageId || null,
    time: c.temporalHint
      ? { exact: null, approximate: c.temporalHint }
      : { exact: null, approximate: null },
    participants: c.participantNames || [],
    participantNames: c.participantNames || [],
    locationHint: c.locationHint || null,
    locationId: null,
    importance: c.importance,
    truthStatus: TRUTH_STATUS.CONFIRMED,
    actId: null,
    actStatus: ACT_STATUS.UNASSIGNED,
    sourceSectionIds: c.sourceSectionIds || [],
    sourceRefs: (c.sourceSectionIds || []).map((sid) => ({ sourceSectionId: sid })),
    evidenceQuote: c.evidenceQuote || null,
    confidence: c.confidence
  }));

  const transitions = [];
  for (let i = 0; i < canonicalEvents.length - 1; i += 1) {
    transitions.push({
      id: newCompilerId("tr"),
      fromEventId: canonicalEvents[i].id,
      toEventId: canonicalEvents[i + 1].id,
      type: TRANSITION_TYPE.NEXT,
      sourceRefs: []
    });
  }

  return {
    candidateDispositions: dispositions,
    canonicalEvents,
    transitions,
    silentRecovered: [],
    mode: "deterministic"
  };
}

function buildCanonicalFromDisposition(candidates, dispositions, llmEvents) {
  const candById = new Map(candidates.map((c) => [c.candidateId, c]));
  const dispById = new Map(dispositions.map((d) => [d.candidateId, d]));

  // Prefer LLM canonical list when present; else materialize CANONICAL/CHILD kept
  if (Array.isArray(llmEvents) && llmEvents.length) {
    const events = [];
    let order = 1;
    for (const raw of llmEvents) {
      const candId = String(raw.candidateId || "").trim();
      const base = candById.get(candId);
      const sourceSectionIds = [
        ...new Set(
          (Array.isArray(raw.sourceSectionIds) ? raw.sourceSectionIds : base?.sourceSectionIds || [])
            .map((id) => String(id || "").trim())
            .filter(Boolean)
        )
      ];
      if (!sourceSectionIds.length) continue;
      const title = clean(raw.title || base?.title, 80);
      const summary = clean(raw.summary || base?.summary, 500);
      if (!title || !summary) continue;
      let truthStatus = String(raw.truthStatus || "").trim();
      if (truthStatus !== TRUTH_STATUS.CONFIRMED && truthStatus !== TRUTH_STATUS.UNCERTAIN) {
        truthStatus = TRUTH_STATUS.CONFIRMED;
      }
      events.push({
        id: newCompilerId("tev"),
        candidateId: candId || null,
        track: TIMELINE_TRACK.TRUE,
        order: Number(raw.order) || order,
        title,
        summary,
        stageId: raw.stageId || base?.stageId || null,
        time:
          raw.time && typeof raw.time === "object"
            ? {
                exact: clean(raw.time.exact, 80) || null,
                approximate: clean(raw.time.approximate, 80) || null
              }
            : {
                exact: null,
                approximate: clean(raw.time || base?.temporalHint, 80) || null
              },
        participants: Array.isArray(raw.participants)
          ? raw.participants.map((n) => clean(n, 40)).filter(Boolean)
          : base?.participantNames || [],
        participantNames: Array.isArray(raw.participants)
          ? raw.participants.map((n) => clean(n, 40)).filter(Boolean)
          : base?.participantNames || [],
        locationHint: clean(raw.locationHint || base?.locationHint, 40) || null,
        locationId: null,
        importance: raw.importance || base?.importance,
        truthStatus,
        actId: null,
        actStatus: ACT_STATUS.UNASSIGNED,
        sourceSectionIds,
        sourceRefs: sourceSectionIds.map((sid) => ({ sourceSectionId: sid })),
        evidenceQuote: base?.evidenceQuote || null,
        confidence: base?.confidence
      });
      order += 1;
    }
    events.sort((a, b) => a.order - b.order);
    events.forEach((e, i) => {
      e.order = i + 1;
    });
    if (events.length) return events;
  }

  // Materialize from dispositions
  const keep = candidates.filter((c) => {
    const d = dispById.get(c.candidateId);
    return !d || d.type === CANDIDATE_DISPOSITION.CANONICAL;
  });
  return reconcileCandidatesDeterministic(keep).canonicalEvents;
}

export async function runPass2TemporalReconciliation(candidates, {
  globalStoryMap,
  storyMemory,
  requestJson,
  forceDeterministic = false
} = {}) {
  if (!candidates.length) {
    return reconcileCandidatesDeterministic([]);
  }

  if (forceDeterministic) {
    return reconcileCandidatesDeterministic(candidates);
  }

  if (!requestJson) {
    if (!deepseekConfig().configured) {
      return reconcileCandidatesDeterministic(candidates);
    }
    const { requestDeepseekJson } = await import("../../deepseek-client.js");
    requestJson = requestDeepseekJson;
  }

  const compact = candidates.map((c) => ({
    candidateId: c.candidateId,
    title: c.title,
    summary: c.summary,
    stageId: c.stageId,
    temporalHint: c.temporalHint,
    participantNames: c.participantNames,
    locationHint: c.locationHint,
    importance: c.importance,
    confidence: c.confidence,
    sourceSectionIds: c.sourceSectionIds
  }));

  const result = await requestJson(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          instruction:
            "和解时序；禁止静默丢弃候选。Canonical 条数可以接近候选数；Display 压缩留给 Pass 3。",
          globalStoryMap,
          temporalConstraints: storyMemory?.temporalConstraints || [],
          candidates: compact
        })
      }
    ],
    {
      temperature: 0.1,
      maxTokens: 8000,
      timeoutMs: Math.min(deepseekConfig().timeoutMs, 180000),
      phase: "compiler-v2-stage3a-v2-pass2-temporal"
    }
  );

  const ensured = ensureCandidateDispositions(
    candidates,
    result.value?.candidateDispositions || []
  );

  const canonicalEvents = buildCanonicalFromDisposition(
    candidates,
    ensured.dispositions,
    result.value?.canonicalEvents
  );

  // Map transitions onto event ids
  const byCand = new Map(
    canonicalEvents.filter((e) => e.candidateId).map((e) => [e.candidateId, e.id])
  );
  const transitions = [];
  for (const raw of result.value?.transitions || []) {
    let type = String(raw.type || "").toUpperCase();
    if (!TRANS.has(type)) type = TRANSITION_TYPE.NEXT;
    const fromEventId =
      byCand.get(String(raw.fromCandidateId || "").trim()) || raw.fromEventId || null;
    const toEventId =
      byCand.get(String(raw.toCandidateId || "").trim()) || raw.toEventId || null;
    if (!fromEventId || !toEventId) continue;
    transitions.push({
      id: newCompilerId("tr"),
      fromEventId,
      toEventId,
      type,
      sourceRefs: (raw.sourceSectionIds || []).map((sid) => ({ sourceSectionId: sid }))
    });
  }
  if (!transitions.length && canonicalEvents.length > 1) {
    for (let i = 0; i < canonicalEvents.length - 1; i += 1) {
      transitions.push({
        id: newCompilerId("tr"),
        fromEventId: canonicalEvents[i].id,
        toEventId: canonicalEvents[i + 1].id,
        type: TRANSITION_TYPE.NEXT,
        sourceRefs: []
      });
    }
  }

  return {
    candidateDispositions: ensured.dispositions,
    canonicalEvents,
    transitions,
    silentRecovered: ensured.silentRecovered,
    usage: result.usage || null,
    mode: "llm"
  };
}
