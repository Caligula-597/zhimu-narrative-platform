(() => {
  const localHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const storedApiBase = localStorage.getItem("zhimuApiBase");
  const storedDemoMode = localStorage.getItem("zhimuDemoMode");
  const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const isViteDev = Boolean(viteEnv.DEV);
  const viteApiBase = viteEnv.VITE_API_BASE;
  const viteDemoMode = viteEnv.VITE_DEMO_MODE;
  const viteRequireAuth = viteEnv.VITE_REQUIRE_AUTH;
  const vitePlayOrigin = viteEnv.VITE_PLAY_SITE_ORIGIN || viteEnv.VITE_PLAY_ORIGIN;
  const viteHostOrigin = viteEnv.VITE_HOST_SITE_ORIGIN || viteEnv.VITE_HOST_ORIGIN;

  /** Production default API root. */
  function resolveDefaultApiBase() {
    if (viteApiBase) return viteApiBase;
    // Vite, the standalone dist server, nginx, and the full-stack deployment
    // all expose the API through the same-origin /api boundary.
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
    playSiteOrigin: vitePlayOrigin || (localHost ? "http://127.0.0.1:5174" : "https://play.getzhimu.com"),
    hostSiteOrigin: viteHostOrigin || (localHost ? "http://127.0.0.1:5175" : "https://host.getzhimu.com"),
    demoUsers: {
      hostUserId: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
      playerUserId: "1d5e8155-a80f-4e7f-99f0-0ae317a35f35"
    }
  };
})();
export {};
