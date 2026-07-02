/* Account settings page — quota, sessions, OAuth, auth actions. */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { modal, modalBackdrop } from "../dom.js";
import { callRuntime, loadCloudData, render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { uiStore, userStore, assetStore } from "../state/index.js";
import * as F from "../utils/format.js";
import { closeModal, studioField } from "../components/modal.js";
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatTime = F.formatTime || (() => "");
  const handleApiError = window.zhimuUserMessages?.handleApiErrorToast || ((err, toast) => toast(err?.message || "操作失败"));

  const Status = () => window.zhimuStatus || {};

  function accountShell(body, loading = false) {
    const content = loading
      ? Status().loading?.("账号设置", "正在加载登录身份、套餐配额与多设备记录。") || `<p class="muted-note">正在加载账号信息…</p>`
      : body;
    return `<section class="rules-layout"><article class="card" style="grid-column:1/-1"><div class="section-head"><div><h3>账号设置</h3><p>登录身份、套餐配额与多设备管理</p></div></div>${content}</article></section>`;
  }

  function formatBytesShort(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function deleteAccountSummaryHtml(preview) {
    const s = preview.summary || {};
    const worlds = (s.ownedWorlds || [])
      .slice(0, 6)
      .map((w) => `<li>${escapeHtml(w.name)}${w.catalogPublic ? " · 已公开" : ""}</li>`)
      .join("");
    const extraWorlds = (s.ownedWorlds || []).length > 6 ? `<li>…等 ${s.ownedWorlds.length} 个剧本</li>` : "";
    return `<section class="assistant-preview account-delete-preview"><div class="proposal-stats"><span>${(s.ownedWorlds || []).length} 个拥有剧本</span><span>${s.collaboratorWorlds || 0} 个协作剧本</span><span>${s.hostedRooms || 0} 个体验运行房</span><span>${s.assetCount || 0} 个资产 · ${formatBytesShort(s.assetBytes)}</span></div><ul>${worlds || "<li>无拥有剧本</li>"}${extraWorlds}</ul>${(preview.warnings || []).map((line) => `<p class="muted-note">${escapeHtml(line)}</p>`).join("")}</section>`;
  }

  export async function openDeleteAccountWizard() {
    const backdrop = modalBackdrop;

    if (!modal || !backdrop || !window.zhimuSessionAuth?.isAuthenticated?.()) {
      showToast("请先登录");
      return callRuntime("openAuth");
    }
    modal.className = "modal auth-modal account-delete-modal";
    modal.innerHTML = `<h2>注销账号</h2>${Status().modalLoading?.("正在加载影响范围…") || `<p class="wizard-intro">正在加载影响范围…</p>`}`;
    backdrop.classList.add("show");
    let preview;
    try {
      preview = await zhimuApi.previewAccountDelete();
    } catch (error) {
      modal.innerHTML = `<h2>无法加载注销信息</h2>${Status().modalError?.(error, "请稍后重试") || `<p class="wizard-intro">${escapeHtml(error.message || "请稍后重试")}</p>`}<div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
      modal.querySelector("[data-close]").onclick = closeModal;
      return;
    }
    if (!preview.canDelete) {
      const blockers = (preview.blockers || [])
        .map((item) => `<div class="check-result error"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.detail)}</span></div>`)
        .join("");
      modal.innerHTML = `<h2>暂时无法注销</h2>${blockers}<div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
      modal.querySelector("[data-close]").onclick = closeModal;
      return;
    }
    const label = preview.confirmationLabel || "";
    modal.innerHTML = `<h2>注销账号</h2><p class="wizard-intro"><strong>与「退出登录」不同：</strong>注销会永久删除账号数据，无法恢复。退出登录仅在本设备结束会话，账号仍保留。</p>${deleteAccountSummaryHtml(preview)}<div class="form-group"><label>请输入你的昵称以确认（区分大小写）</label><input class="field" data-delete-confirm placeholder="${escapeHtml(label)}"><label class="check-label" style="margin-top:10px"><input type="checkbox" data-delete-ack><span>我已知晓注销不可恢复</span></label></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="danger-btn" data-delete-submit disabled>永久注销账号</button></div>`;
    modal.querySelector("[data-close]").onclick = closeModal;
    const confirmInput = modal.querySelector("[data-delete-confirm]");
    const ack = modal.querySelector("[data-delete-ack]");
    const submit = modal.querySelector("[data-delete-submit]");
    const syncSubmit = () => {
      submit.disabled = !(ack.checked && confirmInput.value.trim() === label);
    };
    confirmInput.addEventListener("input", syncSubmit);
    ack.addEventListener("change", syncSubmit);
    submit.onclick = async () => {
      if (confirmInput.value.trim() !== label || !ack.checked) return;
      submit.disabled = true;
      try {
        await zhimuApi.deleteAccount({ confirmation: confirmInput.value.trim(), acknowledged: true });
        window.zhimuSessionAuth?.markLoggedOut?.();
        window.zhimuContext?.onSessionLogout?.();
        uiStore.set({ accountView: null });
        closeModal();
        showToast("账号已永久注销");
        await window.zhimuAuthSession?.syncProfile?.();
        window.zhimuAuthSession?.syncAuthBanner?.();
        try {
          await loadCloudData(true, true);
        } catch {
          /* logged out */
        }
        render();
      } catch (error) {
        submit.disabled = false;
        handleApiError(error, showToast);
      }
    };
  }

  export async function openPlanUpgradeModal(desiredPlanCode = "creator") {
    const backdrop = modalBackdrop;

    if (!modal || !backdrop) return;
    const entitlements = uiStore.get().accountView?.entitlements;
    const upgrade = entitlements?.upgrade;
    const targets = upgrade?.availableTargets || [];
    const options = targets.length
      ? targets
      : [{ code: desiredPlanCode, label: desiredPlanCode === "studio" ? "工作室" : "创作者" }];
    const selectHtml = options
      .map((plan) => `<option value="${escapeHtml(plan.code)}" ${plan.code === desiredPlanCode ? "selected" : ""}>${escapeHtml(plan.label)}</option>`)
      .join("");
    modal.className = "modal auth-modal";
    modal.innerHTML = `<h2>申请套餐升级</h2><p class="wizard-intro">提交后由 <strong>support@getzhimu.com</strong> 人工审核并开通，暂无在线支付。审核通常 1～3 个工作日。</p><div class="form-group"><label>希望升级至</label><select class="field" data-upgrade-plan>${selectHtml}</select>${studioField("申请说明 · 至少 8 字", "upgradeReason", "textarea", "简要说明你的创作规模、团队人数或为何需要更高配额…")}${studioField("补充联系方式（选填）", "upgradeContact", "input", "")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-upgrade-submit>提交申请</button></div>`;
    backdrop.classList.add("show");
    modal.querySelector("[data-close]").onclick = closeModal;
    modal.querySelector("[data-upgrade-submit]").onclick = async () => {
      const submit = modal.querySelector("[data-upgrade-submit]");
      submit.disabled = true;
      try {
        const result = await zhimuApi.submitPlanUpgradeRequest({
          desiredPlanCode: modal.querySelector("[data-upgrade-plan]").value,
          reason: modal.querySelector('[data-studio-field="upgradeReason"]')?.value || "",
          contact: modal.querySelector('[data-studio-field="upgradeContact"]')?.value || ""
        });
        closeModal();
        showToast(result.message || "申请已提交");
        await refreshAccountView({ background: true });
      } catch (error) {
        submit.disabled = false;
        handleApiError(error, showToast);
      }
    };
  }

  export function accountBodyHtml(data) {
    const me = data.me || {};
    const sessions = data.sessions?.sessions || [];
    const oauth = data.config?.oauth || [];
    const usage = data.usage;
    const isGuest = Boolean(me.isGuest);
    const sessionRows = sessions.map((s) => `<div class="collab-row"><div><b>${escapeHtml(s.deviceLabel || "未知设备")}</b><p class="muted-note">最近活跃 ${formatTime(s.lastSeenAt)}</p></div>${s.isCurrent ? `<span class="cloud-pill">当前</span>` : `<button class="text-btn danger-text" data-revoke-session="${s.id}">下线</button>`}</div>`).join("") || `<div class="empty-state">暂无其他设备记录</div>`;
    const oauthButtons = oauth.map((p) => `<button class="secondary-btn" data-oauth-start="${p.id}">关联 ${escapeHtml(p.label)}</button>`).join("");
    const oauthLoginButtons = oauth.map((p) => `<button class="secondary-btn" data-oauth-start="${p.id}">使用 ${escapeHtml(p.label)} 登录</button>`).join("");
    const quotaHtml = callRuntime("renderQuotaSection", usage, data.entitlements) || "";
    const guestUpgrade = isGuest
      ? `<section class="form-group"><h3>保存进度 · 注册正式账号</h3>${studioField("邮箱", "upgradeEmail", "input", "")}${studioField("昵称", "upgradeName", "input", me.display_name || "")}${studioField("密码 · 至少 8 位", "upgradePassword", "input", "")}<button type="button" class="primary-btn" data-guest-upgrade>绑定邮箱并注册</button><p class="muted-note">或使用 OAuth 绑定（保留当前房间进度）</p>${oauthLoginButtons ? `<div class="row">${oauthLoginButtons}</div>` : ""}</section>`
      : "";
    return `${guestUpgrade}${!isGuest ? `${quotaHtml}${oauthButtons ? `<section class="form-group"><h3>关联登录</h3><div class="row">${oauthButtons}</div></section>` : ""}` : ""}<section class="form-group"><h3>登录设备</h3><div class="collab-list">${sessionRows}</div>${!isGuest ? `<button type="button" class="text-btn" data-logout-all>下线其他所有设备</button>` : ""}</section><section class="form-group session-actions"><h3>会话</h3><p class="muted-note">退出登录仅结束当前设备会话，账号与剧本数据仍保留。</p><button type="button" class="secondary-btn" data-auth-logout>退出登录</button></section>${!isGuest ? `<section class="form-group"><h3>数据导出</h3><p class="muted-note">下载 JSON 格式的账号元数据（剧本清单、资产清单、会话设备等），不含密码与文件二进制。</p><button type="button" class="secondary-btn" data-export-account>下载我的数据</button><p class="muted-note" style="margin-top:10px"><a href="#" data-legal-doc="legal/PRIVACY_ZH.md" data-legal-title="隐私政策">隐私政策</a> · <a href="#" data-legal-doc="legal/USER_TERMS_ZH.md" data-legal-title="用户协议">用户协议</a> · <a href="#" data-legal-doc="legal/COPYRIGHT_APPEAL_ZH.md" data-legal-title="版权与侵权申诉">版权申诉</a></p></section>` : ""}<section class="form-group danger-zone-card"><h3>注销账号</h3><p class="muted-note">永久删除账号、你拥有的剧本与资产，<strong>不可恢复</strong>。与上方「退出登录」不同。</p><button type="button" class="danger-btn" data-open-delete-account>注销账号…</button></section>`;
  }

  export async function refreshAccountView(options = {}) {
    const background = Boolean(options.background);
    if (uiStore.get().accountViewLoading) return;
    const showLoading = !background && !uiStore.get().accountView;
    if (showLoading) {
      uiStore.set({ accountViewLoading: true });
      if (uiStore.get().view === "account") render();
    }
    try {
      const [me, sessions, config, entitlements] = await Promise.all([
        zhimuApi.me(),
        zhimuApi.listSessions().catch(() => ({ sessions: [] })),
        zhimuApi.getAuthConfig(),
        zhimuApi.getAccountEntitlements().catch(() => null)
      ]);
      const usage = entitlements?.usage ?? null;
      if (usage) assetStore.set({ storageUsage: usage });
      uiStore.set({ accountView: { me, sessions, config, usage, entitlements } });
    } catch (error) {
      if (!background) {
        uiStore.set({ accountView: null });
        handleApiError(error, showToast);
      }
    } finally {
      uiStore.set({ accountViewLoading: false });
      if (uiStore.get().view === "account") render();
    }
  }

  export function bindAccountPanel(root = document) {
    root.querySelectorAll("[data-plan-upgrade]").forEach((btn) => {
      btn.onclick = () => void openPlanUpgradeModal(btn.dataset.planUpgrade);
    });
    root.querySelector("[data-auth-logout]")?.addEventListener("click", async () => {
      try {
        await zhimuApi.logout();
        window.zhimuSessionAuth?.markLoggedOut?.();
        window.zhimuContext?.onSessionLogout?.();
        showToast("已退出登录");
        await window.zhimuAuthSession?.syncProfile?.();
        window.zhimuAuthSession?.syncAuthBanner?.();
        render();
      } catch (error) {
        handleApiError(error, showToast);
      }
    });
    root.querySelector("[data-logout-all]")?.addEventListener("click", async () => {
      try {
        await zhimuApi.logoutAllDevices();
        showToast("已下线其他设备");
        await refreshAccountView();
      } catch (error) {
        handleApiError(error, showToast);
      }
    });
    root.querySelectorAll("[data-revoke-session]").forEach((btn) => {
      btn.onclick = async () => {
        try {
          await zhimuApi.revokeSession(btn.dataset.revokeSession);
          showToast("设备已下线");
          await refreshAccountView();
        } catch (error) {
          handleApiError(error, showToast);
        }
      };
    });
    root.querySelectorAll("[data-oauth-start]").forEach((btn) => {
      btn.onclick = async () => {
        try {
          const { url } = await zhimuApi.oauthStartUrl(btn.dataset.oauthStart);
          window.location.href = url;
        } catch (error) {
          handleApiError(error, showToast);
        }
      };
    });
    root.querySelector("[data-open-delete-account]")?.addEventListener("click", () => {
      void openDeleteAccountWizard();
    });
    root.querySelector("[data-export-account]")?.addEventListener("click", async () => {
      const btn = root.querySelector("[data-export-account]");
      if (btn) btn.disabled = true;
      try {
        const data = await zhimuApi.exportAccountData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `zhimu-account-export-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showToast("数据导出已开始下载");
      } catch (error) {
        handleApiError(error, showToast);
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    root.querySelectorAll("[data-legal-doc]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        window.zhimuGuide?.openLegalDoc?.(link.dataset.legalDoc, link.dataset.legalTitle || "法律文档");
      });
    });
    root.querySelectorAll('[data-studio-field$="Password"]').forEach((input) => {
      input.type = "password";
    });
    root.querySelector("[data-guest-upgrade]")?.addEventListener("click", async () => {
      try {
        const result = await zhimuApi.upgradeGuest({
          email: root.querySelector('[data-studio-field="upgradeEmail"]')?.value,
          displayName: root.querySelector('[data-studio-field="upgradeName"]')?.value,
          password: root.querySelector('[data-studio-field="upgradePassword"]')?.value
        });
        window.zhimuSessionAuth?.markAuthenticated?.();
        showToast("账号已升级");
        await window.zhimuAuthSession?.syncProfile?.();
        await loadCloudData(true, true);
        await refreshAccountView();
        render();
      } catch (error) {
        handleApiError(error, showToast);
      }
    });
  }

  export function bindAccountView() {
    bindAccountPanel(document);
  }

export const accountViewApi = { accountBodyHtml, refreshAccountView, bindAccountView, bindAccountPanel, openDeleteAccountWizard, openPlanUpgradeModal };
registerView("account", accountViewApi);
