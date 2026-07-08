/** Embedded run-data panels for creator cockpit — factual metrics only. */
import { escapeHtml } from "../utils/format.js";

export function renderSegmentCompletionEmbed(data) {
  if (!data) {
    return `<div class="card-lite"><p class="muted-note">段落完成率尚未加载。</p>
      <button type="button" class="secondary-btn compact" data-action="load-segment-completion">加载数据</button></div>`;
  }
  const scopeLabel = data.scope === "room" ? "当前运行房" : `全世界 · ${data.totalRooms} 房`;
  const sections = (data.roleGroups || [])
    .flatMap((g) => (g.sections || []).map((s) => ({ ...s, roleName: g.roleName })))
    .sort((a, b) => (a.completionRate || 0) - (b.completionRate || 0))
    .slice(0, 8);
  const rows = sections.length
    ? sections.map((s) => `<li><strong>${escapeHtml(s.roleName)} · ${escapeHtml(s.title)}</strong> · ${s.completionRate ?? 0}%</li>`).join("")
    : `<li class="muted-note">暂无分幕完成数据。</li>`;
  return `<div class="card-lite insight-embed">
    <div class="row" style="justify-content:space-between"><strong>段落完成 · 平均 ${data.averageCompletion}%</strong><span class="muted-note">${escapeHtml(scopeLabel)}</span></div>
    <p class="muted-note">${escapeHtml(data.summary?.label || "")}</p>
    <ul class="insight-low-list">${rows}</ul>
    <button type="button" class="text-btn" data-action="load-segment-completion">刷新</button></div>`;
}

export function renderClueHitRateEmbed(data) {
  if (!data) {
    return `<div class="card-lite"><p class="muted-note">线索命中率尚未加载。</p>
      <button type="button" class="secondary-btn compact" data-action="load-clue-hit-rate">加载数据</button></div>`;
  }
  const scopeLabel = data.scope === "room" ? "当前运行房" : `全世界 · ${data.totalRooms} 房`;
  const clues = (data.clues || [])
    .slice()
    .sort((a, b) => (a.hitRate || 0) - (b.hitRate || 0))
    .slice(0, 8);
  const rows = clues.length
    ? clues.map((c) => `<li><strong>${escapeHtml(c.name)}</strong> · ${c.hitRate ?? 0}%</li>`).join("")
    : `<li class="muted-note">暂无线索命中数据。</li>`;
  return `<div class="card-lite insight-embed">
    <div class="row" style="justify-content:space-between"><strong>线索命中 · 平均 ${data.averageHitRate ?? data.summary?.hitRate ?? "—"}%</strong><span class="muted-note">${escapeHtml(scopeLabel)}</span></div>
    <p class="muted-note">${escapeHtml(data.summary?.label || "")}</p>
    <ul class="insight-low-list">${rows}</ul>
    <button type="button" class="text-btn" data-action="load-clue-hit-rate">刷新</button></div>`;
}
