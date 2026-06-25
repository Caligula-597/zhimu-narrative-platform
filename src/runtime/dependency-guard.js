/** Startup guard for legacy window-attached modules. */
(function (window) {
  const requiredAppGlobals = [
    "zhimuState",
    "zhimuViews",
    "zhimuRuntime",
    "zhimuToast",
    "zhimuDom.content",
    "zhimuDom.modalBackdrop",
    "zhimuApi",
    "zhimuFormat",
    "zhimuUserMessages"
  ];

  function hasPath(path) {
    return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), window) != null;
  }

  function missingGlobals(paths = requiredAppGlobals) {
    return paths.filter((path) => !hasPath(path));
  }

  function renderMissingGlobals(missing, target = window.zhimuDom?.content) {
    const details = missing.map((name) => `Missing ${name}`);
    const fallback = `<section class="unified-state unified-state-error">
      <h3>页面初始化失败</h3>
      <p>关键模块未加载完整，请刷新页面或检查脚本发布顺序。</p>
      <ul class="unified-state-details">${details.map((item) => `<li>${item}</li>`).join("")}</ul>
    </section>`;
    const html = window.zhimuStatus?.renderState?.({
      tone: "error",
      title: "页面初始化失败",
      message: "关键模块未加载完整，请刷新页面或检查脚本发布顺序。",
      details
    }) || fallback;
    if (target) {
      target.innerHTML = html;
    } else {
      window.console?.error?.("Zhimu startup dependencies missing:", missing);
    }
    return html;
  }

  function assertAppReady() {
    const missing = missingGlobals();
    if (missing.length) renderMissingGlobals(missing);
    return missing;
  }

  window.zhimuDependencyGuard = { requiredAppGlobals, missingGlobals, renderMissingGlobals, assertAppReady };
})(window);
export {};
