import { escapeHtml, sanitizeImageUrl } from "../../../shared/security.js";
import { state } from "../state.js";
import { applyStoryHighlights, sectionHighlights } from "../utils/highlights.js";

export function renderSections() {
  const sections = state.home?.sections || [];
  const active = sections.find((s) => s.id === state.sectionId) || sections[0];
  if (!sections.length) {
    return `<div class="empty enriched-empty"><span class="empty-icon">📖</span>主持人尚未向你的角色发放可读分幕。回到<strong>概览</strong>查看等待说明。</div>`;
  }
  const activeIndex = sections.findIndex((section) => section.id === active?.id);
  const body = active?.body || "";
  const pages = active?.pages || [];
  const isPages = active?.content_mode === "pages" || active?.metadata?.contentMode === "pages";
  const highlights = sectionHighlights(state.home?.notes, active?.id);
  const highlightHint = highlights.length ? `已高亮 ${highlights.length} 处` : "拖选词句后点「高亮」";
  const bodyHtml = isPages && pages.length
    ? `<div class="reader-pages">${pages
        .map((page, index) => {
          const src = sanitizeImageUrl(page.url);
          if (!src) return "";
          return `<figure class="reader-page"><img src="${escapeHtml(src)}" alt="第 ${index + 1} 页" loading="lazy" decoding="async" referrerpolicy="no-referrer" /><figcaption>第 ${index + 1} / ${pages.length} 页</figcaption></figure>`;
        })
        .filter(Boolean)
        .join("")}</div>`
    : `<div class="story-body reader-body" data-reader-body data-section-id="${active?.id || ""}" data-section-title="${escapeHtml(active?.title || "")}">${applyStoryHighlights(body, highlights)}</div><p class="reader-hint muted">${highlightHint} · 点击已高亮文字可取消</p>`;
  const completedCount = sections.filter((section) => section.completed).length;
  const progressPct = sections.length ? Math.round((completedCount / sections.length) * 100) : 0;
  const progressBar =
    sections.length > 0
      ? `<div class="section-progress-wrap" aria-label="分幕阅读进度">
      <div class="section-progress-bar" style="--pct:${progressPct}%"><span></span></div>
      <span class="section-progress">${completedCount} / ${sections.length} 幕已完成</span>
    </div>`
      : "";
  const switcher =
    sections.length > 1
      ? `
    <div class="section-switcher">
      <button type="button" class="btn quiet compact" data-action="section-prev" ${activeIndex <= 0 ? "disabled" : ""} aria-label="上一幕">←</button>
      <label class="section-select-wrap">
        <span class="sr-only">切换分幕</span>
        <select class="field section-select" data-bind="sectionId">
          ${sections
            .map(
              (section) => `
            <option value="${section.id}" ${section.id === active?.id ? "selected" : ""}>
              第 ${section.sequence} 幕${section.completed ? " · 已完成" : ""}
            </option>`
            )
            .join("")}
        </select>
      </label>
      <button type="button" class="btn quiet compact" data-action="section-next" ${activeIndex >= sections.length - 1 ? "disabled" : ""} aria-label="下一幕">→</button>
    </div>`
      : "";
  return `
    <div class="sections-layout">
      <article class="reader card reader-full">
        ${progressBar}
        ${switcher}
        <header class="reader-head">
          <p class="eyebrow">分幕 ${active?.sequence ?? ""}</p>
          <h3>${escapeHtml(active?.title || "")}</h3>
        </header>
        ${bodyHtml}
        ${pages.length && !isPages
          ? `<div class="story-pages">${pages
              .map((page) => {
                const src = sanitizeImageUrl(page.url);
                if (!src) return "";
                return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(page.filename || page.caption || active.title)}" loading="lazy" referrerpolicy="no-referrer" /><figcaption>${escapeHtml(page.filename || page.caption || "")}</figcaption></figure>`;
              })
              .filter(Boolean)
              .join("")}</div>`
          : ""}
        ${active && !active.completed ? `<button class="btn primary section-complete-btn" type="button" data-action="complete-section" data-section-id="${active.id}" ${state.busy ? "disabled" : ""}>标记阅读完成</button>` : active?.completed ? `<p class="done-note" role="status"><span class="done-badge">✓</span> 已完成阅读 — 主持人会收到进度通知</p>` : ""}
      </article>
    </div>`;
}
