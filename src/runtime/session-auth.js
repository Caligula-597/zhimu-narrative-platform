/** Cookie + localStorage Bearer; HttpOnly cookie is not visible in document.cookie. */
import { userStore } from "../state/index.js";
(function (window) {
  const LEGACY_KEY = "zhimuSessionToken";
  let cookieSessionActive = false;

  function legacyToken() {
    return localStorage.getItem(LEGACY_KEY);
  }

  function isAuthenticated() {
    return Boolean(legacyToken()) || cookieSessionActive;
  }

  function markAuthenticated(token) {
    if (typeof token === "string" && token.length >= 16) {
      localStorage.setItem(LEGACY_KEY, token);
    }
    cookieSessionActive = true;
  }

function markLoggedOut() {
  cookieSessionActive = false;
  localStorage.removeItem(LEGACY_KEY);
  if (typeof window !== "undefined") userStore.set({ currentUser: null });
}

  function authHeaders(extra = {}) {
    const headers = { ...extra };
    const legacy = legacyToken();
    if (legacy) headers.authorization = `Bearer ${legacy}`;
    return headers;
  }

  function withCredentials(init = {}) {
    return { ...init, credentials: "include" };
  }

  window.zhimuSessionAuth = {
    isAuthenticated,
    markAuthenticated,
    markLoggedOut,
    authHeaders,
    withCredentials,
    legacyToken
  };
})(window);
export {};
