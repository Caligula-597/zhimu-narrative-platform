/**
 * Verify all frontend scripts load in index.html order without SyntaxError.
 * Catches duplicate const/function declarations that ui-smoke.js misses.
 *
 * Usage: node scripts/verify-script-load.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  "config.js",
  "src/dom.js",
  "src/state.js",
  "src/utils/user-messages.js",
  "src/utils/wizard-automation-templates.js",
  "src/api/client.js",
  "rule-visual.js",
  "src/utils/format.js",
  "src/components/emptyState.js",
  "src/components/toast.js",
  "src/components/modal.js",
  "src/components/creator-guide.js",
  "src/views/overview.js",
  "src/views/writer.js",
  "src/views/studio.js",
  "src/views/clues.js",
  "src/views/assets.js",
  "src/views/rules.js",
  "src/views/director.js",
  "src/views/player.js",
  "src/views/archive.js",
  "src/views/settings.js",
  "src/runtime/wizard.js",
  "src/runtime/auth-world.js",
  "src/runtime/auth-session.js",
  "src/runtime/global-search.js",
  "src/runtime/search-focus.js",
  "src/runtime/livekit-voice.js",
  "src/runtime/data.js",
  "src/runtime/actions.js",
  "app.js"
];

const sandbox = {
  window: {
    zhimuConfig: {
      apiBase: "http://localhost:4180/api",
      demoMode: true,
      demoUsers: {},
      demoWorld: {}
    },
    zhimuState: null,
    zhimuApi: null,
    zhimuDom: {
      content: { innerHTML: "", addEventListener() {}, removeEventListener() {} },
      toast: { textContent: "", classList: { add() {}, remove() {} } },
      modal: {
        className: "",
        innerHTML: "",
        querySelector: () => ({ onclick: null }),
        querySelectorAll: () => []
      },
      modalBackdrop: { classList: { add() {}, remove() {} }, onclick: null }
    },
    location: { pathname: "/", search: "", hash: "" },
    zhimuFormat: {},
    zhimuUi: {},
    zhimuToast: {},
    zhimuModal: {},
    zhimuViews: {},
    zhimuRuntime: {},
    zhimuRuleVisual: {},
    zhimuUserMessages: {
      friendlyApiError: (p, fb) => p.error || fb,
      RESTORE_SCOPE_OPTIONS: [],
      ASSET_KIND_TABS: [],
      assetKindLabel: (k) => k,
      rulePreviewStatusLabel: (s) => s
    },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    crypto: { randomUUID: () => "test-uuid" },
    fetch: async () => ({ ok: true, json: async () => ({}) })
  },
  document: {
    getElementById: () => null,
    querySelector: () => ({
      textContent: "",
      innerHTML: "",
      classList: { toggle() {}, add() {}, remove() {} },
      onclick: null,
      addEventListener() {},
      removeEventListener() {},
      dataset: {},
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: () => {},
      setAttribute: () => {}
    }),
    querySelectorAll: () => []
  },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  fetch: async () => ({
    ok: false,
    json: async () => ({}),
    body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) }
  }),
  setTimeout: () => {},
  clearTimeout: () => {},
  clearInterval: () => {},
  setInterval: () => {},
  URL: { createObjectURL: () => "", revokeObjectURL: () => {} },
  URLSearchParams,
  Blob: function Blob() {},
  AbortController: class AbortController {
    constructor() {
      this.signal = {};
    }
    abort() {}
  },
  MutationObserver: class MutationObserver {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  },
  navigator: { clipboard: { writeText: async () => {} } },
  location: { hostname: "localhost" },
  import: { meta: { env: { VITE_API_BASE: "/api" } } },
  console
};

const context = {
  ...sandbox,
  window: sandbox.window,
  document: sandbox.document,
  localStorage: sandbox.localStorage,
  fetch: sandbox.fetch,
  setTimeout: sandbox.setTimeout,
  clearTimeout: sandbox.clearTimeout,
  clearInterval: sandbox.clearInterval,
  setInterval: sandbox.setInterval,
  URL: sandbox.URL,
  URLSearchParams: sandbox.URLSearchParams,
  Blob: sandbox.Blob,
  AbortController: sandbox.AbortController,
  MutationObserver: sandbox.MutationObserver,
  navigator: sandbox.navigator,
  location: sandbox.location,
  import: sandbox.import,
  console
};

function stripEsmExport(source) {
  return source.replace(/\nexport\s*\{\s*\}\s*;?\s*$/, "");
}

function prepareSource(rel, source) {
  let s = stripEsmExport(source);
  if (rel === "config.js") {
    s = s.replace(
      /const viteEnv = typeof import\.meta[\s\S]*?;\s*\n/,
      "const viteEnv = { DEV: true, VITE_API_BASE: \"/api\" };\n"
    );
  }
  return s;
}

let failed = false;
for (const rel of files) {
  const filePath = path.join(root, rel);
  if (!fs.existsSync(filePath)) {
    console.error(`FAIL  missing  ${rel}`);
    failed = true;
    continue;
  }
  try {
    const source = prepareSource(rel, fs.readFileSync(filePath, "utf8"));
    vm.runInNewContext(source, context);
    console.log(`OK    ${rel}`);
  } catch (err) {
    console.error(`FAIL  ${rel}  ${err.message}`);
    failed = true;
    break;
  }
}

if (failed) {
  process.exit(1);
}

const { zhimuViews, zhimuRuntime } = sandbox.window;
const checks = [
  ["zhimuViews.overview.overview", typeof zhimuViews.overview?.overview],
  ["zhimuRuntime.render", typeof zhimuRuntime.render],
  ["zhimuRuntime.go", typeof zhimuRuntime.go],
  ["zhimuRuntime.handle", typeof zhimuRuntime.handle]
];
for (const [name, type] of checks) {
  if (type !== "function") {
    console.error(`FAIL  export  ${name} expected function, got ${type}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("\nScript load verify: all passed");
