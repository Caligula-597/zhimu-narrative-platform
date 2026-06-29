/** Unified account + content assets page (not modal). */
import * as zhimuApi from "../api/index.js";

  const state = window.zhimuState;
  const F = window.zhimuFormat || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const Status = () => window.zhimuStatus || {};

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
      return Status().empty?.("尚未选择剧本", "内容资产按剧本隔离存储。请先在侧栏切换或创建剧本，再上传附件。", {
        actions: `<button type="button" class="primary-btn" data-action="world-library">选择剧本</button>`
      }) || `<div class="empty-state enriched-empty"><p><strong>尚未选择剧本</strong></p><p>内容资产按剧本隔离存储。请先在侧栏切换或创建剧本，再上传附件。</p><button type="button" class="primary-btn" data-action="world-library">选择剧本</button></div>`;
    }
    return window.zhimuViews?.assets?.assetsPanelHtml?.() || "";
  }

  /** Load account + optional assets data once per navigation — never from accountHub() render. */
  export function beginAccountHubLoad() {
    if (!window.zhimuSessionAuth?.isAuthenticated?.()) return;
    const loadId = ++state.accountHubLoadId;
    void (async () => {
      await window.zhimuViews?.account?.refreshAccountView?.();
      if (loadId !== state.accountHubLoadId || state.view !== "account") return;
      if (activeTab() === "assets" && zhimuApi.context.worldId) {
        await window.zhimuViews?.assets?.reloadAssets?.();
        if (loadId === state.accountHubLoadId && state.view === "account") window.zhimuRuntime?.render?.();
      }
    })();
  }

  export function accountHub() {
    if (!window.zhimuSessionAuth?.isAuthenticated?.()) {
      return `<section class="rules-layout account-hub-page"><article class="card" style="grid-column:1/-1"><div class="section-head"><div><h3>账号与内容资产</h3><p>登录后可管理账号、配额、云端附件与会话。</p></div></div><button type="button" class="primary-btn" data-action="open-auth">登录 / 注册</button></article></section>`;
    }
    if (state.accountViewLoading || !state.accountView) {
      return `<section class="rules-layout account-hub-page"><article class="card" style="grid-column:1/-1">${Status().loading?.("账号与内容资产", "正在加载账号信息、套餐配额与会话记录。") || `<div class="section-head"><div><h3>账号与内容资产</h3><p>正在加载账号信息…</p></div></div>`}</article></section>`;
    }
    const tab = activeTab();
    const me = state.accountView.me || {};
    const accountHtml = window.zhimuViews?.account?.accountBodyHtml?.(state.accountView) || "";
    const assetsHtml = tab === "assets" ? assetsPanelContent() : "";
    return `<section class="rules-layout account-hub-page"><article class="card" style="grid-column:1/-1"><div class="section-head"><div><h3>账号与内容资产</h3><p>${profileIntro(me)}</p></div></div>${tabButtons(tab)}<div class="account-hub-panels"><section class="account-hub-panel ${tab === "account" ? "" : "hidden"}" data-hub-panel="account" role="tabpanel">${accountHtml}</section><section class="account-hub-panel ${tab === "assets" ? "" : "hidden"}" data-hub-panel="assets" role="tabpanel">${assetsHtml}</section></div></article></section>`;
  }

  export async function switchAccountHubTab(tab) {
    if (tab !== "account" && tab !== "assets") return;
    if (tab === state.accountHubTab) return;
    state.accountHubTab = tab;
    if (tab === "assets" && zhimuApi.context.worldId) {
      await window.zhimuViews?.assets?.reloadAssets?.();
    }
    window.zhimuRuntime?.render?.();
  }

  export function bindAccountHubView() {
    if (state.view !== "account") return;
    const tab = activeTab();
    const root = document.querySelector(".account-hub-page");
    if (!root) return;
    if (tab === "account") window.zhimuViews?.account?.bindAccountPanel?.(root);
    if (tab === "assets" && zhimuApi.context.worldId) window.zhimuViews?.assets?.bindAssetsPanel?.(root);
  }

  export function goAccountHub(options = {}) {
    state.accountHubTab = options.tab === "assets" ? "assets" : "account";
    window.zhimuRuntime?.go?.("account");
  }

  window.zhimuAccountHub = {
    goAccountHub,
    openAccountHub: goAccountHub,
    beginAccountHubLoad,
    switchAccountHubTab,
    bindAccountHubView,
    isActive: () => state.view === "account"
  };
  window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, {
    goAccountHub,
    openAccountHub: goAccountHub,
    openAccountPanel: goAccountHub
  });

// Bridge: window.zhimuViews.accountHub populated from real exports.
// Will be removed in Phase 4 when consumers migrate to direct imports.
window.zhimuViews = window.zhimuViews || {};
window.zhimuViews.accountHub = { accountHub, bindAccountHubView, switchAccountHubTab, goAccountHub, beginAccountHubLoad };
