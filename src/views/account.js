/* Account settings page — quota, sessions, OAuth, auth actions. */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const F = window.zhimuFormat || {};
  const T = window.zhimuToast || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatTime = F.formatTime || (() => "");
  const showToast = T.showToast || (() => "");
  const handleApiError = window.zhimuUserMessages?.handleApiErrorToast || ((err, toast) => toast(err?.message || "操作失败"));

  window.zhimuViews = window.zhimuViews || {};
  const exports = window.zhimuViews.account = window.zhimuViews.account || {};

  function accountShell(body, loading = false) {
    return `<section class="rules-layout"><article class="card" style="grid-column:1/-1"><div class="section-head"><div><h3>账号设置</h3><p>登录身份、套餐配额、OAuth 与多设备管理</p></div></div>${loading ? `<p class="muted-note">正在加载账号信息…</p>` : body}</article></section>`;
  }

  function oauthDiagHtml(diag) {
    if (!diag?.providers?.length) return "";
    const rows = diag.providers.map((p) => {
      const status = p.enabled ? (p.issues?.length ? "待修复" : "已启用") : "未配置";
      const pill = p.enabled && !p.issues?.length ? "cloud-pill" : "cloud-pill muted";
      const callback = p.callbackUrl ? `<p class="muted-note" style="margin-top:6px;word-break:break-all">回调：${escapeHtml(p.callbackUrl)}</p>` : "";
      const issues = (p.issues || []).map((i) => `<li>${escapeHtml(i.message)}</li>`).join("");
      return `<div class="collab-row"><div><b>${escapeHtml(p.label)}</b><p>${status}</p>${callback}${issues ? `<ul class="muted-note">${issues}</ul>` : ""}</div><span class="${pill}">${p.enabled ? "ON" : "OFF"}</span></div>`;
    }).join("");
    const global = (diag.globalIssues || []).map((i) => `<li>${escapeHtml(i.message)}</li>`).join("");
    return `<section class="form-group" style="margin-top:18px"><h3>OAuth 状态</h3>${global ? `<ul class="muted-note">${global}</ul>` : ""}<div class="collab-list">${rows}</div><p class="muted-note">生产环境请在 Google/GitHub 控制台登记上方回调 URL，并配置 APP_PUBLIC_URL。</p></section>`;
  }

  function accountBody(data) {
    const me = data.me || {};
    const sessions = data.sessions?.sessions || [];
    const oauth = data.config?.oauth || [];
    const usage = data.usage;
    const isGuest = Boolean(me.isGuest);
    const sessionRows = sessions.map((s) => `<div class="collab-row"><div><b>${escapeHtml(s.deviceLabel || "未知设备")}</b><p>${escapeHtml(s.userAgent || "—")} · 最近 ${formatTime(s.lastSeenAt)}</p></div>${s.isCurrent ? `<span class="cloud-pill">当前</span>` : `<button class="text-btn danger-text" data-revoke-session="${s.id}">下线</button>`}</div>`).join("") || `<div class="empty-state">暂无其他设备记录</div>`;
    const oauthButtons = oauth.map((p) => `<button class="secondary-btn" data-oauth-start="${p.id}">关联 ${escapeHtml(p.label)}</button>`).join("");
    const quotaHtml = window.zhimuRuntime?.renderQuotaSection?.(usage) || "";
    return `<p class="wizard-intro">${escapeHtml(me.display_name || me.email || "已登录")}${isGuest ? " · 游客账号" : me.email ? ` · ${escapeHtml(me.email)}` : ""}${me.planLabel ? ` · ${escapeHtml(me.planLabel)}` : ""}</p>${isGuest ? `<section class="form-group"><h3>保存进度</h3><p class="muted-note">游客数据在升级前不会绑定邮箱。请点击右上角头像或下方按钮注册。</p><button class="primary-btn" data-action="open-auth">注册 / 登录</button></section>` : `${quotaHtml}${oauthButtons ? `<section class="form-group"><h3>关联登录</h3><div class="row">${oauthButtons}</div></section>` : ""}${oauthDiagHtml(data.config?.oauthDiagnostics)}`}<section class="form-group"><h3>登录设备</h3><div class="collab-list">${sessionRows}</div>${!isGuest ? `<button class="text-btn" data-logout-all>下线其他所有设备</button>` : ""}</section><div class="row" style="margin-top:16px"><button class="danger-btn" data-auth-logout>退出登录</button></div>`;
  }

  function account() {
    if (!localStorage.getItem("zhimuSessionToken")) {
      return accountShell(`<p class="muted-note">登录后可管理账号、配额与会话。</p><button class="primary-btn" data-action="open-auth">登录 / 注册</button>`);
    }
    if (state.accountViewLoading) {
      return accountShell("", true);
    }
    if (!state.accountView) {
      void refreshAccountView();
      return accountShell("", true);
    }
    return accountShell(accountBody(state.accountView));
  }

  async function refreshAccountView(options = {}) {
    const background = Boolean(options.background);
    const showLoading = !background && !state.accountView;
    if (showLoading) {
      state.accountViewLoading = true;
      window.zhimuRender?.();
    }
    try {
      const [me, sessions, config, entitlements] = await Promise.all([
        zhimuApi.me(),
        zhimuApi.listSessions().catch(() => ({ sessions: [] })),
        zhimuApi.getAuthConfig(),
        zhimuApi.getAccountEntitlements().catch(() => null)
      ]);
      const usage = entitlements?.usage ?? null;
      if (usage) state.storageUsage = usage;
      state.accountView = { me, sessions, config, usage, entitlements };
    } catch (error) {
      if (!background) {
        state.accountView = null;
        showToast(error.message);
      }
    } finally {
      state.accountViewLoading = false;
      if (state.view === "account") window.zhimuRender?.();
    }
  }

  function bindAccountView() {
    if (state.view !== "account") return;
    document.querySelector("[data-auth-logout]")?.addEventListener("click", async () => {
      try {
        await zhimuApi.logout();
        localStorage.removeItem("zhimuSessionToken");
        window.zhimuContext?.onSessionLogout?.();
        showToast("已退出登录");
        await window.zhimuAuthSession?.syncProfile?.();
        window.zhimuAuthSession?.syncAuthBanner?.();
        window.zhimuRender?.();
      } catch (error) {
        handleApiError(error, showToast);
      }
    });
    document.querySelector("[data-logout-all]")?.addEventListener("click", async () => {
      try {
        await zhimuApi.logoutAllDevices();
        showToast("已下线其他设备");
        await refreshAccountView();
      } catch (error) {
        handleApiError(error, showToast);
      }
    });
    document.querySelectorAll("[data-revoke-session]").forEach((btn) => {
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
    document.querySelectorAll("[data-oauth-start]").forEach((btn) => {
      btn.onclick = async () => {
        try {
          const { url } = await zhimuApi.oauthStartUrl(btn.dataset.oauthStart);
          window.location.href = url;
        } catch (error) {
          handleApiError(error, showToast);
        }
      };
    });
  }

  Object.assign(exports, { account, refreshAccountView, bindAccountView });
})(window);
export {};
