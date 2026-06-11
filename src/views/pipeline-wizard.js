/** AI 分步创作 · 人机协作向导 — 公共入口 */
(function (window) {
  const PH = () => window.zhimuPipelineHtml || {};
  const PS = () => window.zhimuPipelineSession || {};
  const PO = () => window.zhimuPipelineOpen || {};

  const pipelineEvaluationPreview = (...args) => PH().pipelineEvaluationPreview?.(...args) ?? "";
  const pipelinePreviewHtml = (...args) => PH().pipelinePreviewHtml?.(...args) ?? "";
  const pipelineStepLabel = (...args) => PS().pipelineStepLabel?.(...args) ?? "";
  const openDeepseekPipeline = (...args) => PO().openDeepseekPipeline?.(...args);

  window.zhimuPipelineWizard = { openDeepseekPipeline, pipelineEvaluationPreview, pipelinePreviewHtml, pipelineStepLabel };
})(window);
export {};
