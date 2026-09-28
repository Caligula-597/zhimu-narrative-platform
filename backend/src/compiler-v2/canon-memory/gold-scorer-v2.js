/**
 * Gold Scorer V2.1 — Canon Knowledge Nodes
 * claim + source overlap + optional nodeType → HIT | PARTIAL | MISS | FALSE_MATCH
 *
 * Offline-safe. Capsule-only support is PARTIAL (not Knowledge HIT).
 */

import { CHANGSHENG_HOST_TRUE_GOLD_V2 } from "../benchmarks/changsheng-host-true-gold-v2.js";
import { nodeText } from "./promote.js";

export const GOLD_MATCH = Object.freeze({
  HIT: "HIT",
  PARTIAL: "PARTIAL",
  MISS: "MISS",
  FALSE_MATCH: "FALSE_MATCH"
});

function textOf(ev) {
  return `${ev.title || ""} ${ev.summary || ""} ${ev.evidenceQuote || ""}`;
}

function claimSatisfied(text, claim) {
  const t = String(text);
  if (!claim?.anyOf?.length) return false;
  return claim.anyOf.some((group) => {
    const list = Array.isArray(group) ? group : [group];
    return list.every((k) => t.includes(k));
  });
}

function scoreClaims(text, claims = []) {
  const detail = [];
  let hit = 0;
  for (const c of claims) {
    const ok = claimSatisfied(text, c);
    if (ok) hit += 1;
    detail.push({ claimId: c.id, label: c.label, ok });
  }
  return {
    hit,
    total: claims.length,
    rate: claims.length ? hit / claims.length : 1,
    detail
  };
}

function sourceOverlap(candidateRefs = [], goldRefs = []) {
  const gold = new Set((goldRefs || []).filter(Boolean));
  const cand = (candidateRefs || []).filter(Boolean);
  const overlap = cand.filter((id) => gold.has(id));
  return {
    ok: overlap.length > 0,
    overlap,
    candidateRefs: cand,
    goldRefs: [...gold]
  };
}

function capsuleBlobForRefs(canonMemory, refs = []) {
  const want = new Set(refs);
  return (canonMemory?.sectionCapsules || [])
    .filter((c) => want.has(c.sourceSectionId))
    .map(
      (c) =>
        `${c.summary || ""} ${(c.events || []).map((e) => `${e.title} ${e.summary}`).join(" ")} ${(c.importantObjects || []).join(" ")} ${(c.mechanismHints || []).join(" ")}`
    )
    .join("\n");
}

function asNodeCandidates(canonMemory, { events = null } = {}) {
  if (canonMemory?.nodes?.length) {
    return canonMemory.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      summary: n.summary,
      sourceSectionIds: n.sourceSectionIds || [],
      text: nodeText(n)
    }));
  }
  const list = events ?? canonMemory?.events ?? [];
  return list.map((ev) => ({
    id: ev.id,
    type: "EVENT",
    title: ev.title,
    summary: ev.summary,
    sourceSectionIds: ev.sourceSectionIds || [],
    text: textOf(ev)
  }));
}

/**
 * Match gold against CanonNodes (knowledge layer).
 * Capsule-only → PARTIAL (representation not fully promoted).
 */
