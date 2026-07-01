import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

throw new Error("Deprecated one-time migration script is disabled. Do not re-run after the ES module/view-registry migration.");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "src/views/pipeline-wizard.js"), "utf8");
const start = src.indexOf("function pipelineEvaluationPreview");
const end = src.indexOf("function pipelineReadSpecFromDom");
const block = src.slice(start, end);

const header = `/** AI pipeline wizard HTML templates. */
(function (window) {
  const state = window.zhimuState;
  const F = window.zhimuFormat || {};
  const M = window.zhimuModal || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const studioField = M.studioField || (() => "");
  const PS = () => window.zhimuPipelineSession || {};
  const PB = () => window.zhimuPipelineBrief || {};
  const PIPELINE_LAYER_ORDER = PS().PIPELINE_LAYER_ORDER || [];
  const PIPELINE_LAYER_LABEL = PS().PIPELINE_LAYER_LABEL || {};
  const PIPELINE_LAYER_DEPS = PS().PIPELINE_LAYER_DEPS || {};
  const REVISION_PRIORITY_LABEL = { must_fix: "必改", should_fix: "建议改", optional: "可选" };
  const pipelineLayerStatus = (...a) => PS().pipelineLayerStatus?.(...a) ?? "empty";
  const pipelineDepsLocked = (...a) => PS().pipelineDepsLocked?.(...a) ?? false;
  const pipelineStepLabel = (...a) => PS().pipelineStepLabel?.(...a) ?? "";
  const pipelineStepName = (...a) => PS().pipelineStepName?.(...a) ?? "";
  const pipelineArrayToLines = (...a) => PB().pipelineArrayToLines?.(...a) ?? "";
  const defaultSpecFromBrief = (...a) => PB().defaultSpecFromBrief?.(...a) ?? {};
  const aiLocalDraftActions = () => '<button class="text-btn" type="button" data-ai-draft-clear>清除本地草稿</button>';

`;

const footer = `
  window.zhimuPipelineHtml = {
    pipelineEvaluationPreview,
    pipelinePreviewHtml,
    pipelineLadderHtml,
    pipelineLayerHeadHtml,
    pipelineSpecEditorHtml,
    pipelineOutlineEditorHtml,
    pipelineStructureEditorHtml,
    pipelineMatrixEditorHtml,
    pipelineSectionListHtml,
    pipelineSectionEditorHtml,
    pipelineSynopsisEditorHtml,
    pipelineLayerEditorHtml,
    pipelineLocationBarHtml,
    pipelineModeTabsHtml,
    pipelineBriefFieldsHtml,
    pipelineWizardFrameHtml
  };
})(window);
export {};
`;

const out = header + block.replace(/^function /gm, "  function ") + footer;
fs.writeFileSync(path.join(root, "src/views/pipeline-wizard-html.js"), out);
console.log("lines:", out.split("\n").length);
