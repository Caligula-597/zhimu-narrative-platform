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

  async function openDeleteAccountWizard() {
    const modal = window.zhimuDom?.modal;
    const backdrop = window.zhimuDom?.modalBackdrop;
    const closeModal = window.zhimuModal?.closeModal;
    if (!modal || !backdrop || !localStorage.getItem("zhimuSessionToken")) {
      showToast("请先登录");
      return window.zhimuRuntime?.openAuth?.();
    }
    modal.className = "modal auth-modal account-delete-modal";
    modal.innerHTML = `<h2>注销账号</h2><p class="wizard-intro">正在加载影响范围…</p>`;
    backdrop.classList.add("show");
    let preview;
    try {
      preview = await zhimuApi.previewAccountDelete();
    } catch (error) {
      modal.innerHTML = `<h2>无法加载注销信息</h2><p class="wizard-intro">${escapeHtml(error.message || "请稍后重试")}</p><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
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
        localStorage.removeItem("zhimuSessionToken");
        window.zhimuContext?.onSessionLogout?.();
        state.accountView = null;
        closeModal();
        showToast("账号已永久注销");
        await window.zhimuAuthSession?.syncProfile?.();
        window.zhimuAuthSession?.syncAuthBanner?.();
        try {
          await window.zhimuLoadCloudData?.(true, true);
        } catch {
          /* logged out */
        }
        window.zhimuRender?.();
      } catch (error) {
        submit.disabled = false;
        handleApiError(error, showToast);
      }
    };
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
    return `<p class="wizard-intro">${escapeHtml(me.display_name || me.email || "已登录")}${isGuest ? " · 游客账号" : me.email ? ` · ${escapeHtml(me.email)}` : ""}${me.planLabel ? ` · ${escapeHtml(me.planLabel)}` : ""}</p>${isGuest ? `<section class="form-group"><h3>保存进度</h3><p class="muted-note">游客数据在升级前不会绑定邮箱。请点击下方注册，或使用注销删除本游客账号。</p><button class="primary-btn" data-action="open-auth">注册 / 登录</button></section>` : `${quotaHtml}${oauthButtons ? `<section class="form-group"><h3>关联登录</h3><div class="row">${oauthButtons}</div></section>` : ""}${oauthDiagHtml(data.config?.oauthDiagnostics)}`}<section class="form-group"><h3>登录设备</h3><div class="collab-list">${sessionRows}</div>${!isGuest ? `<button class="text-btn" data-logout-all>下线其他所有设备</button>` : ""}</section><section class="form-group session-actions"><h3>会话</h3><p class="muted-note">退出登录仅结束当前设备会话，账号与剧本数据仍保留。</p><button class="secondary-btn" data-auth-logout>退出登录</button></section><section class="form-group danger-zone-card"><h3>注销账号</h3><p class="muted-note">永久删除账号、你拥有的剧本与资产，<strong>不可恢复</strong>。与上方「退出登录」不同。</p><button type="button" class="danger-btn" data-open-delete-account>注销账号…</button></section>`;
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
    document.querySelector("[data-open-delete-account]")?.addEventListener("click", () => {
      void openDeleteAccountWizard();
    });
  }

  Object.assign(exports, { account, refreshAccountView, bindAccountView, openDeleteAccountWizard });
})(window);
export {};
