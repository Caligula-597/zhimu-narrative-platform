/** View-level code splitting for the legacy window.* frontend. */
(function (window) {
  const loaded = new Set(["creatorCockpit"]);
  const loading = new Map();

  const creatorWorkspaceModules = [
    () => import("./world-revision.js"),
    () => import("../views/creator-workspaces.js"),
    () => import("./actions-creator-workspaces.js")
  ];

  const modulesByView = {
    overview: creatorWorkspaceModules,
    constitution: [
      () => import("./world-revision.js"),
      () => import("../views/creative-constitution.js"),
      () => import("./actions-creative-constitution.js")
    ],
    diagnostics: [
      () => import("../views/story-diagnostics.js"),
      () => import("./actions-story-diagnostics.js")
    ],
    playtest: [
      () => import("../views/ai-playtest-lab.js"),
      () => import("./actions-ai-playtest.js")
    ],
    production: creatorWorkspaceModules,
    structure: creatorWorkspaceModules,
    truth: creatorWorkspaceModules,
    publish: creatorWorkspaceModules,
    insights: creatorWorkspaceModules,
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
      () => import("./world-revision.js"),
      () => import("../views/clues.js"),
      () => import("./actions-clues.js")
    ],
    rules: [
      () => import("./world-revision.js"),
      () => import("../../rule-visual.js"),
      () => import("../views/rules.js"),
      () => import("./actions-rules.js")
    ],
    miniGames: [
      () => import("./world-revision.js"),
      () => import("../views/mini-games.js"),
      () => import("./actions-mini-games.js")
    ],
    rooms: [
      () => import("../views/rooms.js")
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
      () => import("../views/account.css"),
      () => import("../views/assets.js"),
      () => import("../views/account.js"),
      () => import("../views/account-hub.js"),
      () => import("./actions-assets.js")
    ],
    ops: [
      () => import("../views/ops.css"),
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
