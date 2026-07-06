/** Creator workspace actions — Segment workbench, truth & relations. */
import * as zhimuApi from "../api/index.js";
import { worldStore } from "../state/index.js";
import { callView } from "./view-registry.js";

(function (window) {
  function maybeAutoLoadWorkspace(view) {
    const worldId = zhimuApi.context.worldId;
    if (!worldId) return;
    const ws = worldStore.get();
    if (view === "structure" && ws.cloudSegments === null) {
      void callView("creatorWorkspaces", "refreshStructureSegments");
    }
    if (view === "truth" && ws.cloudTruthClaims === null) {
      void callView("creatorWorkspaces", "refreshTruthWorkspace");
    }
  }

  function handleCreatorWorkspacesAction(action, el) {
    switch (action) {
      case "refresh-structure-segments":
        void callView("creatorWorkspaces", "refreshStructureSegments");
        return true;
      case "select-structure-segment":
        callView("creatorWorkspaces", "selectStructureSegment", el?.dataset?.segmentId);
        return true;
      case "create-structure-segment":
        void callView("creatorWorkspaces", "createStructureSegment");
        return true;
      case "save-structure-segment":
        void callView("creatorWorkspaces", "saveStructureSegment", el?.dataset?.segmentId);
        return true;
      case "sync-structure-segments":
        void callView("creatorWorkspaces", "syncStructureSegmentsFromGraph");
        return true;
      case "add-segment-ref":
        void callView("creatorWorkspaces", "addSegmentRef", el?.dataset?.segmentId);
        return true;
      case "remove-segment-ref":
        void callView("creatorWorkspaces", "removeSegmentRef", el?.dataset?.segmentId, el?.dataset?.refType, el?.dataset?.refId, el?.dataset?.roleSlotId || "");
        return true;
      case "refresh-truth-workspace":
        void callView("creatorWorkspaces", "refreshTruthWorkspace");
        return true;
      case "add-truth-claim-inline":
        void callView("creatorWorkspaces", "addTruthClaimInline");
        return true;
      case "add-relationship-inline":
        void callView("creatorWorkspaces", "addRelationshipInline");
        return true;
      default:
        return false;
    }
  }

  window.zhimuActionsCreatorWorkspaces = { handleCreatorWorkspacesAction, maybeAutoLoadWorkspace };
})(window);
export {};