export function matchGoldKnowledgeV2(gold, candidates = [], { canonMemory = null } = {}) {
  const required = gold.requiredClaims || [];
  const wantType = gold.nodeType || null;

  const ranked = [];
  for (const node of candidates) {
    const src = sourceOverlap(node.sourceSectionIds || [], gold.sourceRefs || []);
    const claims = scoreClaims(node.text || textOf(node), required);
    const typeOk = !wantType || node.type === wantType;
    const softKeyword =
      claims.hit > 0 ||
      required.some((c) =>
        (c.anyOf || []).some((g) =>
          (Array.isArray(g) ? g : [g]).some((k) => (node.text || "").includes(k))
        )
      );

    ranked.push({
      nodeId: node.id,
      eventId: node.id,
      title: node.title,
      type: node.type,
      sourceOverlap: src,
      claims,
      typeOk,
      softKeyword,
      rankScore:
        (src.ok ? 10 : 0) +
        claims.hit * 3 +
        (typeOk ? 2 : 0) +
        (softKeyword ? 0.5 : 0)
    });
  }

  ranked.sort((a, b) => b.rankScore - a.rankScore);

  const inZone = ranked.filter((r) => r.sourceOverlap.ok);
  const jointText = inZone
    .map((r) => {
      const n = candidates.find((c) => c.id === r.nodeId);
      return n?.text || `${r.title}`;
    })
    .join("\n");
  const jointClaims = inZone.length ? scoreClaims(jointText, required) : null;
  const jointTypeOk =
    !wantType || inZone.some((r) => r.type === wantType) || !inZone.length;

  const capText = capsuleBlobForRefs(canonMemory, gold.sourceRefs || []);
  const capClaims = capText
    ? scoreClaims(capText, required)
    : { hit: 0, total: required.length, rate: 0, detail: [] };

  let status = GOLD_MATCH.MISS;
  let matched = null;
  let reason = "NO_SUPPORT";
  let supportingEventIds = [];

  if (jointClaims && jointClaims.rate >= 1 && jointTypeOk) {
    const typed = wantType ? inZone.filter((r) => r.type === wantType) : inZone;
    const pool = typed.length ? typed : inZone;
    const primary =
      pool.find((r) => r.claims.rate >= 1) ||
      pool.find((r) => r.claims.hit > 0) ||
      pool[0];
    status = GOLD_MATCH.HIT;
    matched = { ...primary, claims: jointClaims, joint: true };
    supportingEventIds = pool.filter((r) => r.claims.hit > 0 || r.softKeyword).map((r) => r.nodeId);
    reason =
      primary?.claims?.rate >= 1 && primary.typeOk
        ? "NODE_CLAIMS_AND_SOURCE"
        : "JOINT_NODES_CLAIMS_AND_SOURCE";
  } else if (jointClaims && jointClaims.hit > 0) {
    status = GOLD_MATCH.PARTIAL;
    matched = {
      ...(inZone.find((r) => r.claims.hit > 0) || inZone[0]),
      claims: jointClaims,
      joint: true
    };
    supportingEventIds = inZone.filter((r) => r.claims.hit > 0).map((r) => r.nodeId);
    reason = jointTypeOk ? "SOURCE_OVERLAP_PARTIAL_CLAIMS" : "TYPE_MISMATCH_OR_PARTIAL_CLAIMS";
  } else if (capClaims.rate >= 1 || capClaims.hit > 0) {
    status = GOLD_MATCH.PARTIAL;
    matched = {
      nodeId: null,
      eventId: null,
      title: null,
      source: "capsule",
      claims: capClaims,
      sourceOverlap: { ok: true, overlap: gold.sourceRefs, goldRefs: gold.sourceRefs }
    };
    reason =
      capClaims.rate >= 1
        ? "CAPSULE_ONLY_FULL_CLAIMS_NOT_PROMOTED"
        : "CAPSULE_PARTIAL_CLAIMS_NOT_PROMOTED";
  } else if (
    ranked[0] &&
    !ranked[0].sourceOverlap.ok &&
    (ranked[0].claims.hit > 0 || ranked[0].softKeyword)
  ) {
    status = GOLD_MATCH.FALSE_MATCH;
    matched = ranked[0];
    reason = "KEYWORD_WITHOUT_SOURCE_OVERLAP";
  } else if (ranked[0]?.sourceOverlap.ok && ranked[0].claims.hit === 0) {
    status = GOLD_MATCH.MISS;
    matched = ranked[0];
    reason = "SOURCE_OVERLAP_NO_CLAIMS";
  }

  return {
    goldId: gold.id,
    goldTitle: gold.title,
    goldNodeType: wantType,
    status,
    reason,
    requiredClaimCount: required.length,
    matchedEventId: matched?.nodeId || matched?.eventId || null,
    matchedTitle: matched?.title ?? null,
    matchedNodeType: matched?.type || null,
    matchedSource: matched?.source || (matched?.nodeId ? "node" : null),
    supportingEventIds,
    sourceOverlap: matched?.sourceOverlap || null,
    claims: matched?.claims || null,
    runnersUp: ranked.slice(0, 3).map((r) => ({
      nodeId: r.nodeId,
      title: r.title,
      type: r.type,
      rankScore: r.rankScore,
      claimHit: r.claims.hit,
      sourceOk: r.sourceOverlap.ok,
      typeOk: r.typeOk
    }))
  };
}

/** @deprecated Prefer matchGoldKnowledgeV2 — events-only path for legacy tests. */
export function matchGoldEventV2(gold, events = [], { canonMemory = null } = {}) {
  const candidates = (events || []).map((ev) => ({
    id: ev.id,
    type: "EVENT",
    title: ev.title,
    summary: ev.summary,
    sourceSectionIds: ev.sourceSectionIds || [],
    text: textOf(ev)
  }));
  // Events-only path: ignore gold.nodeType (everything is EVENT projection)
  const goldAsEvent = { ...gold, nodeType: "EVENT" };
  return matchGoldKnowledgeV2(goldAsEvent, candidates, { canonMemory });
}

