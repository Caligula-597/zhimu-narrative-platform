(() => {
  const localHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const storedApiBase = localStorage.getItem("zhimuApiBase");
  const storedDemoMode = localStorage.getItem("zhimuDemoMode");
  const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const isViteDev = Boolean(viteEnv.DEV);
  const viteApiBase = viteEnv.VITE_API_BASE;
  const viteDemoMode = viteEnv.VITE_DEMO_MODE;
  const viteRequireAuth = viteEnv.VITE_REQUIRE_AUTH;

  /** Production default API root. */
  function resolveDefaultApiBase() {
    if (viteApiBase) return viteApiBase;
    // Vite dev / nginx staging / same-origin deploy: /api (proxy or reverse proxy).
    if (isViteDev) return "/api";
    if (localHost) {
      const port = location.port;
      // node server.js --dist on :4173 has no /api proxy — talk to backend directly.
      if (port === "4173" || port === "5173") {
        return "http://localhost:4180/api";
      }
    }
    return "/api";
  }

  /** Ignore stale dev override when using Docker staging on :8080. */
  function resolveApiBase() {
    const fallback = resolveDefaultApiBase();
    if (!storedApiBase) return fallback;
    if (
      localHost &&
      location.port === "8080" &&
      /^https?:\/\/(?:localhost|127\.0\.0\.1):4180/i.test(storedApiBase)
    ) {
      return fallback;
    }
    return storedApiBase;
  }

  const buildDemoMode =
    viteDemoMode === "true" ? true : viteDemoMode === "false" ? false : localHost || isViteDev;
  const requireAuth =
    viteRequireAuth === "true" ||
    (viteDemoMode === "false" && !localHost && !isViteDev);

  window.zhimuConfig = {
    apiBase: resolveApiBase(),
    requireAuth,
    demoMode:
      storedDemoMode === null
        ? requireAuth
          ? false
          : buildDemoMode
        : storedDemoMode === "true",
    demoUsers: {
      hostUserId: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
      playerUserId: "1d5e8155-a80f-4e7f-99f0-0ae317a35f35"
    }
  };
})();
export {};
