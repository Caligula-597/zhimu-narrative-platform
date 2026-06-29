/**
 * @deprecated Historical one-time script — DO NOT RE-RUN.
 * Extracted the pipeline-wizard-open.js module from git HEAD at the time of
 * the pipeline wizard split. The generated header template below still uses
 * `const zhimuApi = window.zhimuApi;` — the codebase has since migrated to
 * real ES Module imports, so this template is preserved for traceability only.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Hard-disabled: this historical one-time script's template still uses the
// pre-migration `window.zhimuGo` / `window.zhimuLoadCloudData` bridges.
// Re-running it would overwrite the now-migrated src/views/pipeline-wizard-open.js
// with a stale bridge version. Kept for traceability only.
throw new Error(
  "extract-pipeline-open.mjs is deprecated and disabled. " +
  "Its template predates the zhimuRuntime direct-call migration. " +
  "Do not re-run; edit src/views/pipeline-wizard-open.js directly instead."
);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = execSync("git show HEAD:src/views/pipeline-wizard.js", { encoding: "utf8", cwd: root });

function sliceBetween(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`markers not found: ${startMarker} -> ${endMarker}`);
  return src.slice(start, end);
}

const draftBlock = sliceBetween("  function aiDraftWorldId()", "  function pipelineBriefFromForm()");
const migrateAndOpen = sliceBetween("  function migrateLegacyDrafts(", "  window.zhimuPipelineWizard");

const header = `/** AI pipeline wizard modal controller (open + render loop). */
(function (window) {
  const zhimuApi = window.zhimuApi;
  const { modal, modalBackdrop } = window.zhimuDom;
  const F = window.zhimuFormat || {};
  const M = window.zhimuModal || {};
  const T = window.zhimuToast || {};
  const formatRelativeTime = F.formatRelativeTime || (() => "");
  const formatTime = F.formatTime || (() => "");
  const showToast = T.showToast || (() => {});
  const closeModal = M.closeModal || (() => {});
  const studioValues = M.studioValues || (() => ({}));
  const go = window.zhimuGo;
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }

  const AiDraft = () => window.zhimuAiDraft;
  const PS = () => window.zhimuPipelineSession || {};
  const PIPELINE_LAYER_ORDER = PS().PIPELINE_LAYER_ORDER || ["spec", "outline", "structure", "matrix", "section", "synopsis", "evaluate"];
  const defaultPipelineSession = (...args) => PS().defaultPipelineSession?.(...args) ?? { spec: null, outline: null, proposal: null, roleMatrix: null, sections: {}, synopsis: null, evaluation: null, locks: {}, activeLayer: "spec", _editorRev: {} };
  const normalizePipelineSession = (...args) => PS().normalizePipelineSession?.(...args) ?? defaultPipelineSession();
  const pipelineLayerHasData = (...args) => PS().pipelineLayerHasData?.(...args) ?? false;
  const pipelineLayerStatus = (...args) => PS().pipelineLayerStatus?.(...args) ?? "empty";
  const pipelineDepsLocked = (...args) => PS().pipelineDepsLocked?.(...args) ?? false;
  const pipelineClearDownstream = (...args) => PS().pipelineClearDownstream?.(...args);
  const pipelineStepLabel = (...args) => PS().pipelineStepLabel?.(...args) ?? "";
  const pipelineStepName = (...args) => PS().pipelineStepName?.(...args) ?? "";

  const PB = () => window.zhimuPipelineBrief || {};
  const PH = () => window.zhimuPipelineHtml || {};
  const PD = () => window.zhimuPipelineDom || {};
  const pipelineBriefFromForm = (...args) => PB().pipelineBriefFromForm?.(...args) ?? {};
  const pipelineValidateSpec = (...args) => PB().pipelineValidateSpec?.(...args) ?? false;
  const pipelinePreviewHtml = (...args) => PH().pipelinePreviewHtml?.(...args) ?? "";
  const pipelineLadderHtml = (...args) => PH().pipelineLadderHtml?.(...args) ?? "";
  const pipelineLayerHeadHtml = (...args) => PH().pipelineLayerHeadHtml?.(...args) ?? "";
  const pipelineLayerEditorHtml = (...args) => PH().pipelineLayerEditorHtml?.(...args) ?? "";
  const pipelineWizardFrameHtml = (...args) => PH().pipelineWizardFrameHtml?.(...args) ?? "";
  const pipelineSectionListHtml = (...args) => PH().pipelineSectionListHtml?.(...args) ?? "";
  const pipelinePersistActiveEditor = (...args) => PD().pipelinePersistActiveEditor?.(...args);
  const pipelineApplyLayerSave = (...args) => PD().pipelineApplyLayerSave?.(...args);
  const pipelineReadSpecFromDom = (...args) => PD().pipelineReadSpecFromDom?.(...args);

`;

const footer = `
  window.zhimuPipelineOpen = { openDeepseekPipeline };
})(window);
export {};
`;

const out = header + draftBlock + migrateAndOpen + footer;
fs.writeFileSync(path.join(root, "src/views/pipeline-wizard-open.js"), out);
console.log("lines:", out.split("\n").length);
