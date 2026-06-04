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
    settings: ["世界管理", "世界设置"]
  };

  function worldSwitcherFailureLabel() {
    const err = state.apiError || "";
    if (/Authentication|401|登录|Email or password/i.test(err)) return "登录已失效";
    if (/permission|403|权限/i.test(err)) return "无权访问该剧本";
    if (/fetch|超时|Failed|network|Network|ECONNREFUSED/i.test(err)) return "无法连接后端";
    return "剧本加载失败";
  }

  function syncWorldSwitcher() {
    const icon = document.querySelector(".world-switcher .world-icon");
    const strong = document.querySelector(".world-switcher strong");
    const small = document.querySelector(".world-switcher small");
    const studioWorld = state.cloudStudio?.world;
    const listedWorld = (state.cloudWorlds || []).find((world) => world.id === window.zhimuApi.context.worldId);
    const worldName = studioWorld?.name || listedWorld?.name;
    const bootstrapping = state.cloudLoading;

    if (bootstrapping) {
      icon.textContent = "…";
      strong.textContent = "正在连接云端…";
      small.textContent = worldName ? `读取「${worldName}」` : "读取剧本工作区";
      return;
    }
    if (!worldName) {
      icon.textContent = "云";
      const emptyAccount = state.apiError && /还没有可访问的剧本/.test(state.apiError);
      strong.textContent = emptyAccount
        ? "尚无剧本"
        : window.zhimuApi.context.worldId
          ? worldSwitcherFailureLabel()
          : "未选择剧本";
      small.textContent = emptyAccount
        ? "点击「＋ 创建新世界」开始"
        : state.apiError && !/params\/|must NOT/i.test(state.apiError)
          ? state.apiError
          : window.zhimuApi.context.worldId
            ? "点击切换剧本"
            : "点击选择或创建剧本";
      return;
    }
    icon.textContent = worldName.slice(0, 1);
    strong.textContent = worldName;
    const chapterCount = state.cloudStudio?.chapters?.length;
    small.textContent = typeof chapterCount === "number"
      ? `剧本杀创作 · ${chapterCount} 个公共章节`
      : "剧本杀创作 · 正在同步章节";
  }

  function render() {
    const [eyebrow, title] = viewMeta[state.view];
    syncWorldSwitcher();
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
      settings: V.settings.settings
    };
    content.innerHTML = views[state.view]();
    R.bindDynamic();
  }

  function go(view) {
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
  const authBannerLogin = document.querySelector("#auth-banner-login");
  if (authBannerLogin) authBannerLogin.onclick = () => R.openAuth();
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
  R.loadCloudData()
    .catch((error) => {
      state.cloudLoading = false;
      state.apiError = error.message || String(error);
      window.zhimuRender();
    })
    .finally(() => {
      window.zhimuAuthSession?.promptAuthIfNeeded?.();
    });
})(window);
export {};
