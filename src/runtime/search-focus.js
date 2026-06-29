/** Apply global-search navigation focus — select studio nodes, scroll, pulse highlight. */
(function (window) {
  const state = window.zhimuState;
  const V = window.zhimuViews || {};

  const STUDIO_NODE_TYPES = {
    scene: "scene",
    clue: "clue",
    item: "item",
    investigation_point: "investigation_point"
  };

  function pulseElement(el) {
    if (!el) return;
    el.classList.add("search-highlight");
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    setTimeout(() => el.classList.remove("search-highlight"), 4200);
  }

  function applyAfterRender() {
    const focus = state.searchFocus;
    if (!focus) return;
    state.searchFocus = null;

    requestAnimationFrame(() => {
      if (focus.view === "studio" && focus.id) {
        const nodeType = focus.nodeType || STUDIO_NODE_TYPES[focus.type] || focus.type;
        state.studioSelectedNode = { type: nodeType, id: focus.id };
        if (nodeType && nodeType !== "all") state.studioFilter = nodeType;
        window.zhimuRuntime?.render?.();
        requestAnimationFrame(() => {
          pulseElement(document.querySelector(`.node[data-node-type="${nodeType}"][data-node-id="${focus.id}"]`));
        });
        return;
      }

      if (focus.view === "writer") {
        if (focus.type === "section" && focus.id) {
          const section = state.cloudStudio?.sections?.find((row) => row.id === focus.id);
          pulseElement(document.querySelector(`[data-section="${focus.id}"]`));
          if (section) V.writer?.openCreatorSection?.(section.role_slot_id, focus.id);
          return;
        }
        if (focus.type === "role" && focus.id) {
          pulseElement(document.querySelector(`[data-role="${focus.id}"]`));
          return;
        }
      }

      if (focus.view === "clues" && focus.id) {
        state.cluesSelectedId = focus.id;
        if (focus.query) state.cluesSearchQuery = focus.query;
        window.zhimuRuntime?.render?.();
        requestAnimationFrame(() => pulseElement(document.querySelector(`[data-clue-row="${focus.id}"]`)));
      }
    });
  }

  window.zhimuSearchFocus = { applyAfterRender };
})(window);
export {};
