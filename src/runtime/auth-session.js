/** Session-first auth UX for staging / internal test builds. */
(function (window) {
  const state = window.zhimuState;
  const S = () => window.zhimuSessionMode || {};

  function isLoggedIn() {
    return S().isLoggedIn?.() ?? window.zhimuSessionAuth?.isAuthenticated?.() ?? false;
  }

  function requiresAuth() {
    return S().requiresAuth?.() ?? Boolean(window.zhimuConfig?.requireAuth);
  }

  function syncAuthBanner() {
    const banner = document.getElementById("auth-banner");
    if (!banner) return;
    const meta = S().getSessionModeMeta?.() || { showTopBanner: false };
    const show = meta.showTopBanner && !isLoggedIn();
    banner.hidden = !show;
    if (!show) return;
    const pill = banner.querySelector("[data-session-pill]");
    const title = banner.querySelector("[data-session-title]");
    const desc = banner.querySelector("[data-session-desc]");
    const loginBtn = banner.querySelector("#auth-banner-login");
    if (pill) {
      pill.textContent = meta.pill;
      pill.className = `cloud-pill session-pill ${meta.pillClass || ""}`;
      pill.hidden = false;
    }
    if (title) title.textContent = meta.title;
    if (desc) desc.textContent = meta.description;
    if (loginBtn) loginBtn.hidden = !meta.showLoginCta;
    banner.dataset.sessionMode = meta.mode;
  }

  async function syncProfile() {
    const profile = document.querySelector(".profile");
    if (!profile) return;
    const strong = profile.querySelector("strong");
    const small = profile.querySelector("small");
    const avatar = profile.querySelector(".avatar");
    if (!strong || !small || !avatar) return;

    if (!isLoggedIn()) {
      const fallback = S().getSessionModeMeta?.()?.profileFallback || {
        strong: "未登录",
        small: "点击登录或注册",
        avatar: "?"
      };
      strong.textContent = fallback.strong;
      small.textContent = fallback.small;
      avatar.textContent = fallback.avatar;
      return;
    }

    try {
      const me = await window.zhimuApi.me();
      state.currentUser = me;
      const label = me.display_name || me.email || "已登录";
      strong.textContent = label;
      small.textContent = me.isGuest ? "游客 · 点击账号与资产" : (me.email || "已登录");
      avatar.textContent = label.slice(0, 1);
    } catch {
      /* session may have expired — client.js clears token on 401 */
    }
  }

  function promptAuthIfNeeded(force = false) {
    const mode = S().getSessionMode?.();
    if (mode === "demo_browse" && !force) return false;
    if (!requiresAuth() && !force) return false;
    if (isLoggedIn()) return false;
    syncAuthBanner();
    const key = "zhimuAuthPrompted";
    if (force || !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      window.zhimuRuntime?.openAuth?.();
    }
    return true;
  }

  function isDemoBrowseMode() {
    return S().isDemoBrowseMode?.() ?? (Boolean(window.zhimuConfig?.demoMode) && !isLoggedIn());
  }

  window.zhimuAuthSession = {
    isLoggedIn,
    requiresAuth,
    isDemoBrowseMode,
    syncAuthBanner,
    syncProfile,
    promptAuthIfNeeded
  };
})(window);
export {};
