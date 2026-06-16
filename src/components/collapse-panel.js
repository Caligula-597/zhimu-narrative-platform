/** Reusable collapsible section panels for long workspace views. */
(function (window) {
  const state = window.zhimuState;

  function isPanelOpen(panelId, defaultOpen = true) {
    if (!state.panelCollapse) state.panelCollapse = {};
    if (Object.prototype.hasOwnProperty.call(state.panelCollapse, panelId)) {
      return state.panelCollapse[panelId];
    }
    return defaultOpen;
  }

  function togglePanel(panelId, defaultOpen = true) {
    if (!state.panelCollapse) state.panelCollapse = {};
    state.panelCollapse[panelId] = !isPanelOpen(panelId, defaultOpen);
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

  window.zhimuCollapsePanel = { isPanelOpen, togglePanel, collapsibleCard };
})(window);
export {};
