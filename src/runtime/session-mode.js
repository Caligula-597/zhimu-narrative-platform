/** Unified guest / demo / logged-in session labels for UI copy. */
(function (window) {
  function isLoggedIn() {
    if (window.zhimuState?.currentUser?.id) return true;
    return window.zhimuSessionAuth?.isAuthenticated?.() ?? false;
  }

  function requiresAuth() {
    return Boolean(window.zhimuConfig?.requireAuth);
  }

  function isDemoBrowseMode() {
    return Boolean(window.zhimuConfig?.demoMode) && !isLoggedIn();
  }

  /** @returns {"authenticated"|"demo_browse"|"auth_required"} */
  function getSessionMode() {
    if (isLoggedIn()) return "authenticated";
    if (isDemoBrowseMode()) return "demo_browse";
    if (requiresAuth()) return "auth_required";
    return "auth_required";
  }

  function getSessionModeMeta(mode = getSessionMode()) {
    switch (mode) {
      case "authenticated":
        return {
          mode,
          pill: "已登录",
          pillClass: "session-ok",
          title: "",
          description: "",
          profileFallback: { strong: "已登录", small: "点击账号与资产", avatar: "我" },
          showTopBanner: false,
          showLoginCta: false
        };
      case "demo_browse":
        return {
          mode,
          pill: "演示体验",
          pillClass: "session-demo",
          title: "演示体验 · 数据来自公开示例剧本",
          description: "你可以完整浏览玩家端与主持台；登录后可创建和管理自己的剧本世界。",
          profileFallback: { strong: "演示体验", small: "公开示例 · 登录后可创作", avatar: "演" },
          showTopBanner: true,
          showLoginCta: true
        };
      default:
        return {
          mode: "auth_required",
          pill: "未登录",
          pillClass: "session-auth",
          title: "请登录后继续使用",
          description: "登录后可保存剧本、邀请协作并记录运行数据。",
          profileFallback: { strong: "未登录", small: "点击登录或注册", avatar: "?" },
          showTopBanner: true,
          showLoginCta: true
        };
    }
  }

  function sessionPillHtml(meta = getSessionModeMeta()) {
    if (meta.mode === "authenticated") return "";
    return `<span class="cloud-pill session-pill ${meta.pillClass}">${meta.pill}</span>`;
  }

  function sessionStripHtml(options = {}) {
    const meta = getSessionModeMeta();
    if (meta.mode === "authenticated" && !options.force) return "";
    const loginBtn = meta.showLoginCta
      ? `<button class="primary-btn" data-action="open-auth">登录 / 注册</button>`
      : "";
    const extra = options.extraActions || "";
    return `<section class="demo-strip session-mode-strip" data-session-mode="${meta.mode}"><div>${sessionPillHtml(meta)}<strong style="margin-top:7px">${meta.title}</strong><p>${meta.description}</p></div><div class="row">${extra}${loginBtn}</div></section>`;
  }

  window.zhimuSessionMode = {
    isLoggedIn,
    requiresAuth,
    isDemoBrowseMode,
    getSessionMode,
    getSessionModeMeta,
    sessionPillHtml,
    sessionStripHtml
  };
})(window);
export {};
