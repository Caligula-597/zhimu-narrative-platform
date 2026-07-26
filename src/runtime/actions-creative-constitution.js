/** Actions for the author-intent constitution workspace. */
import { callView } from "./view-registry.js";

(function (window) {
  function handleCreativeConstitutionAction(action) {
    switch (action) {
      case "constitution-save":
        void callView("creativeConstitution", "saveCreativeConstitution");
        return true;
      case "constitution-open-diagnostics":
        callView("creativeConstitution", "openConstitutionDiagnostics");
        return true;
      default:
        return false;
    }
  }

  window.zhimuActionsCreativeConstitution = { handleCreativeConstitutionAction };
})(window);
export {};
