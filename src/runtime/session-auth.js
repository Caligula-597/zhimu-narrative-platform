/** Cookie-first session state; legacy localStorage Bearer kept for E2E transition. */
(function (window) {
  const LEGACY_KEY = "zhimuSessionToken";
  let cookieSessionActive = false;

  function legacyToken() {
    return localStorage.getItem(LEGACY_KEY);
  }

  function isAuthenticated() {
    return cookieSessionActive || Boolean(legacyToken());
  }

  function markAuthenticated() {
    cookieSessionActive = true;
    localStorage.removeItem(LEGACY_KEY);
  }

  function markLoggedOut() {
    cookieSessionActive = false;
    localStorage.removeItem(LEGACY_KEY);
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
