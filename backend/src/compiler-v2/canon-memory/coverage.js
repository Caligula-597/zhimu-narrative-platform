import { SECTION_CAPSULE_TYPE } from "./constants.js";
import { hashSourceSection } from "./source-hash.js";

const VALID_TYPES = new Set(Object.values(SECTION_CAPSULE_TYPE));

export function auditSourceCoverage(sections = [], capsules = []) {
  const byId = new Map();
  for (const cap of capsules || []) {
    const id = String(cap.sourceSectionId || "").trim();
    if (id) byId.set(id, cap);
  }

  const entries = [];
  const missing = [];
  const suspicious = [];

  for (const sec of sections || []) {
    const id = sec.id;
    const cap = byId.get(id);
    if (!cap) {
      missing.push(id);
      entries.push({
        sourceSectionId: id,
        contentHash: hashSourceSection(sec),
        status: "MISSING",
        capsuleType: null
      });
      continue;
    }
    const type = String(cap.type || "").toUpperCase();
    const entry = {
      sourceSectionId: id,
      contentHash: cap.contentHash || hashSourceSection(sec),
      status: "COVERED",
      capsuleType: VALID_TYPES.has(type) ? type : "UNKNOWN",
      capsuleId: cap.id || null,
      eventCount: (cap.events || []).length,
      suspicious: Boolean(cap.suspicious)
    };
    entries.push(entry);
    if (entry.capsuleType === "UNKNOWN" || cap.suspicious) {
      suspicious.push(id);
    }
  }

  const total = sections.length;
  const covered = total - missing.length;
  return {
    total,
    covered,
    rate: total ? covered / total : 1,
    missing,
    suspicious,
    entries
  };
}

/** Heuristic: narrative-looking section marked NO_RELEVANT_CONTENT or empty events. */
export function flagSuspiciousCapsules(section, capsule) {
  const text = String(section.originalText || "");
  const narrativeHints = /墓室|陶老板|啼哭|阵法|投凶|搜证|人皮|面具|长生水|刘警探|拍卖|苏醒|醒来/.test(
    text
  );
  const type = String(capsule?.type || "").toUpperCase();
  const hasEvents = (capsule?.events || []).length > 0;
  if (narrativeHints && (type === SECTION_CAPSULE_TYPE.NO_RELEVANT_CONTENT || !hasEvents)) {
    return true;
  }
  if (text.length > 400 && type === SECTION_CAPSULE_TYPE.META && hasEvents) {
    return false;
  }
  return false;
}
