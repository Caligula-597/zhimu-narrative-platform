import { uiStore, studioStore } from "../state/index.js";
import { render } from "./runtime-facade.js";
import { callView } from "./view-registry.js";

/** Apply global-search navigation focus — select studio nodes, scroll, pulse highlight. */
(function (window) {
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
    const focus = uiStore.get().searchFocus;
    if (!focus) return;
    uiStore.set({ searchFocus: null });

    requestAnimationFrame(async () => {
      if (focus.view === "studio" && focus.id) {
        const nodeType = focus.nodeType || STUDIO_NODE_TYPES[focus.type] || focus.type;
        studioStore.set({ studioSelectedNode: { type: nodeType, id: focus.id } });
        if (nodeType && nodeType !== "all") studioStore.set({ studioFilter: nodeType });
        render();
        requestAnimationFrame(() => {
          pulseElement(document.querySelector(`.node[data-node-type="${nodeType}"][data-node-id="${focus.id}"]`));
        });
        return;
      }

      if (focus.view === "writer") {
        if (focus.type === "section" && focus.id) {
          const section = studioStore.get().cloudStudio?.sections?.find((row) => row.id === focus.id);
          pulseElement(document.querySelector(`[data-section="${focus.id}"]`));
          if (section) {
            await window.zhimuViewLoader?.ensureViewModules?.("writer");
            callView("writer", "openCreatorSection", section.role_slot_id, focus.id);
          }
          return;
        }
        if (focus.type === "role" && focus.id) {
          pulseElement(document.querySelector(`[data-role="${focus.id}"]`));
          return;
        }
      }

      if (focus.view === "clues" && focus.id) {
        uiStore.set({ cluesSelectedId: focus.id });
        if (focus.query) uiStore.set({ cluesSearchQuery: focus.query });
        render();
        requestAnimationFrame(() => pulseElement(document.querySelector(`[data-clue-row="${focus.id}"]`)));
      }
    });
  }

  window.zhimuSearchFocus = { applyAfterRender };
})(window);
export {};
