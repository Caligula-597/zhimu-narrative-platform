import { escapeHtml } from "../../../shared/security.js";

const HIGHLIGHT_OFFSET_RE = /#(\d+):(\d+)$/;

export function parseHighlightOffsets(entry) {
  const match = entry?.title?.match(HIGHLIGHT_OFFSET_RE);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return null;
  return { start, end };
}

export function highlightEntryTitle(sectionTitle, start, end) {
  return `高亮 · ${sectionTitle}#${start}:${end}`;
}

function legacyHighlightRange(text, entry) {
  const needle = entry.body;
  if (!needle || !text) return null;
  const idx = text.indexOf(needle);
  if (idx === -1) return null;
  return { start: idx, end: idx + needle.length, id: entry.id };
}

function collectHighlightRanges(text, entries) {
  const ranges = [];
  for (const entry of entries || []) {
    const offsets = parseHighlightOffsets(entry);
    let range = null;
    if (offsets && offsets.end <= text.length) range = { ...offsets, id: entry.id };
    else range = legacyHighlightRange(text, entry);
    if (!range) continue;
    const overlaps = ranges.some((item) => !(range.end <= item.start || range.start >= item.end));
    if (!overlaps) ranges.push(range);
  }
  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}

export function applyStoryHighlights(text, entries) {
  if (!text) return escapeHtml(text || "");
  const ranges = collectHighlightRanges(text, entries);
  if (!ranges.length) return escapeHtml(text);
  let html = "";
  let pos = 0;
  for (const range of ranges) {
    html += escapeHtml(text.slice(pos, range.start));
    html += `<mark class="story-highlight" data-highlight-id="${escapeHtml(range.id)}" title="点击取消高亮">${escapeHtml(text.slice(range.start, range.end))}</mark>`;
    pos = range.end;
  }
  html += escapeHtml(text.slice(pos));
  return html;
}

export function sectionHighlights(notes, sectionId) {
  return (notes || []).filter((note) => note.source_type === "script_section" && note.source_id === sectionId);
}

export function getReaderSelectionOffsets(container) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const prefix = document.createRange();
  prefix.selectNodeContents(container);
  prefix.setEnd(range.startContainer, range.startOffset);
  const start = prefix.toString().length;
  const end = start + range.toString().length;
  if (end <= start) return null;
  return { start, end, text: range.toString() };
}
