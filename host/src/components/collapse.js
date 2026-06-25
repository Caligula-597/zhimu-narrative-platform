import { state } from "../state.js";
import { escapeHtml } from "../security.js";

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
  return `<article class="${className} collapse-panel${open ? " is-open" : " is-collapsed"}" data-collapse-panel="${escapeHtml(id)}" style="${style}">
    <div class="collapse-panel-head">
      <button type="button" class="collapse-panel-toggle" data-action="toggle-collapse-panel" data-panel-id="${escapeHtml(id)}" data-default-open="${defaultOpen ? "1" : "0"}" aria-expanded="${open}">
        <span class="collapse-panel-chevron" aria-hidden="true">${open ? "▾" : "▸"}</span>
        <div class="collapse-panel-titles">
          <h3>${title}</h3>
          ${subtitle ? `<p>${subtitle}</p>` : ""}
        </div>
      </button>
      ${headerExtra ? `<div class="collapse-panel-actions">${headerExtra}</div>` : ""}
    </div>
    <div class="collapse-panel-body">${body}</div>
  </article>`;
}
