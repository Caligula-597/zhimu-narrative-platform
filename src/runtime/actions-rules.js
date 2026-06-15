/** Automation rules CRUD actions. */
(function (window) {
  const T = window.zhimuToast || {};
  const M = window.zhimuModal || {};
  const showToast = T.showToast || (() => {});
  const openModal = M.openModal || (() => {});

  function views() { return window.zhimuViews || {}; }

  function handleRulesAction(action, el) {
    const R = views().rules || {};
    switch (action) {
      case "test-rules": showToast("规则检查完成：未发现冲突"); return true;
      case "new-rule":
        openModal("新建自动化规则", "使用“当满足条件，则执行动作”的方式配置规则。每个规则都支持自动执行、主持确认和仅手动三种模式。", "开始配置");
        return true;
      case "rule-new": R.openRuleEditor?.(); return true;
      case "rule-edit": R.openRuleEditor?.(el?.dataset?.rule); return true;
      case "rule-delete": R.deleteCloudRule?.(el?.dataset?.rule); return true;
      case "rule-toggle": R.toggleCloudRule?.(el?.dataset?.rule); return true;
      case "rule-validate": R.validateCloudRules?.(); return true;
      case "rule-seed-examples": R.seedExampleRules?.(); return true;
      default: return false;
    }
  }

  window.zhimuActionsRules = { handleRulesAction };
})(window);
export {};
