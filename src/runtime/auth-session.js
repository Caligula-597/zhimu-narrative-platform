/** Session-first auth UX for staging / internal test builds. */
(function (window) {
  const state = window.zhimuState;

  function isLoggedIn() {
    return Boolean(localStorage.getItem("zhimuSessionToken"));
  }

  function requiresAuth() {
    return Boolean(window.zhimuConfig?.requireAuth);
  }

  function syncAuthBanner() {
    const banner = document.getElementById("auth-banner");
    if (!banner) return;
    const show = requiresAuth() && !isLoggedIn();
    banner.hidden = !show;
  }

  async function syncProfile() {
    const profile = document.querySelector(".profile");
    if (!profile) return;
    const strong = profile.querySelector("strong");
    const small = profile.querySelector("small");
    const avatar = profile.querySelector(".avatar");
    if (!strong || !small || !avatar) return;

    if (!isLoggedIn()) {
      if (requiresAuth()) {
        strong.textContent = "未登录";
        small.textContent = "点击登录或注册";
        avatar.textContent = "?";
      } else if (window.zhimuConfig?.demoMode) {
        strong.textContent = "未登录";
        small.textContent = "点击登录或注册";
        avatar.textContent = "?";
      }
      return;
    }

    try {
      const me = await window.zhimuApi.me();
      state.currentUser = me;
      const label = me.display_name || me.email || "已登录";
      strong.textContent = label;
      small.textContent = me.isGuest ? "游客 · 点击升级或管理设备" : (me.email || "已登录");
      avatar.textContent = label.slice(0, 1);
    } catch {
      /* session may have expired — client.js clears token on 401 */
    }
  }

  function promptAuthIfNeeded(force = false) {
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
    return Boolean(window.zhimuConfig?.demoMode) && !isLoggedIn();
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
