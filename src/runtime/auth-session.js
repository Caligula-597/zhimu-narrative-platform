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
        strong.textContent = "演示 · 沈舟";
        small.textContent = "未登录 · 共享示例剧本";
        avatar.textContent = "演";
      }
      return;
    }

    try {
      const me = await window.zhimuApi.me();
      state.currentUser = me;
      const label = me.display_name || me.email || "已登录";
      strong.textContent = label;
      small.textContent = requiresAuth() ? "内测账号" : "演示 + 账号";
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

  window.zhimuAuthSession = {
    isLoggedIn,
    requiresAuth,
    syncAuthBanner,
    syncProfile,
    promptAuthIfNeeded
  };
})(window);
export {};
