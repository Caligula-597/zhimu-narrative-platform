/** Chapter × scene swimlane (read-only) for architecture timeline canvas. */
import { escapeHtml } from "../utils/format.js";

export function renderTimelineSwimlane(studio) {
  const chapters = studio?.chapters || [];
  const scenes = studio?.scenes || [];
  if (!chapters.length) {
    return `<div class="empty-state">尚无章节。先在下方添加公共章节，或从编排图谱创建场景。</div>`;
  }
  return chapters.map((ch) => {
    const chScenes = scenes.filter((s) => s.chapter_id === ch.id);
    const sceneRows = chScenes.length
      ? chScenes.map((s) => `<li><strong>${escapeHtml(s.name)}</strong>${s.summary ? `<span>${escapeHtml(s.summary.slice(0, 48))}</span>` : ""}</li>`).join("")
      : `<li class="muted-note">本章暂无场景 · 可在编排图谱添加</li>`;
    return `<article class="timeline-lane card-lite">
      <header><strong>第 ${ch.sequence} 幕 · ${escapeHtml(ch.title)}</strong><span>${chScenes.length} 场景</span></header>
      <ul class="timeline-scene-list">${sceneRows}</ul></article>`;
  }).join("");
}
