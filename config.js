(() => {
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const storedApiBase = localStorage.getItem("zhimuApiBase");
  const storedDemoMode = localStorage.getItem("zhimuDemoMode");
  window.zhimuConfig = {
    apiBase: storedApiBase || (local ? "http://localhost:4180/api" : "/api"),
    demoMode: storedDemoMode === null ? local : storedDemoMode === "true",
    demoUsers: {
      hostUserId: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
      playerUserId: "1d5e8155-a80f-4e7f-99f0-0ae317a35f35"
    },
    demoWorld: {
      worldId: "e0370ac3-65d4-4de1-89e3-d54ed51fa72a",
      roomId: "a65f94eb-a987-463c-bb81-aa482367e54a"
    }
  };
})();
