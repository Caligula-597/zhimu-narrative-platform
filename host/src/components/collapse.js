import { state } from "../state.js";
import { renderCollapsibleCard } from "../../../shared/components/collapse.js";

export function isPanelOpen(panelId, defaultOpen = true) {
  if (Object.prototype.hasOwnProperty.call(state.panelCollapse, panelId)) {
    return state.panelCollapse[panelId];
  }
  return defaultOpen;
}

export function togglePanelInDom(panelId, defaultOpen = true, toggleEl = null) {
  state.panelCollapse[panelId] = !isPanelOpen(panelId, defaultOpen);
  const panel =
    toggleEl?.closest?.("[data-collapse-panel]") ||
    document.querySelector(`[data-collapse-panel="${CSS.escape(panelId)}"]`);
  if (!panel) return;
  const open = isPanelOpen(panelId, defaultOpen);
  panel.classList.toggle("is-open", open);
  panel.classList.toggle("is-collapsed", !open);
  const toggle = panel.querySelector(".collapse-panel-toggle");
  const chevron = panel.querySelector(".collapse-panel-chevron");
  if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
  if (chevron) chevron.textContent = open ? "▾" : "▸";
}

export function collapsibleCard({
  id,
  title,
  subtitle = "",
  body = "",
  headerExtra = "",
  defaultOpen = true,
  className = "card",
  style = ""
} = {}) {
  const open = isPanelOpen(id, defaultOpen);
  return renderCollapsibleCard({ id, title, subtitle, body, headerExtra, defaultOpen, open, className, style });
}
