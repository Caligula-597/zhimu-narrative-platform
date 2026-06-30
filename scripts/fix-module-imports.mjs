/**
 * @deprecated Historical one-time script — DO NOT RE-RUN.
 * Stripped boilerplate `const zhimuApi = window.zhimuApi;` aliases that
 * duplicated function declarations in the same file post-split.
 *
 * The `slimHeader` template below still embeds the old window-bridge pattern
 * for traceability only. Modules now use real `import * as zhimuApi from
 * "../api/index.js"` — re-running this script would regress the migration.
 */
throw new Error("Deprecated one-time migration script is disabled. Do not re-run after the ES module/view-registry migration.");

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const slimHeader = `  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const { content, toast, modal, modalBackdrop } = window.zhimuDom;
  const F = window.zhimuFormat || {};
  const U = window.zhimuUi || {};
  const T = window.zhimuToast || {};
  const M = window.zhimuModal || {};
  const R = window.zhimuRuntime || {};
  const V = window.zhimuViews || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatTime = F.formatTime || (() => "");
  const formatBytes = F.formatBytes || (() => "");
  const formatRelativeTime = F.formatRelativeTime || (() => "");
  const roleParts = F.roleParts || (() => ({ name: "", role: "" }));
  const hostOperationLabel = F.hostOperationLabel || ((t, m) => m || t);
  const hostPlayerColor = F.hostPlayerColor || (() => "#666");
  const logActivityType = F.logActivityType || (() => "ok");
  const chapterPublicationLabel = F.chapterPublicationLabel || ((s) => s);
  const chapterFlowClass = F.chapterFlowClass || (() => "");
  const activeRuntimeRoom = U.activeRuntimeRoom || (() => null);
  const cloudStatus = U.cloudStatus || (() => "");
  const runtimeEmpty = U.runtimeEmpty || (() => "");
  const stat = U.stat || (() => "");
  const flow = U.flow || (() => "");
  const activity = U.activity || (() => "");
  const readingRow = U.readingRow || (() => "");
  const task = U.task || (() => "");
  const taskAction = U.taskAction || (() => "");
  const capability = U.capability || (() => "");
  const check = U.check || (() => "");
  const voiceOption = U.voiceOption || (() => "");
  const showToast = T.showToast || (() => {});
  const closeModal = M.closeModal || (() => {});
  const openModal = M.openModal || (() => {});
  const studioModal = M.studioModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioSelect = M.studioSelect || (() => "");
  const go = R.go || (() => {});
  const render = R.render || (() => {});
  const loadCloudData = R.loadCloudData || (async () => {});
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
`;

function localFunctionNames(src) {
  const names = new Set();
  const re = /^\s*(?:async )?function ([A-Za-z_$][\w$]*)/gm;
  for (const m of src.matchAll(re)) names.add(m[1]);
  return names;
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".js") && name !== "dom.js" && p !== path.join(root, "src/utils/format.js")) fixFile(p);
  }
}

function fixFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  if (!src.includes("Auto-split from app.js") && !src.includes("const F = window.zhimuFormat")) return;
  const local = localFunctionNames(src);
  let header = slimHeader;
  for (const name of local) {
    header = header.replace(new RegExp(`^  const ${name} = .*\\n`, "m"), "");
  }
  src = src.replace(
    /\(function \(window\) \{\n[\s\S]*?window\.zhimuViews = window\.zhimuViews \|\| \{\};\n/,
    `(function (window) {\n${header}  window.zhimuViews = window.zhimuViews || {};\n`
  );
  fs.writeFileSync(filePath, src);
  console.log("fixed", path.relative(root, filePath), [...local].join(", "));
}

walk(path.join(root, "src"));
