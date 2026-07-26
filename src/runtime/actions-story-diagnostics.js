/** Actions for the read-only story diagnostics center. */
import * as zhimuApi from "../api/index.js";
import { worldStore } from "../state/index.js";
import { callView } from "./view-registry.js";

(function (window) {
  function maybeAutoLoadDiagnostics(view) {
    if (view !== "diagnostics" || !zhimuApi.context.worldId) return;
    const state = worldStore.get();
    if (!state.cloudStoryDiagnostics && !state.cloudStoryDiagnosticsLoading && !state.cloudStoryDiagnosticsError) {
      void callView("storyDiagnostics", "loadStoryDiagnostics", {
        standard: state.cloudStoryDiagnosticsStandard || "classic",
        quiet: true
      });
    }
  }

  function handleStoryDiagnosticsAction(action, el) {
    switch (action) {
      case "diagnostics-refresh":
        void callView("storyDiagnostics", "loadStoryDiagnostics", {
          standard: worldStore.get().cloudStoryDiagnosticsStandard || "classic"
        });
        return true;
      case "diagnostics-standard":
        callView("storyDiagnostics", "selectStoryDiagnosticStandard", el?.dataset?.standard);
        return true;
      case "diagnostics-open-ref":
        callView(
          "storyDiagnostics",
          "openStoryDiagnosticReference",
          el?.dataset?.refType,
          el?.dataset?.refId
        );
        return true;
      default:
        return false;
    }
  }

  window.zhimuActionsStoryDiagnostics = {
    handleStoryDiagnosticsAction,
    maybeAutoLoadDiagnostics
  };
})(window);
export {};
