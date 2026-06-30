/** App bootstrap: routing, render shell, startup. View logic lives in src/views/*. */
import { updateNotifyBadge } from "./src/components/toast.js";
import { getViewMeta, resolveViewFn } from "./src/bootstrap/view-resolver.js";
import { initEvents } from "./src/bootstrap/events.js";
import { uiStore, studioStore, userStore } from "./src/state/index.js";
const appEntry = (function (window) {
  const startupMissing = window.zhimuDependencyGuard?.assertAppReady?.() || [];
  if (startupMissing.length) return { render: () => {}, go: () => {} };

  const V = window.zhimuViews;
  const R = window.zhimuRuntime;
  const { content, modalBackdrop } = window.zhimuDom;

  let renderToken = 0;
  let lastContentHtml = "";

  function setContentHtml(nextHtml) {
    if (lastContentHtml === nextHtml) return false;
    content.innerHTML = nextHtml;
    lastContentHtml = nextHtml;
    R.bindDynamic();
    return true;
  }

  function renderViewLoading(title) {
    return window.zhimuStatus?.loading?.(title, "正在加载该功能模块，请稍候。", { kicker: "MODULE" }) ||
      `<section class="card" style="grid-column:1/-1"><div class="section-head"><div><h3>${title}</h3><p>正在加载该功能模块...</p></div></div></section>`;
  }

  function renderViewError(title, error) {
    const actions = `<button class="primary-btn" data-action="retry-view-module">重新加载</button><button class="secondary-btn" data-action="open-error-guide">错误排查手册</button>`;
    return window.zhimuStatus?.error?.(title, error, { kicker: "MODULE ERROR", actions, fallback: "功能模块加载失败，请刷新后重试。" }) ||
      `<section class="card" style="grid-column:1/-1"><div class="section-head"><div><h3>${title}</h3><p>${error?.message || "功能模块加载失败"}</p></div></div></section>`;
  }

  function render() {
    const currentToken = ++renderToken;
    const currentView = uiStore.get().view;
    if (!getViewMeta(currentView)) { uiStore.set({ view: "overview" }); return render(); }
    const [eyebrow, title] = getViewMeta(uiStore.get().view);
    window.zhimuNavShell?.syncWorldSwitcher?.();
    window.zhimuNavShell?.syncNavAdvanced?.(uiStore.get().view);
    document.querySelector("#page-eyebrow").textContent = eyebrow;
    document.querySelector("#page-title").textContent = title;
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === uiStore.get().view));
    updateNotifyBadge();
    const loader = window.zhimuViewLoader;
    if (loader && !loader.isViewReady?.(uiStore.get().view)) {
      const loadingView = uiStore.get().view;
      setContentHtml(renderViewLoading(title));
      loader.ensureViewModules(loadingView)
        .then(() => {
          if (currentToken !== renderToken || uiStore.get().view !== loadingView) return;
          if (uiStore.get().view === "account") window.zhimuAccountHub?.beginAccountHubLoad?.();
          render();
        })
        .catch((error) => {
          if (currentToken !== renderToken || uiStore.get().view !== loadingView) return;
          setContentHtml(renderViewError(title, error));
        });
      return;
    }
    const outage = window.zhimuServiceOutage;
    const showOutage = outage?.isServiceOutage?.(userStore.get().apiError) && !studioStore.get().cloudLoading;
    const viewFn = resolveViewFn(uiStore.get().view, V);
    const contentChanged = setContentHtml(showOutage ? outage.renderServiceOutage(userStore.get().apiError) : (viewFn ? viewFn() : renderViewLoading(title)));
    if (contentChanged && ["settings", "studio", "writer"].includes(uiStore.get().view)) {
      queueMicrotask(() => {
        const scope = window.zhimuWorldRevision?.resolveDraftScope?.();
        window.zhimuWorldRevision?.watchDirtyInputs?.(document, scope);
        window.zhimuWorldRevision?.promptDraftRestore?.(document, scope);
      });
    }
  }

  function go(view) {
    if (view === "assets") {
      uiStore.set({ accountHubTab: "assets" });
      view = "account";
    }
    if (view === "director") {
      window.open(window.zhimuInviteLinks?.hostConsoleUrl?.(), "_blank", "noopener,noreferrer");
      return;
    }
    if (view === "player") {
      const room = window.zhimuUi.activeRuntimeRoom?.();
      window.open(window.zhimuInviteLinks?.playerJoinUrl?.(room?.invite_code), "_blank", "noopener,noreferrer");
      return;
    }
    if (!getViewMeta(view)) view = "overview";
    const sameView = uiStore.get().view === view;
    if (!sameView) {
      uiStore.set({ view });
      R.syncDirectorPolling();
      R.connectRoomEventStream();
      if (view === "account") window.zhimuAccountHub?.beginAccountHubLoad?.();
      render();
      return;
    }
    if (view === "account") render();
  }

  window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, { render, go });

  initEvents({ content, modalBackdrop, R, go });

  render();
  const startupAuth = R.handleStartupAuthParams?.();
  Promise.resolve(startupAuth)
    .then(() => window.zhimuSessionReady)
    .then(async () => {
      await window.zhimuAuthSession?.syncProfile?.();
      window.zhimuAuthSession?.syncAuthBanner?.();
      return R.loadCloudData();
    })
    .catch((error) => {
      studioStore.set({ cloudLoading: false });
      userStore.set({ apiError: error.message || String(error) });
      render();
    })
    .finally(() => {
      if (!window.zhimuAuthSession?.isLoggedIn?.()) {
        window.zhimuAuthSession?.promptAuthIfNeeded?.();
      }
    });

  return { render, go };
})(window);

export const { render, go } = appEntry;
