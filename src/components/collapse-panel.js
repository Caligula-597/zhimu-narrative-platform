/** Reusable collapsible section panels for long workspace views. */
import { uiStore } from "../state/index.js";
import { renderCollapsibleCard } from "../../shared/components/collapse.js";

function getPanelCollapse() {
  return uiStore.get().panelCollapse;
}

function ensurePanelCollapse() {
  if (!uiStore.get().panelCollapse) {
    uiStore.set({ panelCollapse: {} });
  }
}

function escapeAttr(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function isPanelOpen(panelId, defaultOpen = true) {
  ensurePanelCollapse();
  const panelCollapse = getPanelCollapse();
  if (Object.prototype.hasOwnProperty.call(panelCollapse, panelId)) {
    return panelCollapse[panelId];
  }
  return defaultOpen;
}

export function togglePanel(panelId, defaultOpen = true) {
  ensurePanelCollapse();
  const panelCollapse = getPanelCollapse();
  uiStore.set({ panelCollapse: { ...panelCollapse, [panelId]: !isPanelOpen(panelId, defaultOpen) } });
}

function applyPanelDomState(panel, open) {
  if (!panel) return;
  panel.classList.toggle("is-open", open);
  panel.classList.toggle("is-collapsed", !open);
  const toggle = panel.querySelector(".collapse-panel-toggle");
  const chevron = panel.querySelector(".collapse-panel-chevron");
  if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
  if (chevron) chevron.textContent = open ? "▾" : "▸";
}

export function togglePanelInDom(panelId, defaultOpen = true, toggleEl = null) {
  togglePanel(panelId, defaultOpen);
  const panel =
    toggleEl?.closest?.("[data-collapse-panel]") ||
    document.querySelector(`[data-collapse-panel="${escapeAttr(panelId)}"]`);
  applyPanelDomState(panel, isPanelOpen(panelId, defaultOpen));
}

export function collapsibleCard({
  id,
  title,
  subtitle = "",
  body = "",
  headerExtra = "",
  defaultOpen = true,
  className = "card",
  style = "",
  nested = false,
} = {}) {
  const open = isPanelOpen(id, defaultOpen);
  return renderCollapsibleCard({ id, title, subtitle, body, headerExtra, defaultOpen, open, className, style, nested });
}
