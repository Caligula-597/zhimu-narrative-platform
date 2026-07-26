/** Actions for the multi-agent AI playtest lab. */
import * as zhimuApi from "../api/index.js";
import { worldStore } from "../state/index.js";
import { callView } from "./view-registry.js";

(function (window) {
  function maybeAutoLoadAiPlaytest(view) {
    if (view !== "playtest" || !zhimuApi.context.worldId) return;
    const state = worldStore.get();
    if (state.cloudAiPlaytestRuns == null && !state.cloudAiPlaytestLoading) {
      void callView("aiPlaytestLab", "loadAiPlaytestLab", { quiet: true });
    }
  }

  function handleAiPlaytestAction(action, el) {
    switch (action) {
      case "ai-playtest-run":
        void callView("aiPlaytestLab", "startAiPlaytest");
        return true;
      case "ai-playtest-refresh":
        void callView("aiPlaytestLab", "loadAiPlaytestLab");
        return true;
      case "ai-playtest-select-run":
        callView("aiPlaytestLab", "selectAiPlaytestRun", el?.dataset?.runId);
        return true;
      case "ai-playtest-open-ref":
        callView(
          "aiPlaytestLab",
          "openAiPlaytestReference",
          el?.dataset?.refType,
          el?.dataset?.refId
        );
        return true;
      default:
        return false;
    }
  }

  window.zhimuActionsAiPlaytest = {
    handleAiPlaytestAction,
    maybeAutoLoadAiPlaytest
  };
})(window);
export {};
