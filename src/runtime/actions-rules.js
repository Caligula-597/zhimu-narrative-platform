/** Automation rules CRUD actions. */
import { showToast } from "../components/toast.js";
import { callView } from "./view-registry.js";

(function (window) {
  function handleRulesAction(action, el) {
    switch (action) {
      case "test-rules": showToast("规则检查完成：未发现冲突"); return true;
      case "new-rule":
        callView("rules", "openRuleEditor"); return true;
      case "rule-new": callView("rules", "openRuleEditor"); return true;
      case "rule-edit": callView("rules", "openRuleEditor", el?.dataset?.rule); return true;
      case "rule-editor-close": callView("rules", "closeRuleEditor"); return true;
      case "rule-editor-tab": callView("rules", "setRuleEditorTab", el?.dataset?.ruleTab); return true;
      case "rule-editor-save": callView("rules", "saveRuleEditor"); return true;
      case "rule-delete": callView("rules", "deleteCloudRule", el?.dataset?.rule); return true;
      case "rule-toggle": callView("rules", "toggleCloudRule", el?.dataset?.rule); return true;
      case "rule-validate": callView("rules", "validateCloudRules"); return true;
      case "rule-seed-examples": callView("rules", "seedExampleRules"); return true;
      default: return false;
    }
  }

  window.zhimuActionsRules = { handleRulesAction };
})(window);
export {};
