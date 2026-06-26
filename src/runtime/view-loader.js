/** View-level code splitting for the legacy window.* frontend. */
(function (window) {
  const loaded = new Set(["overview"]);
  const loading = new Map();

  const modulesByView = {
    writer: [
      () => import("../views/pipeline-wizard-session.js"),
      () => import("../views/pipeline-wizard-brief.js"),
      () => import("../views/pipeline-wizard-html.js"),
      () => import("../views/pipeline-wizard-dom.js"),
      () => import("../views/pipeline-wizard-open.js"),
      () => import("../views/pipeline-wizard.js"),
      () => import("./world-revision.js"),
      () => import("../views/writer.js"),
      () => import("./actions-writer.js")
    ],
    studio: [
      () => import("../utils/studio-scene-tree.js"),
      () => import("./world-revision.js"),
      () => import("../views/studio.js"),
      () => import("./actions-studio.js")
    ],
    clues: [
      () => import("../views/clues.js"),
      () => import("./actions-clues.js")
    ],
    rules: [
      () => import("../../rule-visual.js"),
      () => import("../views/rules.js"),
      () => import("./actions-rules.js")
    ],
    director: [
      () => import("../views/director.js"),
      () => import("./actions-director.js")
    ],
    player: [
      () => import("../views/player.js"),
      () => import("./actions-player.js")
    ],
    archive: [
      () => import("../views/archive.js"),
      () => import("./actions-archive.js")
    ],
    settings: [
      () => import("./world-revision.js"),
      () => import("../views/settings.js")
    ],
    account: [
      () => import("../views/assets.js"),
      () => import("../views/account.js"),
      () => import("../views/account-hub.js"),
      () => import("./actions-assets.js")
    ],
    ops: [
      () => import("../views/ops.js"),
      () => import("./actions-ops.js")
    ]
  };

  async function loadModuleList(view, modules) {
    for (const loadModule of modules) {
      await loadModule();
    }
    loaded.add(view);
  }

  function ensureViewModules(view) {
    if (loaded.has(view)) return Promise.resolve();
    const modules = modulesByView[view] || [];
    if (!modules.length) {
      loaded.add(view);
      return Promise.resolve();
    }
    if (!loading.has(view)) {
      loading.set(view, loadModuleList(view, modules).finally(() => loading.delete(view)));
    }
    return loading.get(view);
  }

  function isViewReady(view) {
    return loaded.has(view);
  }

  window.zhimuViewLoader = { ensureViewModules, isViewReady };
})(window);
export {};
