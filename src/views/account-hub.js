/** Unified account + content assets page (not modal). */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const F = window.zhimuFormat || {};
  const T = window.zhimuToast || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const showToast = T.showToast || (() => "");

  window.zhimuViews = window.zhimuViews || {};
  const exports = window.zhimuViews.accountHub = window.zhimuViews.accountHub || {};

  function activeTab() {
    return state.accountHubTab === "assets" ? "assets" : "account";
  }

  function profileIntro(me) {
    if (!me) return "";
    const isGuest = Boolean(me.isGuest);
    return `${escapeHtml(me.display_name || me.email || "已登录")}${isGuest ? " · 游客账号" : me.email ? ` · ${escapeHtml(me.email)}` : ""}${me.planLabel ? ` · ${escapeHtml(me.planLabel)}` : ""}`;
  }

  function tabButtons(tab) {
    return `<div class="account-hub-tabs" role="tablist">
      <button type="button" class="account-hub-tab ${tab === "account" ? "active" : ""}" data-action="account-hub-tab" data-hub-tab="account" role="tab" aria-selected="${tab === "account"}">账号与会话</button>
      <button type="button" class="account-hub-tab ${tab === "assets" ? "active" : ""}" data-action="account-hub-tab" data-hub-tab="assets" role="tab" aria-selected="${tab === "assets"}">内容资产</button>
    </div>`;
  }

  function assetsPanelContent() {
    if (!zhimuApi.context.worldId) {
      return `<div class="empty-state enriched-empty"><p><strong>尚未选择剧本</strong></p><p>内容资产按剧本隔离存储。请先在侧栏切换或创建剧本，再上传附件。</p><button type="button" class="primary-btn" data-action="world-library">选择剧本</button></div>`;
    }
    return window.zhimuViews?.assets?.assetsPanelHtml?.() || "";
  }

  function accountHub() {
    if (!localStorage.getItem("zhimuSessionToken")) {
      return `<section class="rules-layout account-hub-page"><article class="card" style="grid-column:1/-1"><div class="section-head"><div><h3>账号与内容资产</h3><p>登录后可管理账号、配额、云端附件与会话。</p></div></div><button type="button" class="primary-btn" data-action="open-auth">登录 / 注册</button></article></section>`;
    }
    if (state.accountViewLoading || !state.accountView) {
      void window.zhimuViews?.account?.refreshAccountView?.();
      return `<section class="rules-layout account-hub-page"><article class="card" style="grid-column:1/-1"><div class="section-head"><div><h3>账号与内容资产</h3><p>正在加载账号信息…</p></div></div></article></section>`;
    }
    const tab = activeTab();
    const me = state.accountView.me || {};
    const accountHtml = window.zhimuViews?.account?.accountBodyHtml?.(state.accountView) || "";
    const assetsHtml = tab === "assets" ? assetsPanelContent() : "";
    if (tab === "assets" && zhimuApi.context.worldId && !state.cloudAssets?.length) {
      void window.zhimuViews?.assets?.reloadAssets?.().then(() => {
        if (state.view === "account" && activeTab() === "assets") window.zhimuRender?.();
      });
    }
    return `<section class="rules-layout account-hub-page"><article class="card" style="grid-column:1/-1"><div class="section-head"><div><h3>账号与内容资产</h3><p>${profileIntro(me)}</p></div></div>${tabButtons(tab)}<div class="account-hub-panels"><section class="account-hub-panel ${tab === "account" ? "" : "hidden"}" data-hub-panel="account" role="tabpanel">${accountHtml}</section><section class="account-hub-panel ${tab === "assets" ? "" : "hidden"}" data-hub-panel="assets" role="tabpanel">${assetsHtml}</section></div></article></section>`;
  }

  async function switchAccountHubTab(tab) {
    if (tab !== "account" && tab !== "assets") return;
    state.accountHubTab = tab;
    if (tab === "assets" && zhimuApi.context.worldId) {
      await window.zhimuViews?.assets?.reloadAssets?.();
    }
    window.zhimuRender?.();
  }

  function bindAccountHubView() {
    if (state.view !== "account") return;
    const tab = activeTab();
    const root = document.querySelector(".account-hub-page");
    if (!root) return;
    if (tab === "account") window.zhimuViews?.account?.bindAccountPanel?.(root);
    if (tab === "assets" && zhimuApi.context.worldId) window.zhimuViews?.assets?.bindAssetsPanel?.(root);
  }

  async function ensureAccountHubData() {
    if (!localStorage.getItem("zhimuSessionToken")) return;
    if (!state.accountView) await window.zhimuViews?.account?.refreshAccountView?.({ background: true });
    if (activeTab() === "assets" && zhimuApi.context.worldId) await window.zhimuViews?.assets?.reloadAssets?.();
  }

  function goAccountHub(options = {}) {
    state.accountHubTab = options.tab === "assets" ? "assets" : "account";
    window.zhimuRuntime?.go?.("account");
  }

  window.zhimuAccountHub = {
    goAccountHub,
    openAccountHub: goAccountHub,
    switchAccountHubTab,
    bindAccountHubView,
    ensureAccountHubData,
    isActive: () => state.view === "account"
  };
  window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, {
    goAccountHub,
    openAccountHub: goAccountHub,
    openAccountPanel: goAccountHub
  });
  Object.assign(exports, { accountHub, bindAccountHubView, switchAccountHubTab, goAccountHub });
})(window);
export {};
