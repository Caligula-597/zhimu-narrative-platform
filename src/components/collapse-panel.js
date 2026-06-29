/** Reusable collapsible section panels for long workspace views. */
import { uiStore } from "../state/index.js";
(function (window) {

  function getPanelCollapse() {
    return uiStore.get().panelCollapse;
  }

  function ensurePanelCollapse() {
    if (!uiStore.get().panelCollapse) {
      uiStore.set({ panelCollapse: {} });
    }
  }

  function isPanelOpen(panelId, defaultOpen = true) {
    ensurePanelCollapse();
    const panelCollapse = getPanelCollapse();
    if (Object.prototype.hasOwnProperty.call(panelCollapse, panelId)) {
      return panelCollapse[panelId];
    }
    return defaultOpen;
  }

  function togglePanel(panelId, defaultOpen = true) {
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

  function togglePanelInDom(panelId, defaultOpen = true, toggleEl = null) {
    togglePanel(panelId, defaultOpen);
    const panel =
      toggleEl?.closest?.("[data-collapse-panel]") ||
      document.querySelector(`[data-collapse-panel="${escapeAttr(panelId)}"]`);
    applyPanelDomState(panel, isPanelOpen(panelId, defaultOpen));
  }

  function collapsibleCard({
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
    const nestedClass = nested ? " collapse-panel-nested" : "";
    return `<article class="${className} collapse-panel${open ? " is-open" : " is-collapsed"}${nestedClass}" data-collapse-panel="${escapeAttr(id)}" style="${style}">
      <div class="collapse-panel-head">
        <button type="button" class="collapse-panel-toggle" data-action="toggle-collapse-panel" data-panel-id="${escapeAttr(id)}" data-default-open="${defaultOpen ? "1" : "0"}" aria-expanded="${open}">
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

  function escapeAttr(value = "") {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  window.zhimuCollapsePanel = { isPanelOpen, togglePanel, togglePanelInDom, applyPanelDomState, collapsibleCard };
})(window);
export {};
