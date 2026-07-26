/** Cookie + tab-scoped bearer fallback; HttpOnly cookie remains authoritative. */
import { userStore } from "../state/index.js";
(function (window) {
  const LEGACY_KEY = "zhimuSessionToken";
  let cookieSessionActive = false;
  let storageSyncPromise = null;
  let credentialVersion = 0;

  function clearPersistentLegacyToken() {
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Persistent storage may be unavailable; session/cookie auth still works.
    }
  }

  function legacyToken() {
    try {
      return sessionStorage.getItem(LEGACY_KEY);
    } catch {
      return null;
    }
  }

  function isAuthenticated() {
    return Boolean(legacyToken()) || cookieSessionActive;
  }

  function markAuthenticated(token) {
    clearPersistentLegacyToken();
    if (typeof token === "string" && token.length >= 16) {
      try { sessionStorage.setItem(LEGACY_KEY, token); } catch { /* cookie session remains authoritative */ }
    }
    cookieSessionActive = true;
    credentialVersion += 1;
  }

  function discardLegacyToken() {
    clearPersistentLegacyToken();
    if (!legacyToken()) return false;
    try { sessionStorage.removeItem(LEGACY_KEY); } catch { return false; }
    credentialVersion += 1;
    return true;
  }

  function markLoggedOut() {
    cookieSessionActive = false;
    credentialVersion += 1;
    try { sessionStorage.removeItem(LEGACY_KEY); } catch { /* storage may be unavailable */ }
    clearPersistentLegacyToken();
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

  clearPersistentLegacyToken();

  window.zhimuSessionAuth = {
    isAuthenticated,
    markAuthenticated,
    markLoggedOut,
    discardLegacyToken,
    authHeaders,
    withCredentials,
    legacyToken,
    getCredentialVersion: () => credentialVersion
  };

  window.addEventListener?.("storage", (event) => {
    if (event?.key !== LEGACY_KEY || event.newValue === event.oldValue) return;
    if (event.storageArea && event.storageArea === localStorage) {
      clearPersistentLegacyToken();
      return;
    }
    if (event.storageArea && event.storageArea !== sessionStorage) return;
    if (!event.newValue) markLoggedOut();
    else credentialVersion += 1;
    if (storageSyncPromise) return;
    storageSyncPromise = Promise.resolve().then(() => window.zhimuAuthSession?.syncProfile?.({ force: true }))
      .finally(() => { storageSyncPromise = null; });
  });
})(window);
export {};
