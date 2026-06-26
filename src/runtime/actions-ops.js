/** Internal OPS console actions. */
(function (window) {
  const state = window.zhimuState;
  const api = window.zhimuApi;
  const T = window.zhimuToast || {};
  const showToast = T.showToast || (() => {});
  const showError = (error, fallback = "OPS 操作失败") => showToast(window.zhimuStatus?.normalizeError?.(error, fallback) || error?.message || fallback);
  function render() { window.zhimuRender?.(); }

  async function refresh() {
    try {
      await window.zhimuViews?.ops?.loadOpsData?.();
      render();
      showToast("OPS 数据已刷新");
    } catch (error) {
      showError(error);
    }
  }

  async function handleOpsAction(action) {
    switch (action) {
      case "ops-save-token": {
        const token = document.querySelector("[data-ops-token]")?.value || "";
        api.setOpsToken(token);
        await refresh();
        return true;
      }
      case "ops-clear-token":
        api.setOpsToken("");
        state.opsStatus = null;
        state.opsPlanRequests = null;
        state.opsAuditLog = null;
        render();
        return true;
      case "ops-refresh":
        await refresh();
        return true;
      case "ops-test-alert":
        try {
          await api.sendOpsTestAlert();
          showToast("测试告警已发送");
        } catch (error) {
          showError(error, "测试告警失败");
        }
        return true;
      case "ops-assign-plan": {
        const email = document.querySelector("[data-ops-plan-email]")?.value?.trim();
        const planCode = document.querySelector("[data-ops-plan-code]")?.value || "creator";
        if (!email) {
          showToast("请输入用户邮箱");
          return true;
        }
        try {
          await api.assignOpsPlan({ email, planCode });
          showToast("套餐已更新");
          await refresh();
        } catch (error) {
          showError(error, "套餐更新失败");
        }
        return true;
      }
      default:
        return false;
    }
  }

  window.zhimuActionsOps = { handleOpsAction };
})(window);
export {};
