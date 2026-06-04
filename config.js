(() => {
  const localHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const storedApiBase = localStorage.getItem("zhimuApiBase");
  const storedDemoMode = localStorage.getItem("zhimuDemoMode");
  const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const isViteDev = Boolean(viteEnv.DEV);
  const viteApiBase = viteEnv.VITE_API_BASE;
  const viteDemoMode = viteEnv.VITE_DEMO_MODE;
  const viteRequireAuth = viteEnv.VITE_REQUIRE_AUTH;

  // Vite dev: always same-origin /api (proxy → backend). Static server.js has no proxy → direct 4180 on localhost.
  let defaultApiBase = "/api";
  if (!isViteDev && localHost && !viteApiBase) {
    defaultApiBase = "http://localhost:4180/api";
  }

  const buildDemoMode =
    viteDemoMode === "true" ? true : viteDemoMode === "false" ? false : localHost || isViteDev;
  const requireAuth =
    viteRequireAuth === "true" ||
    (viteDemoMode === "false" && !localHost && !isViteDev);

  window.zhimuConfig = {
    apiBase: storedApiBase || viteApiBase || defaultApiBase,
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
    },
    demoWorld: {
      worldId: "08646748-e4ae-446a-a5e7-ce59ca23ffc3",
      roomId: "a65f94eb-a987-463c-bb81-aa482367e54a"
    }
  };
})();
export {};
