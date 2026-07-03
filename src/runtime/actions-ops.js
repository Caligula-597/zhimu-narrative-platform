/** Internal OPS console actions. */
import * as api from "../api/index.js";
import { showToast } from "../components/toast.js";
import { uiStore, userStore } from "../state/index.js";
import { render } from "./runtime-facade.js";
import { callView } from "./view-registry.js";
import { normalizeError } from "../components/status-ui.js";

(function (window) {
  const showError = (error, fallback = "OPS 操作失败") => showToast(normalizeError(error, fallback));

  async function refresh() {
    try {
      await callView("ops", "loadOpsData");
      render();
      showToast("OPS 数据已刷新");
    } catch (error) {
      showError(error);
    }
  }

  async function handleOpsAction(action, el) {
    switch (action) {
      case "ops-save-token": {
        const token = document.querySelector("[data-ops-token]")?.value || "";
        api.setOpsToken(token);
        await refresh();
        return true;
      }
      case "ops-clear-token":
        api.setOpsToken("");
        uiStore.set({ opsStatus: null, opsPlanRequests: null, opsAuditLog: null, opsFeedback: null, opsFeedbackStats: null });
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
      case "ops-feedback-status": {
        const id = el?.dataset?.feedbackId;
        const status = el?.dataset?.feedbackStatus || "seen";
        if (!id) {
          showToast("缺少反馈 ID");
          return true;
        }
        try {
          await api.updateOpsFeedbackStatus(id, status);
          showToast("反馈状态已更新");
          await refresh();
        } catch (error) {
          showError(error, "反馈状态更新失败");
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
