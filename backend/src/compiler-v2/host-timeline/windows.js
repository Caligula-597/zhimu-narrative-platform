/**
 * Overlapping SourceSection windows for Pass 1 coverage read.
 */

/**
 * @param {object[]} sections
 * @param {{ windowSize?: number, overlap?: number }} opts
 * windowSize default 6 (4–8), overlap default 2 (1–2)
 */
export function buildCoverageWindows(sections = [], { windowSize = 6, overlap = 2 } = {}) {
  const list = Array.isArray(sections) ? sections.filter(Boolean) : [];
  if (!list.length) return [];

  const size = Math.min(8, Math.max(4, Number(windowSize) || 6));
  const ov = Math.min(2, Math.max(1, Number(overlap) || 2));
  const step = Math.max(1, size - ov);

  const windows = [];
  for (let start = 0; start < list.length; start += step) {
    const slice = list.slice(start, start + size);
    if (!slice.length) break;
    windows.push({
      index: windows.length,
      startIndex: start,
      endIndex: start + slice.length - 1,
      sections: slice,
      sectionIds: slice.map((s) => s.id).filter(Boolean),
      overlapSectionIds:
        start === 0
          ? []
          : list.slice(Math.max(0, start - ov), start).map((s) => s.id).filter(Boolean)
    });
    if (start + size >= list.length) break;
  }
  return windows;
}

/**
 * Legacy-compatible char-based chunks (kept for older tests / fallback).
 */
export function buildHostTimelineChunks(state, { maxChars = 9000 } = {}) {
  const host = (state.documents || []).find((d) => d.kind === "HOST_BOOK");
  if (!host) return [];

  const sections = (state.sourceSections || []).filter((s) => s.documentId === host.id);
  if (!sections.length && host.text) {
    return [
      {
        index: 0,
        sections: [
          {
            id: null,
            actId: null,
            headingPath: ["host"],
            originalText: String(host.text).slice(0, maxChars)
          }
        ]
      }
    ];
  }

  const chunks = [];
  let buf = [];
  let chars = 0;
  for (const sec of sections) {
    const len = String(sec.originalText || "").length;
    if (buf.length && chars + len > maxChars) {
      chunks.push({ index: chunks.length, sections: buf });
      buf = [];
      chars = 0;
    }
    buf.push(sec);
    chars += len;
  }
  if (buf.length) chunks.push({ index: chunks.length, sections: buf });
  return chunks;
}
