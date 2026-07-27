/** Internal OPS console actions. */
import * as api from "../api/index.js";
import { showToast } from "../components/toast.js";
import { uiStore, userStore } from "../state/index.js";
import { render } from "./runtime-facade.js";
import { callView } from "./view-registry.js";
import { normalizeError } from "../components/status-ui.js";
import { closeModal } from "../components/modal.js";
import { modal, modalBackdrop } from "../dom.js";
import { escapeHtml } from "../utils/format.js";
import { setHtml } from "../../shared/safe-dom.js";

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

  async function refreshUsers() {
    const query = uiStore.get().opsUserQuery || {
      search: "",
      verification: "all",
      limit: 20,
      offset: 0
    };
    const users = await api.getOpsUsers(query);
    uiStore.set({ opsUsers: users });
    render();
  }

  function deleteImpactHtml(preview) {
    const summary = preview?.deletion?.summary || {};
    const ownedWorlds = summary.ownedWorlds || [];
    const worldRows = ownedWorlds
      .slice(0, 6)
      .map((world) => `<li>${escapeHtml(world.name || world.id)}</li>`)
      .join("");
    return `<div class="assistant-preview account-delete-preview">
      <div class="proposal-stats"><span>${ownedWorlds.length} 个自有剧本</span><span>${summary.collaboratorWorlds || 0} 个协作剧本</span><span>${summary.hostedRooms || 0} 个体验运行房</span><span>${summary.assetCount || 0} 个资产</span></div>
      ${worldRows ? `<ul>${worldRows}</ul>` : `<p class="muted-note">该账号没有自有剧本。</p>`}
    </div>`;
  }

  async function openOpsUserDelete(userId, mode) {
    if (!modal || !modalBackdrop) return;
    const pendingReset = mode === "pending_reset";
    modal.className = "modal auth-modal account-delete-modal";
    setHtml(modal, `<h2>${pendingReset ? "重置待验证注册" : "永久删除用户账号"}</h2><p class="wizard-intro">正在加载账号影响范围…</p>`);
    modalBackdrop.classList.add("show");

    let preview;
    try {
      preview = await api.previewOpsUserDelete(userId);
    } catch (error) {
      setHtml(modal, `<h2>无法加载用户信息</h2><p class="wizard-intro">${escapeHtml(normalizeError(error, "请稍后重试"))}</p><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`);
      modal.querySelector("[data-close]").onclick = closeModal;
      return;
    }

    const allowed = pendingReset ? preview.canResetRegistration : preview.canDeleteAccount;
    if (!allowed) {
      const blockers = (preview.deletion?.blockers || [])
        .map((item) => `<div class="check-result error"><b>${escapeHtml(item.title || "无法删除")}</b><span>${escapeHtml(item.detail || "")}</span></div>`)
        .join("");
      setHtml(modal, `<h2>该账号不能执行此操作</h2>${blockers || `<p class="wizard-intro">账号受到保护，或当前状态不符合操作条件。</p>`}<div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`);
      modal.querySelector("[data-close]").onclick = closeModal;
      return;
    }

    const email = preview.target.email;
    const intro = pendingReset
      ? "此操作会删除待验证账号和现有验证码。完成后，该邮箱可以从注册第一步重新开始。"
      : "此操作会永久删除账号、其拥有的剧本、资产和登录会话，无法恢复。";
    setHtml(modal, `<h2>${pendingReset ? "重置待验证注册" : "永久删除用户账号"}</h2>
      <p class="wizard-intro">${intro}</p>
      <div class="check-result ${pendingReset ? "warn" : "error"}"><b>${escapeHtml(email)}</b><span>${escapeHtml(preview.target.displayName || "未填写昵称")} · ${preview.target.emailVerified ? "已验证" : "待验证"} · ${escapeHtml(preview.target.planCode || "free")}</span></div>
      ${deleteImpactHtml(preview)}
      <div class="form-group"><label>请输入完整邮箱以确认</label><input class="field" data-ops-delete-email placeholder="${escapeHtml(email)}"><label class="check-label" style="margin-top:10px"><input type="checkbox" data-ops-delete-ack><span>我已确认目标账号，并知晓此操作不可恢复</span></label></div>
      <div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="danger-btn" data-ops-delete-submit disabled>${pendingReset ? "确认重置注册" : "确认永久删除"}</button></div>`);
    modal.querySelector("[data-close]").onclick = closeModal;
    const input = modal.querySelector("[data-ops-delete-email]");
    const ack = modal.querySelector("[data-ops-delete-ack]");
    const submit = modal.querySelector("[data-ops-delete-submit]");
    const sync = () => {
      submit.disabled = !(ack.checked && input.value.trim() === email);
    };
    input.addEventListener("input", sync);
    ack.addEventListener("change", sync);
    submit.onclick = async () => {
      if (submit.disabled) return;
      submit.disabled = true;
      try {
        await api.deleteOpsUserAccount(userId, {
          confirmationEmail: input.value.trim(),
          acknowledged: true,
          mode
        });
        closeModal();
        await refreshUsers();
        showToast(pendingReset ? "待验证账号已重置，可以重新注册" : "用户账号已永久删除");
      } catch (error) {
        submit.disabled = false;
        showError(error, pendingReset ? "重置注册失败" : "删除账号失败");
      }
    };
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
        uiStore.set({ opsStatus: null, opsPlanRequests: null, opsAuditLog: null, opsFeedback: null, opsFeedbackStats: null, opsUsers: null });
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
      case "ops-user-search": {
        const search = document.querySelector("[data-ops-user-search]")?.value?.trim() || "";
        const verification = document.querySelector("[data-ops-user-verification]")?.value || "all";
        if (search && search.length < 2) {
          showToast("请输入至少 2 个字符");
          return true;
        }
        uiStore.set({
          opsUserQuery: {
            search,
            verification,
            limit: 20,
            offset: 0
          }
        });
        try {
          await refreshUsers();
        } catch (error) {
          showError(error, "用户搜索失败");
        }
        return true;
      }
      case "ops-user-resend": {
        const userId = el?.dataset?.userId;
        if (!userId) return true;
        el.disabled = true;
        try {
          await api.resendOpsUserVerification(userId);
          showToast("新的邮箱验证码已发送");
          await refreshUsers();
        } catch (error) {
          el.disabled = false;
          showError(error, "验证码发送失败");
        }
        return true;
      }
      case "ops-user-delete": {
        const userId = el?.dataset?.userId;
        const mode = el?.dataset?.deleteMode;
        if (!userId || !["pending_reset", "account_delete"].includes(mode)) return true;
        await openOpsUserDelete(userId, mode);
        return true;
      }
      case "ops-feedback-status": {
        const id = el?.dataset?.feedbackId;
        const status = el?.dataset?.feedbackStatus || "seen";
        if (!id) {
          showToast("缺少反馈 ID");
          return true;
        }
        if (el) {
          el.disabled = true;
          el.textContent = "更新中…";
        }
        try {
          await api.updateOpsFeedbackStatus(id, status);
          showToast("反馈状态已更新");
          await refresh();
        } catch (error) {
          if (el) el.disabled = false;
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
