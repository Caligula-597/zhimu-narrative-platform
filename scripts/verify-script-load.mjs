/**
 * Verify all frontend scripts load in index.html order without SyntaxError.
 *
 * Migrated from vm.runInNewContext to native dynamic import() so real ES
 * module files (with `import` / `export function`) are parsed by Node's ESM
 * loader.  Browser globals are shimmed on globalThis so module-load-time
 * references to window/document/localStorage don't throw.
 *
 * Usage: node scripts/verify-script-load.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load order mirrors frontend/main.js.  src/api/index.js transitively imports
// client.js + all domain modules, so it replaces the old client.js entry.
const files = [
  "config.js",
  "src/dom.js",
  "src/state.js",
  "src/utils/user-messages.js",
  "src/utils/wizard-automation-templates.js",
  "src/runtime/session-auth.js",
  "src/api/index.js",
  "src/runtime/ai-draft-store.js",
  "src/utils/format.js",
  "src/runtime/session-mode.js",
  "src/components/onboarding-strip.js",
  "src/components/first-run-chooser.js",
  "src/runtime/nav-shell.js",
  "src/components/status-ui.js",
  "src/components/ui-semantics.js",
  "src/runtime/dependency-guard.js",
  "src/components/service-outage.js",
  "src/components/emptyState.js",
  "src/components/toast.js",
  "src/components/modal.js",
  "src/components/creator-guide.js",
  "src/components/collapse-panel.js",
  "src/views/overview.js",
  "src/runtime/wizard.js",
  "src/runtime/auth-session.js",
  "src/runtime/workspace-store.js",
  "src/runtime/runtime-store.js",
  "src/runtime/context-coordinator.js",
  "src/runtime/account-quota.js",
  "src/runtime/room-events.js",
  "src/runtime/invite-links.js",
  "src/runtime/auth-world.js",
  "src/runtime/view-loader.js",
  "src/runtime/actions-workspace.js",
  "src/runtime/global-search.js",
  "src/runtime/search-focus.js",
  "src/runtime/livekit-voice.js",
  "src/runtime/data.js",
  "src/runtime/actions.js",
  "app.js",
  "src/utils/studio-scene-tree.js",
  "rule-visual.js",
  "src/views/pipeline-wizard-session.js",
  "src/views/pipeline-wizard-brief.js",
  "src/views/pipeline-wizard-html.js",
  "src/views/pipeline-wizard-dom.js",
  "src/views/pipeline-wizard-open.js",
  "src/views/pipeline-wizard.js",
  "src/views/writer.js",
  "src/views/studio.js",
  "src/views/clues.js",
  "src/views/assets.js",
  "src/views/rules.js",
  "src/views/director.js",
  "src/views/player.js",
  "src/views/archive.js",
  "src/views/settings.js",
  "src/views/account-hub.js",
  "src/views/account.js",
  "src/runtime/actions-archive.js",
  "src/runtime/actions-player.js",
  "src/runtime/actions-director.js",
  "src/runtime/actions-studio.js",
  "src/runtime/actions-writer.js",
  "src/runtime/actions-rules.js",
  "src/runtime/actions-assets.js",
  "src/runtime/actions-clues.js",
  "src/runtime/world-revision.js"
];

/* ── Browser global shims ── */
function setupGlobalShims() {
  const noop = () => {};
  const storage = {
    getItem: () => null,
    setItem: noop,
    removeItem: noop,
    clear: noop
  };

  const fakeElement = {
    textContent: "",
    innerHTML: "",
    className: "",
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    onclick: null,
    dataset: {},
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: noop,
    setAttribute: noop,
    style: {}
  };

  globalThis.window = {
    zhimuConfig: {
      apiBase: "http://localhost:4180/api",
      demoMode: true,
      demoUsers: {},
      demoWorld: {}
    },
    __ZHIMU_ENABLE_TEST_STATE__: true,
    zhimuApi: null,
    location: { pathname: "/", search: "", hash: "", hostname: "localhost", port: "4173" },
    zhimuUi: {},
    zhimuToast: {},
    zhimuModal: {},
    zhimuRuleVisual: {},
    zhimuUserMessages: {
      friendlyApiError: (p, fb) => p?.error || fb,
      RESTORE_SCOPE_OPTIONS: [],
      ASSET_KIND_TABS: [],
      assetKindLabel: (k) => k,
      rulePreviewStatusLabel: (s) => s
    },
    zhimuSessionAuth: {},
    zhimuWorldRevision: {},
    localStorage: storage,
    sessionStorage: storage,
    addEventListener: noop,
    removeEventListener: noop,
    crypto: { randomUUID: () => "test-uuid" }
  };

  globalThis.document = {
    getElementById: () => null,
    querySelector: () => fakeElement,
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    createElement: () => fakeElement,
    body: fakeElement,
    head: fakeElement
  };

  globalThis.localStorage = storage;
  globalThis.sessionStorage = storage;
  globalThis.location = globalThis.window.location;
  // Node 24 exposes `navigator` as a read-only global; override via defineProperty.
  const navShim = { userAgent: "node-test", clipboard: { writeText: async () => {} } };
  try {
    globalThis.navigator = navShim;
  } catch {
    Object.defineProperty(globalThis, "navigator", { value: navShim, writable: true, configurable: true });
  }
  globalThis.fetch = async () => ({
    ok: false,
    status: 599,
    json: async () => ({}),
    body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) }
  });
  globalThis.URL = URL;
  globalThis.URLSearchParams = URLSearchParams;
  globalThis.Blob = class Blob {};
  globalThis.AbortController = class AbortController {
    constructor() {
      this.signal = {};
    }
    abort() {}
  };
  globalThis.MutationObserver = class MutationObserver {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  globalThis.TextDecoder = TextDecoder;
  globalThis.TextEncoder = TextEncoder;
}

