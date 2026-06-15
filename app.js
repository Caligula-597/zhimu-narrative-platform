/** App bootstrap: routing, render shell, event wiring. View logic lives in src/views/*. */
(function (window) {
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
    assets: ["内容创作", "内容资产"],
    rules: ["内容创作", "自动化规则"],
    director: ["实时运行", "主持监控台"],
    player: ["玩家体验", "玩家视角"],
    archive: ["历史记录", "存档与复盘"],
    settings: ["世界管理", "世界设置"],
    account: ["账号", "账号设置"]
  };

  function render() {
    const [eyebrow, title] = viewMeta[state.view];
    window.zhimuNavShell?.syncWorldSwitcher?.();
    window.zhimuNavShell?.syncNavAdvanced?.(state.view);
    document.querySelector("#page-eyebrow").textContent = eyebrow;
    document.querySelector("#page-title").textContent = title;
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === state.view));
    T.updateNotifyBadge();
    const views = {
      overview: V.overview.overview,
      writer: V.writer.writer,
      studio: V.studio.studioCloud,
      clues: V.clues.clues,
      assets: V.assets.assets,
      rules: V.rules.rules,
      director: V.director.director,
      player: V.player.player,
      archive: V.archive.archive,
      settings: V.settings.settings,
      account: V.account.account
    };
    content.innerHTML = views[state.view]();
    R.bindDynamic();
  }

  function go(view) {
    if (state.view === view) return;
    if (view === "player") window.zhimuOnboarding?.markPlayerVisit?.();
    else if (view === "director") window.zhimuOnboarding?.markDirectorVisit?.();
    state.view = view;
    R.syncDirectorPolling();
    R.connectRoomEventStream();
    render();
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
  window.zhimuAuthSession?.syncProfile?.();
  window.zhimuAuthSession?.syncAuthBanner?.();
  const startupAuth = R.handleStartupAuthParams?.();
  Promise.resolve(startupAuth)
    .then(() => R.loadCloudData())
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
