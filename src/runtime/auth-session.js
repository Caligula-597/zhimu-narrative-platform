/** Session-first auth UX for staging / internal test builds. */
import * as zhimuApi from "../api/index.js";
import { userStore } from "../state/index.js";
import { callRuntime, render } from "./runtime-facade.js";
(function (window) {
  const S = () => window.zhimuSessionMode || {};

  function isLoggedIn() {
    if (userStore.get().currentUser?.id) return true;
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

  function normalizeUserPayload(payload) {
    return payload?.user?.id ? payload.user : payload;
  }

  function profileNodes() {
    const profile = document.querySelector(".profile");
    if (!profile) return {};
    return {
      strong: profile.querySelector("strong"),
      small: profile.querySelector("small"),
      avatar: profile.querySelector(".avatar")
    };
  }

  function profileFallback() {
    return S().getSessionModeMeta?.()?.profileFallback || {
      strong: "未登录",
      small: "点击登录或注册",
      avatar: "?"
    };
  }

  function updateProfileText(user) {
    const { strong, small, avatar } = profileNodes();
    if (!strong || !small || !avatar) return;
    if (!user?.id) {
      const fallback = profileFallback();
      strong.textContent = fallback.strong;
      small.textContent = fallback.small;
      avatar.textContent = fallback.avatar;
      return;
    }
    const label = user.display_name || user.email || "已登录";
    strong.textContent = label;
    small.textContent = user.isGuest ? "游客 · 点击账号与资产" : (user.email || "已登录");
    avatar.textContent = label.slice(0, 1);
  }

  function applyProfileUser(payload) {
    const user = normalizeUserPayload(payload);
    if (!user?.id) return false;
    userStore.set({ currentUser: user });
    window.zhimuSessionAuth?.markAuthenticated?.();
    updateProfileText(user);
    syncAuthBanner();
    return true;
  }

  async function syncProfile(options = {}) {
    const rerender = options.rerender !== false;
    const beforeMode = S().getSessionMode?.();
    const beforeUserId = userStore.get().currentUser?.id || "";
    try {
      const me = await zhimuApi.me();
      if (!applyProfileUser(me)) throw new Error("Invalid auth profile");
      const afterMode = S().getSessionMode?.();
      const afterUserId = userStore.get().currentUser?.id || "";
      if (rerender && (beforeMode !== afterMode || beforeUserId !== afterUserId)) render();
    } catch {
      userStore.set({ currentUser: null });
      if (window.zhimuSessionAuth?.legacyToken?.()) window.zhimuSessionAuth?.markLoggedOut?.();
      updateProfileText(null);
      syncAuthBanner();
      if (rerender && beforeMode === "authenticated") render();
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
      callRuntime("openAuth");
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
    applyProfileUser,
    promptAuthIfNeeded
  };
})(window);
export {};