setupGlobalShims();

const fileUrl = (rel) => `file://${path.resolve(root, rel).replace(/\\/g, "/")}`;

let failed = false;
for (const rel of files) {
  try {
    // Cache-bust query so re-runs after edits always re-parse.
    await import(fileUrl(rel) + `?t=${Date.now()}-${rel}`);
    console.log(`OK    ${rel}`);
  } catch (err) {
    console.error(`FAIL  ${rel}  ${err.message}`);
    failed = true;
    break;
  }
}

if (failed) process.exit(1);

// Verify critical exports landed on the ESM registries.
const viewRegistryModule = await import(fileUrl("src/runtime/view-registry.js"));
const viewRegistry = viewRegistryModule.viewRegistrySnapshot();
const runtimeModule = await import(fileUrl("src/runtime/runtime-facade.js"));
const runtimeRegistry = runtimeModule.getRuntime();

// API surface: verify via namespace import (window.zhimuApi bridge was removed
// after all view/runtime/component consumers migrated to `import * as zhimuApi`).
const apiNamespace = await import(fileUrl("src/api/index.js") + `?t=${Date.now()}-api-ns`);

const checks = [
  ["viewRegistry.overview.overview", typeof viewRegistry.overview?.overview],
  ["runtimeRegistry.render", typeof runtimeRegistry?.render],
  ["runtimeRegistry.go", typeof runtimeRegistry?.go],
  ["runtimeRegistry.handle", typeof runtimeRegistry?.handle],
  // API namespace exports (replaces former window.zhimuApi bridge checks).
  ["zhimuApi.getWorld", typeof apiNamespace.getWorld],
  ["zhimuApi.createRoom", typeof apiNamespace.createRoom],
  ["zhimuApi.getHostProgress", typeof apiNamespace.getHostProgress],
  ["zhimuApi.getPlayerHome", typeof apiNamespace.getPlayerHome],
  ["zhimuApi.streamRoomEvents", typeof apiNamespace.streamRoomEvents],
  ["zhimuApi.uploadAsset", typeof apiNamespace.uploadAsset],
  ["zhimuApi.getOpsStatus", typeof apiNamespace.getOpsStatus],
  ["zhimuApi.context", typeof apiNamespace.context],
  ["zhimuApi.selectWorld", typeof apiNamespace.selectWorld]
];

for (const [name, type] of checks) {
  if (type !== "function" && type !== "object") {
    console.error(`FAIL  export  ${name} expected function/object, got ${type}`);
    failed = true;
  }
}

if (failed) {
  console.error("\nScript load verify: FAILED");
  process.exit(1);
}

console.log("\nScript load verify: all passed");
