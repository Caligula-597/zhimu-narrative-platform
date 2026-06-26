/** App bootstrap: routing, render shell, event wiring. View logic lives in src/views/*. */
(function (window) {
  const startupMissing = window.zhimuDependencyGuard?.assertAppReady?.() || [];
  if (startupMissing.length) return;

  const state = window.zhimuState;
  const V = window.zhimuViews;
  const R = window.zhimuRuntime;
  const T = window.zhimuToast;
  const { content, modalBackdrop } = window.zhimuDom;

  const viewMeta = {
    overview: ["世界工作区", "世界总览"],
    writer: ["剧本杀创作", "创作者工作台"],
    studio: ["内容创作", "剧情编排"],
    clues: ["内容创作", "线索管理"],
    rules: ["内容创作", "自动化规则"],
    director: ["实时运行", "主持监控台"],
    player: ["玩家体验", "玩家视角"],
    archive: ["历史记录", "存档与复盘"],
    settings: ["世界管理", "世界设置"],
    account: ["账号", "账号与资产"],
    ops: ["OPS", "运营控制台"]
  };

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

  function resolveViewFn(view) {
    const views = {
      overview: V.overview?.overview,
      writer: V.writer?.writer,
      studio: V.studio?.studioCloud,
      clues: V.clues?.clues,
      rules: V.rules?.rules,
      director: V.director?.director,
      player: V.player?.player,
      archive: V.archive?.archive,
      settings: V.settings?.settings,
      account: V.accountHub?.accountHub,
      ops: V.ops?.ops
    };
    return views[view];
  }

  function render() {
    const currentToken = ++renderToken;
    const [eyebrow, title] = viewMeta[state.view];
    window.zhimuNavShell?.syncWorldSwitcher?.();
    window.zhimuNavShell?.syncNavAdvanced?.(state.view);
    document.querySelector("#page-eyebrow").textContent = eyebrow;
    document.querySelector("#page-title").textContent = title;
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === state.view));
    T.updateNotifyBadge();
    const loader = window.zhimuViewLoader;
    if (loader && !loader.isViewReady?.(state.view)) {
      const loadingView = state.view;
      setContentHtml(renderViewLoading(title));
      loader.ensureViewModules(loadingView)
        .then(() => {
          if (currentToken !== renderToken || state.view !== loadingView) return;
          if (state.view === "account") window.zhimuAccountHub?.beginAccountHubLoad?.();
          render();
        })
        .catch((error) => {
          if (currentToken !== renderToken || state.view !== loadingView) return;
          setContentHtml(renderViewError(title, error));
        });
      return;
    }
    const outage = window.zhimuServiceOutage;
    const showOutage = outage?.isServiceOutage?.(state.apiError) && !state.cloudLoading;
    const viewFn = resolveViewFn(state.view);
    const contentChanged = setContentHtml(showOutage ? outage.renderServiceOutage(state.apiError) : (viewFn ? viewFn() : renderViewLoading(title)));
    if (contentChanged && ["settings", "studio", "writer"].includes(state.view)) {
      queueMicrotask(() => {
        const scope = window.zhimuWorldRevision?.resolveDraftScope?.();
        window.zhimuWorldRevision?.watchDirtyInputs?.(document, scope);
        window.zhimuWorldRevision?.promptDraftRestore?.(document, scope);
      });
    }
  }

  function go(view) {
    if (view === "assets") {
      state.accountHubTab = "assets";
      view = "account";
    }
    const sameView = state.view === view;
    if (!sameView) {
      if (view === "player") window.zhimuOnboarding?.markPlayerVisit?.();
      else if (view === "director") window.zhimuOnboarding?.markDirectorVisit?.();
      state.view = view;
      R.syncDirectorPolling();
      R.connectRoomEventStream();
      if (view === "account") window.zhimuAccountHub?.beginAccountHubLoad?.();
      render();
      return;
    }
    if (view === "account") render();
  }

  window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, { render, go });

  content.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-go]");
    if (nav) {
      event.preventDefault();
      go(nav.dataset.go);
    }
  });

  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => btn.addEventListener("click", () => go(btn.dataset.view)));
  document.querySelector("#run-btn").onclick = () => go("director");
  document.querySelector("#preview-btn").onclick = () => (state.cloudPlayer ? go("player") : R.openJoinRoom());
  document.querySelector("#search-btn").onclick = () => window.zhimuGlobalSearch?.openGlobalSearch?.();
  document.querySelector("#auth-banner-login")?.addEventListener("click", () => R.openAuth());
  document.querySelector("#notify-btn").onclick = () => {
    if (!window.zhimuUi.activeRuntimeRoom()) return T.showToast("请先选择运行房后再查看主持待办");
    go("director");
    if (!T.pendingHostEventCount()) T.showToast("当前没有待确认事件，可在此刷新玩家进度");
  };
  document.querySelector("#create-world-btn").onclick = () => R.openWizard();
  document.querySelector("#catalog-world-btn")?.addEventListener("click", () => R.openWorldLibrary("catalog"));
  document.querySelector(".world-switcher").onclick = () => R.openWorldLibrary();
  document.querySelector(".profile").onclick = () => R.openAuth();
  modalBackdrop.onclick = (e) => {
    if (e.target === modalBackdrop) window.zhimuModal.closeModal();
  };

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
      state.cloudLoading = false;
      state.apiError = error.message || String(error);
      window.zhimuRender();
    })
    .finally(() => {
      if (!window.zhimuAuthSession?.isLoggedIn?.()) {
        window.zhimuAuthSession?.promptAuthIfNeeded?.();
      }
    });
})(window);
export {};