/**
 * Full CanonMemory knowledge scorecard (offline).
 */
export function scoreCanonGoldV2(canonMemory, {
  gold = CHANGSHENG_HOST_TRUE_GOLD_V2,
  events = null
} = {}) {
  const candidates = asNodeCandidates(canonMemory, { events });
  const detail = gold.map((g) => matchGoldKnowledgeV2(g, candidates, { canonMemory }));

  const counts = {
    HIT: detail.filter((d) => d.status === GOLD_MATCH.HIT).length,
    PARTIAL: detail.filter((d) => d.status === GOLD_MATCH.PARTIAL).length,
    MISS: detail.filter((d) => d.status === GOLD_MATCH.MISS).length,
    FALSE_MATCH: detail.filter((d) => d.status === GOLD_MATCH.FALSE_MATCH).length
  };

  const eventGolds = gold.filter((g) => (g.nodeType || "EVENT") === "EVENT");
  const eventDetail = detail.filter((d) => eventGolds.some((g) => g.id === d.goldId));
  const eventHit = eventDetail.filter((d) => d.status === GOLD_MATCH.HIT).length;

  const weighted = counts.HIT + counts.PARTIAL * 0.5;

  return {
    scorerVersion: "gold-v2.1.0-knowledge",
    eventCount: canonMemory?.events?.length ?? (events || []).length,
    nodeCount: canonMemory?.nodes?.length ?? candidates.length,
    nodeCounts: canonMemory?.nodeCounts || null,
    goldTotal: gold.length,
    counts,
    recall: {
      /** Gold Knowledge Recall — any CanonNode type */
      knowledgeHit: counts.HIT,
      knowledgeRate: gold.length ? counts.HIT / gold.length : 0,
      softWeighted: weighted,
      softRate: gold.length ? weighted / gold.length : 0,
      presence: gold.length ? (counts.HIT + counts.PARTIAL) / gold.length : 0,
      /** Gold Event Recall — only golds with nodeType=EVENT */
      eventHit,
      eventTotal: eventGolds.length,
      eventRate: eventGolds.length ? eventHit / eventGolds.length : 0
    },
    falseMatchRate: gold.length ? counts.FALSE_MATCH / gold.length : 0,
    outlineOrphans: canonMemory?.outlineOrphans || [],
    detail,
    targets: {
      knowledgeHit: ">=14/14",
      eventHit: "only for Gold.nodeType==EVENT",
      falseMatch: 0,
      silentKnowledgeLoss: 0,
      note: "Do not force PROCESS/DECISION/BRANCH into EVENT for benchmark"
    }
  };
}

export function sampleCanonEventsForPrecision(events = [], { n = 30, seed = 42 } = {}) {
  const list = [...(events || [])];
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, Math.min(n, list.length)).map((ev, i) => ({
    sampleIndex: i + 1,
    eventId: ev.id,
    order: ev.order,
    title: ev.title,
    summary: ev.summary,
    importance: ev.importance || null,
    sourceSectionIds: ev.sourceSectionIds || [],
    label: null,
    notes: ""
  }));
}

export function sampleCanonNodesForPrecision(nodes = [], { n = 30, seed = 42 } = {}) {
  const list = [...(nodes || [])];
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, Math.min(n, list.length)).map((node, i) => ({
    sampleIndex: i + 1,
    nodeId: node.id,
    type: node.type,
    title: node.title,
    summary: node.summary,
    sourceSectionIds: node.sourceSectionIds || [],
    promotedFrom: node.promotedFrom || null,
    /** VALID_NODE | DUPLICATE | WRONG_TYPE | WRONG_FACT | OVER_MERGED | SHOULD_BE_EVENT */
    label: null,
    notes: ""
  }));
}

export function summarizePrecisionLabels(samples = []) {
  const labeled = samples.filter((s) => s.label);
  const counts = {};
  for (const s of labeled) {
    counts[s.label] = (counts[s.label] || 0) + 1;
  }
  const valid = counts.VALID_EVENT || counts.VALID_NODE || 0;
  return {
    labeled: labeled.length,
    total: samples.length,
    counts,
    precision: labeled.length ? valid / labeled.length : null
  };
}
