/** Import source hub actions */
import * as zhimuApi from "../api/index.js";
import { callView } from "./view-registry.js";

(function (window) {
  function handleImportSourceAction(action) {
    switch (action) {
      case "import-source-refresh":
        callView("importSource", "refreshImportSourceHub");
        return true;
      case "writer-document-open":
        callView("writer", "openDocumentWorkspace");
        return true;
      default:
        return false;
    }
  }
  window.zhimuActionsImportSource = { handleImportSourceAction };
})(window);
export {};
