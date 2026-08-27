const creatorWorkspaceModules = [
  () => import("../../runtime/world-revision.js"),
  () => import("../../views/creator-workspaces.js"),
  () => import("../../runtime/actions-creator-workspaces.js"),
  () => import("../../runtime/actions-writer.js")
];

export const MURDER_MYSTERY_VIEW_MODULES = Object.freeze({
  creatorCockpit: [
    () => import("../../views/creator-cockpit.js"),
    () => import("../../runtime/actions-creator-cockpit.js")
  ],
  overview: [() => import("../../views/overview.js"), ...creatorWorkspaceModules],
  diagnostics: [
    () => import("../../views/story-diagnostics.js"),
    () => import("../../runtime/actions-story-diagnostics.js")
  ],
  playtest: [
    () => import("../../views/ai-playtest-lab.js"),
    () => import("../../runtime/actions-ai-playtest.js")
  ],
  production: creatorWorkspaceModules,
  structure: creatorWorkspaceModules,
  truth: [...creatorWorkspaceModules, () => import("../../runtime/actions-bible.js")],
  publish: creatorWorkspaceModules,
  insights: creatorWorkspaceModules,
  writer: [
    () => import("../../views/writer-focus.css"),
    () => import("../../views/writer-story-assistant-workspace.css"),
    () => import("../../views/writer-opening-package-workspace.css"),
    () => import("../../runtime/world-revision.js"),
    () => import("../../views/writer.js"),
    () => import("../../runtime/actions-bible.js"),
    () => import("../../runtime/actions-writer.js")
  ],
  importSource: [
    () => import("../../views/import-source-hub.js"),
    () => import("../../runtime/actions-import-source.js")
  ],
  studio: [
    () => import("../../utils/studio-scene-tree.js"),
    () => import("../../runtime/world-revision.js"),
    () => import("../../views/studio.js"),
    () => import("../../runtime/actions-studio.js")
  ],
  clues: [
    () => import("../../runtime/world-revision.js"),
    () => import("../../views/clues.js"),
    () => import("../../runtime/actions-clues.js")
  ],
  rules: [
    () => import("../../runtime/world-revision.js"),
    () => import("../../../rule-visual.js"),
    () => import("../../views/rules.js"),
    () => import("../../runtime/actions-rules.js")
  ],
  miniGames: [
    () => import("../../runtime/world-revision.js"),
    () => import("../../views/mini-games.js"),
    () => import("../../runtime/actions-mini-games.js")
  ],
  archive: [
    () => import("../../views/archive.js"),
    () => import("../../runtime/actions-archive.js")
  ],
  settings: [
    () => import("../../runtime/world-revision.js"),
    () => import("../../views/settings.js")
  ]
});
