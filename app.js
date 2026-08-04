/** App bootstrap: routing, render shell, startup. View logic lives in src/views/*. */
import { showToast, updateNotifyBadge } from "./src/components/toast.js";
import { getViewMeta, resolveViewFn } from "./src/bootstrap/view-resolver.js";
import { initEvents } from "./src/bootstrap/events.js";
import { startApplication } from "./src/bootstrap/startup.js";
import { content, modalBackdrop } from "./src/dom.js";
import {
  claimDynamicModuleReload,
  navigationAccess
} from "./src/runtime/navigation-access.js";
import { getRuntime, registerRuntime } from "./src/runtime/runtime-facade.js";
import { callView } from "./src/runtime/view-registry.js";
import { uiStore, studioStore, userStore } from "./src/state/index.js";
import { createContentRenderer, renderPageUpdated, renderStudioLoading, renderViewError, renderViewLoading } from "./src/bootstrap/render-shell.js";
const appEntry = (function (window) {
  const startupMissing = window.zhimuDependencyGuard?.assertAppReady?.() || [];
  if (startupMissing.length) return { render: () => {}, go: () => {} };

  const R = getRuntime();

  const setContentHtml = createContentRenderer(content, () => R.bindDynamic());

  function render() {
    const currentView = uiStore.get().view;
    if (!getViewMeta(currentView)) { uiStore.set({ view: "creatorCockpit" }); return render(); }
    const [eyebrow, title] = getViewMeta(uiStore.get().view);
    // Detailed views already provide a useful no-world empty state. Do not
    // repeatedly request a Studio snapshot when a brand-new account has no
    // active world; Promise.resolve(null) would otherwise schedule render()
    // forever and freeze the page.
    const needsStudio = Boolean(
      R.viewRequiresStudio?.(currentView)
      && R.hasActiveWorld?.()
    );
    const studioState = studioStore.get();
    if (needsStudio && !studioState.cloudStudio && !studioState.studioLoading && !studioState.studioError) {
      const loadingView = currentView;
      Promise.resolve(R.ensureStudioSnapshot?.())
        .catch(() => {})
        .finally(() => {
          // View-module loading and Studio hydration run in parallel. Either
          // completion must let the still-active view leave its loading state.
          if (uiStore.get().view === loadingView) render();
        });
    }
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
          if (uiStore.get().view !== loadingView) return;
          if (uiStore.get().view === "account") window.zhimuAccountHub?.beginAccountHubLoad?.();
          render();
        })
        .catch((error) => {
          if (uiStore.get().view !== loadingView) return;
          if (claimDynamicModuleReload(error)) {
            setContentHtml(renderPageUpdated(title));
            window.setTimeout(() => window.location.reload(), 80);
            return;
          }
          setContentHtml(renderViewError(title, error));
        });
      return;
    }
    if (needsStudio && !studioStore.get().cloudStudio) {
      const studioError = studioStore.get().studioError;
      setContentHtml(studioError ? renderViewError(title, studioError) : renderStudioLoading(title));
      return;
    }
    const outage = window.zhimuServiceOutage;
    const apiError = userStore.get().apiError;
    const isOutage = outage?.isServiceOutage?.(apiError) && !studioStore.get().cloudLoading;
    const showFullOutage = isOutage && !["creatorCockpit", "account"].includes(currentView);
    const viewFn = resolveViewFn(uiStore.get().view);
    let html = showFullOutage ? outage.renderServiceOutage(apiError) : (viewFn ? viewFn() : renderViewLoading(title));
    if (isOutage && ["creatorCockpit", "account"].includes(currentView)) {
      html = (outage.renderScopedOutageBanner?.(apiError) || "") + html;
    }
    const contentChanged = setContentHtml(html);
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
    const access = navigationAccess(view, {
      authenticated: Boolean(window.zhimuAuthSession?.isLoggedIn?.()),
      authStatus: window.zhimuAuthSession?.getAuthStatus?.()?.status || ""
    });
    if (access === "checking") {
      showToast("正在确认登录状态，请稍候");
      return;
    }
    if (access === "authentication-required") {
      showToast("请先登录后再使用该功能");
      R.openAuth?.();
      return;
    }
    const sameView = uiStore.get().view === view;
    if (!sameView) {
      uiStore.set({ view });
      R.connectRoomEventStream();
      if (view === "account") window.zhimuAccountHub?.beginAccountHubLoad?.();
      if (view === "creatorCockpit") callView("creatorCockpit", "refreshCockpitData");
      render();
      return;
    }
    if (view === "account") render();
  }

  registerRuntime({ render, go });

  initEvents({ content, modalBackdrop, R, go });

  render();
  startApplication({ runtime: R, render });

  return { render, go };
})(window);

export const { render, go } = appEntry;
