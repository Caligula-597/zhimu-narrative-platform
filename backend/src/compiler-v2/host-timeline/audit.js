/**
 * Coverage audits — SourceDisposition 100% + silent candidate loss = 0.
 */

import { CANDIDATE_DISPOSITION, SOURCE_DISPOSITION_TYPE } from "./constants.js";
import { newCompilerId } from "../state.js";

const VALID_DISP = new Set(Object.values(SOURCE_DISPOSITION_TYPE));
const VALID_CAND = new Set(Object.values(CANDIDATE_DISPOSITION));

export function normalizeSourceDisposition(raw, validSectionIds) {
  const sourceSectionId = String(raw?.sourceSectionId || "").trim();
  if (!sourceSectionId || (validSectionIds && !validSectionIds.has(sourceSectionId))) {
    return null;
  }
  let type = String(raw?.type || "").trim().toUpperCase();
  if (!VALID_DISP.has(type)) type = SOURCE_DISPOSITION_TYPE.NO_TIMELINE_CONTENT;
  return {
    sourceSectionId,
    type,
    linkedCandidateIds: Array.isArray(raw?.linkedCandidateIds)
      ? raw.linkedCandidateIds.map((id) => String(id)).filter(Boolean)
      : [],
    reason: raw?.reason ? String(raw.reason).slice(0, 200) : null
  };
}

/**
 * Ensure every host section has a disposition. Missing → auto META placeholder
 * (flagged in audit — not silent).
 */
export function ensureFullSourceDispositions(sectionIds, dispositions = []) {
  const byId = new Map();
  for (const d of dispositions || []) {
    if (d?.sourceSectionId) byId.set(d.sourceSectionId, d);
  }
  const missing = [];
  const full = [];
  for (const id of sectionIds || []) {
    if (byId.has(id)) {
      full.push(byId.get(id));
    } else {
      missing.push(id);
      full.push({
        sourceSectionId: id,
        type: SOURCE_DISPOSITION_TYPE.NO_TIMELINE_CONTENT,
        linkedCandidateIds: [],
        reason: "AUTO_FILL_MISSING_DISPOSITION",
        autoFilled: true
      });
    }
  }
  return { dispositions: full, missingSectionIds: missing };
}

/**
 * Every candidate must have an explicit disposition. Missing → CANONICAL (no silent drop).
 */
export function ensureCandidateDispositions(candidates = [], dispositions = []) {
  const byId = new Map();
  for (const raw of dispositions || []) {
    const id = String(raw?.candidateId || "").trim();
    if (!id) continue;
    let type = String(raw.type || "").trim().toUpperCase();
    if (!VALID_CAND.has(type)) type = CANDIDATE_DISPOSITION.CANONICAL;
    let reason = raw.reason || null;
    if (type === CANDIDATE_DISPOSITION.REJECTED && !reason) {
      reason = "REJECTED_WITHOUT_REASON";
    }
    byId.set(id, {
      candidateId: id,
      type,
      targetId: raw.targetId || raw.mergedInto || raw.parentId || null,
      reason
    });
  }

  const silentRecovered = [];
  for (const c of candidates) {
    const id = c.candidateId || c.id;
    if (!id) continue;
    if (!byId.has(id)) {
      silentRecovered.push(id);
      byId.set(id, {
        candidateId: id,
        type: CANDIDATE_DISPOSITION.CANONICAL,
        targetId: null,
        reason: "AUTO_RECOVER_SILENT_LOSS"
      });
    }
  }

  return {
    dispositions: [...byId.values()],
    silentRecovered,
    silentLossCount: silentRecovered.length
  };
}

export function auditSourceDispositionCoverage(sectionIds, dispositions) {
  const set = new Set((dispositions || []).map((d) => d.sourceSectionId));
  const missing = (sectionIds || []).filter((id) => !set.has(id));
  return {
    total: sectionIds?.length || 0,
    covered: (sectionIds?.length || 0) - missing.length,
    rate: sectionIds?.length ? 1 - missing.length / sectionIds.length : 1,
    missing
  };
}

export function auditDisplayPreservation(canonicalEvents, displayGroups) {
  const eventIds = new Set((canonicalEvents || []).map((e) => e.id));
  const covered = new Set();
  for (const g of displayGroups || []) {
    for (const id of g.eventIds || []) covered.add(id);
  }
  const missing = [...eventIds].filter((id) => !covered.has(id));
  const orphan = [...covered].filter((id) => !eventIds.has(id));
  return {
    canonicalCount: eventIds.size,
    coveredCount: eventIds.size - missing.length,
    rate: eventIds.size ? (eventIds.size - missing.length) / eventIds.size : 1,
    missingEventIds: missing,
    orphanEventIds: orphan
  };
}

export function newCandidateId() {
  return newCompilerId("cand");
}
