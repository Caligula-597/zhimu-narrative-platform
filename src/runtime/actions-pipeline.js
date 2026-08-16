/** AI script pipeline launcher for creator surfaces that do not load the full Writer view. */
import { showToast } from "../components/toast.js";

async function ensurePipelineWizard() {
  await import("../views/pipeline-wizard-session.js");
  await import("../views/pipeline-wizard-brief.js");
  await import("../views/pipeline-wizard-html.js");
  await import("../views/pipeline-wizard-dom.js");
  await import("../views/pipeline-wizard-open.js");
  await import("../views/pipeline-wizard.js");
  return import("../views/writer.js");
}

async function openPipelineWizard() {
  try {
    const writer = await ensurePipelineWizard();
    await writer.openDeepseekPipeline();
  } catch (error) {
    console.error("Failed to open AI script pipeline", error);
    showToast("AI 剧本创作加载失败，请刷新后重试");
  }
}

(function (window) {
  function handlePipelineAction(action) {
    if (action !== "deepseek-pipeline") return false;
    void openPipelineWizard();
    return true;
  }

  window.zhimuActionsPipeline = { handlePipelineAction };
})(window);

export { ensurePipelineWizard, openPipelineWizard };
