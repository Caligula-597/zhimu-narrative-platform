/** Production readiness chips from creator dashboard. */
import { escapeHtml } from "../utils/format.js";

function chipRefAttrs(ref) {
  if (!ref) return "";
  if (ref.type === "action") return `data-action="${escapeHtml(ref.action)}"`;
  if (ref.type === "view") return `data-go="${escapeHtml(ref.view)}"`;
  return "";
}

export function renderProductionStrip(production = []) {
  if (!production.length) return "";
  const chips = production.map((item) => `
    <button type="button" class="production-chip ${item.done ? "present" : "partial"}" ${chipRefAttrs(item.ref)} title="${escapeHtml(item.detail || "")}">
      <span class="production-chip-label">${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <small>${escapeHtml(item.button || "处理")}</small>
    </button>`).join("");
  return `<section class="cockpit-production-strip" aria-label="内容统计">
    <p class="eyebrow">内容统计</p>
    <div class="production-chip-row">${chips}</div>
  </section>`;
}
