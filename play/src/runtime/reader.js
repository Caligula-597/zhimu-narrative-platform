import { api } from "../api.js";
import { highlightEntryTitle, getReaderSelectionOffsets } from "../utils/highlights.js";

let toolbarEl = null;
let docBound = false;
const startRequests = new Set();

function markSectionStarted(ctx, body) {
  const sectionId = body?.dataset?.sectionId;
  if (!sectionId || !ctx.roomId) return;
  const section = ctx.notesSource?.()?.sections?.find((row) => row.id === sectionId);
  if (!section || section.started_at || section.startedAt) return;
  const key = `${ctx.roomId}:${sectionId}`;
  if (startRequests.has(key)) return;
  startRequests.add(key);
  api.startSection(ctx.roomId, sectionId)
    .then((progress) => {
      section.started_at = progress.startedAt || new Date().toISOString();
    })
    .catch(() => {
      // Product analytics are best-effort; a transient failure must not block reading.
    })
    .finally(() => startRequests.delete(key));
}

function ensureToolbar() {
  if (toolbarEl) return toolbarEl;
  toolbarEl = document.createElement("div");
  toolbarEl.className = "highlight-toolbar";
  toolbarEl.hidden = true;
  toolbarEl.innerHTML = `<button type="button" class="btn quiet compact" data-highlight-add>高亮</button>`;
  document.body.appendChild(toolbarEl);
  return toolbarEl;
}

function hideHighlightToolbar() {
  const toolbar = ensureToolbar();
  toolbar.hidden = true;
}

function showHighlightToolbar(rect, sectionId, sectionTitle, selection, onDone) {
  const toolbar = ensureToolbar();
  const left = Math.max(8, rect.left + window.scrollX + rect.width / 2 - 40);
  const top = Math.max(8, rect.top + window.scrollY - 44);
  toolbar.style.left = `${left}px`;
  toolbar.style.top = `${top}px`;
  toolbar.hidden = false;
  toolbar.querySelector("[data-highlight-add]").onclick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideHighlightToolbar();
    window.getSelection()?.removeAllRanges();
    await onDone(sectionId, sectionTitle, selection);
  };
}

/**
 * @param {{ roomId: string, notesSource: () => object, onPatch?: () => void, onToast?: (msg: string) => void }} ctx
 */
export function bindPlayReader(ctx) {
  const body = document.querySelector("[data-reader-body]");
  if (!body) return;
  markSectionStarted(ctx, body);
  hideHighlightToolbar();
  body.onmouseup = (event) => {
    if (event.target.closest?.(".highlight-toolbar")) return;
    window.setTimeout(() => {
      const selection = getReaderSelectionOffsets(body);
      if (!selection || selection.text.trim().length < 1) return hideHighlightToolbar();
      const range = window.getSelection()?.getRangeAt(0);
      if (!range) return hideHighlightToolbar();
      showHighlightToolbar(
        range.getBoundingClientRect(),
        body.dataset.sectionId,
        body.dataset.sectionTitle,
        selection,
        (sectionId, sectionTitle, sel) => addStoryHighlight(ctx, sectionId, sectionTitle, sel)
      );
    }, 0);
  };
  body.onclick = (event) => {
    const active = window.getSelection();
    if (active && !active.isCollapsed) return;
    const mark = event.target.closest?.(".story-highlight");
    if (mark?.dataset.highlightId) {
      void removeStoryHighlight(ctx, mark.dataset.highlightId);
    }
  };
  if (!docBound) {
    docBound = true;
    document.addEventListener("mousedown", (event) => {
      if (event.target.closest?.(".highlight-toolbar") || event.target.closest?.("[data-reader-body]")) return;
      hideHighlightToolbar();
    });
  }
}

async function addStoryHighlight(ctx, sectionId, sectionTitle, selection) {
  const section = ctx.notesSource?.()?.sections?.find((row) => row.id === sectionId);
  const plain = section?.body || "";
  if (!plain) return ctx.onToast("无法读取当前章节正文");
  const { start, end } = selection;
  if (end <= start || start < 0 || end > plain.length) return ctx.onToast("选区无效，请重新选择");
  const snippet = plain.slice(start, end);
  if (!snippet.trim()) return ctx.onToast("不能只高亮空白字符");
  const notes = ctx.notesSource?.()?.notes || [];
  const exists = notes.some((entry) => {
    const match = entry.title?.match(/#(\d+):(\d+)$/);
    return match && Number(match[1]) === start && Number(match[2]) === end && entry.source_id === sectionId;
  });
  if (exists) return ctx.onToast("这段内容已经高亮过了");
  try {
    const entry = await api.addNotebookEntry(ctx.roomId, {
      sourceType: "script_section",
      sourceId: sectionId,
      title: highlightEntryTitle(sectionTitle, start, end),
      body: snippet
    });
    const home = ctx.notesSource?.();
    if (home) {
      if (!Array.isArray(home.notes)) home.notes = [];
      home.notes.unshift(entry);
    }
    ctx.onPatch?.();
    ctx.onToast?.("已标记高亮");
  } catch (error) {
    ctx.onToast(error.message || "高亮失败");
  }
}

async function removeStoryHighlight(ctx, entryId) {
  try {
    await api.deleteNotebookEntry(ctx.roomId, entryId);
    const home = ctx.notesSource?.();
    if (home?.notes) home.notes = home.notes.filter((note) => note.id !== entryId);
    ctx.onPatch?.();
    ctx.onToast?.("已取消高亮");
  } catch (error) {
    ctx.onToast(error.message || "取消高亮失败");
  }
}
