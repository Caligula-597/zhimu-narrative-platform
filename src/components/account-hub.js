/** Unified account + content assets hub (modal). Replaces separate account/assets pages. */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const { modal, modalBackdrop } = window.zhimuDom;
  const F = window.zhimuFormat || {};
  const T = window.zhimuToast || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const showToast = T.showToast || (() => {});
  const closeModal = window.zhimuModal?.closeModal || (() => {});

  let activeTab = "account";
  let hubData = null;

  function isOpen() {
    return modalBackdrop?.classList.contains("show") && modal?.classList.contains("account-hub-modal");
  }

  async function loadHubData() {
    const [me, sessions, config, entitlements] = await Promise.all([
      zhimuApi.me(),
      zhimuApi.listSessions().catch(() => ({ sessions: [] })),
      zhimuApi.getAuthConfig(),
      zhimuApi.getAccountEntitlements().catch(() => null)
    ]);
    const usage = entitlements?.usage ?? null;
    if (usage) state.storageUsage = usage;
    hubData = { me, sessions, config, usage, entitlements };
    if (zhimuApi.context.worldId) {
      await window.zhimuViews?.assets?.reloadAssets?.();
    }
    return hubData;
  }

  function tabButtons() {
    return `<div class="account-hub-tabs" role="tablist">
      <button type="button" class="account-hub-tab ${activeTab === "account" ? "active" : ""}" data-hub-tab="account" role="tab" aria-selected="${activeTab === "account"}">账号与会话</button>
      <button type="button" class="account-hub-tab ${activeTab === "assets" ? "active" : ""}" data-hub-tab="assets" role="tab" aria-selected="${activeTab === "assets"}">内容资产</button>
    </div>`;
  }

  function profileIntro(me) {
    const isGuest = Boolean(me?.isGuest);
    return `${escapeHtml(me?.display_name || me?.email || "已登录")}${isGuest ? " · 游客账号" : me?.email ? ` · ${escapeHtml(me.email)}` : ""}${me?.planLabel ? ` · ${escapeHtml(me.planLabel)}` : ""}`;
  }

  function renderHub() {
    const me = hubData?.me || {};
    const accountHtml = window.zhimuViews?.account?.accountBodyHtml?.(hubData) || "";
    const assetsHtml =
      activeTab === "assets"
        ? zhimuApi.context.worldId
          ? window.zhimuViews?.assets?.assetsPanelHtml?.() || ""
          : `<div class="empty-state enriched-empty"><p><strong>尚未选择剧本</strong></p><p>内容资产按剧本隔离存储。请先在侧栏切换或创建剧本，再上传附件。</p><button type="button" class="primary-btn" data-action="world-library">选择剧本</button></div>`
        : "";
    modal.className = "modal auth-modal account-hub-modal";
    modal.innerHTML = `<h2>账号与内容资产</h2><p class="wizard-intro">${profileIntro(me)}</p>${tabButtons()}<div class="account-hub-panels"><section class="account-hub-panel ${activeTab === "account" ? "" : "hidden"}" data-hub-panel="account" role="tabpanel">${accountHtml}</section><section class="account-hub-panel ${activeTab === "assets" ? "" : "hidden"}" data-hub-panel="assets" role="tabpanel">${assetsHtml}</section></div><div class="modal-actions"><button type="button" class="secondary-btn" data-close>关闭</button></div>`;
  }

  function bindHubActions(root) {
    root.querySelectorAll("[data-action]").forEach((el) => {
      if (el.type === "checkbox") el.onchange = () => window.zhimuHandle?.(el.dataset.action, el);
      else el.onclick = () => window.zhimuHandle?.(el.dataset.action, el);
    });
  }

  function bindHub() {
    modal.querySelector("[data-close]").onclick = closeModal;
    modal.querySelectorAll("[data-hub-tab]").forEach((btn) => {
      btn.onclick = () => void switchTab(btn.dataset.hubTab);
    });
    if (activeTab === "account") window.zhimuViews?.account?.bindAccountPanel?.(modal);
    if (activeTab === "assets" && zhimuApi.context.worldId) {
      window.zhimuViews?.assets?.bindAssetsPanel?.(modal);
    }
    bindHubActions(modal);
  }

  async function switchTab(tab) {
    if (tab === activeTab) return;
    activeTab = tab;
    if (tab === "assets" && zhimuApi.context.worldId) {
      await window.zhimuViews?.assets?.reloadAssets?.();
    }
    renderHub();
    bindHub();
  }

  async function refreshIfOpen(options = {}) {
    if (!isOpen()) return;
    if (options.tab) activeTab = options.tab;
    try {
      await loadHubData();
      renderHub();
      bindHub();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function refreshAssetsPanel() {
    if (!isOpen() || activeTab !== "assets") return;
    const panel = modal.querySelector('[data-hub-panel="assets"]');
    if (!panel) return;
    if (!zhimuApi.context.worldId) {
      panel.innerHTML = `<div class="empty-state enriched-empty"><p><strong>尚未选择剧本</strong></p><p>请先选择剧本后再管理附件。</p><button type="button" class="primary-btn" data-action="world-library">选择剧本</button></div>`;
      bindHubActions(modal);
      return;
    }
    panel.innerHTML = window.zhimuViews?.assets?.assetsPanelHtml?.() || "";
    window.zhimuViews?.assets?.bindAssetsPanel?.(modal);
    bindHubActions(modal);
  }

  async function openAccountHub(options = {}) {
    if (!localStorage.getItem("zhimuSessionToken")) {
      return window.zhimuRuntime?.openAuthForm?.();
    }
    activeTab = options.tab === "assets" ? "assets" : "account";
    modal.className = "modal auth-modal account-hub-modal";
    modal.innerHTML = `<h2>账号与内容资产</h2><p class="wizard-intro muted-note">正在加载…</p>`;
    modalBackdrop.classList.add("show");
    try {
      await loadHubData();
      renderHub();
      bindHub();
    } catch (error) {
      closeModal();
      showToast(error.message);
    }
  }

  window.zhimuAccountHub = { openAccountHub, refreshIfOpen, refreshAssetsPanel, isOpen };
  window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, {
    openAccountHub,
    openAccountPanel: openAccountHub
  });
})(window);
export {};
