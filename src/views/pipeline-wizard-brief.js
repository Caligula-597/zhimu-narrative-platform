/** AI pipeline brief form + spec validation helpers. */
(function (window) {
  const T = window.zhimuToast || {};
  const showToast = T.showToast || (() => {});
  const modal = () => window.zhimuDom?.modal;
  const studioValues = () => window.zhimuModal?.studioValues?.() || {};

  function pipelineLinesToArray(text) {
    return String(text || "").split(/\n/).map((line) => line.trim()).filter(Boolean);
  }

  function pipelineArrayToLines(items) {
    return (items || []).join("\n");
  }

  function pipelineBriefFromForm() {
    const values = studioValues();
    const el = modal();
    return {
      title: values.aiTitle,
      premise: values.aiPremise,
      style: values.aiStyle,
      requirements: values.aiRequirements,
      roleRequirements: values.aiRoleRequirements,
      evaluationFocus: values.aiEvalFocus,
      playerCount: Number(values.aiPlayerCount) || 6,
      targetWordCount: Number(values.aiTargetWordCount),
      chapterCount: Number(values.aiChapterCount),
      sceneCount: Number(values.aiSceneCount),
      investigationPointCount: Number(values.aiPointCount),
      clueCount: Number(values.aiClueCount),
      existingManuscript: el?.querySelector("[data-ai-reference]")?.checked
        ? el.dataset.referenceManuscript || ""
        : ""
    };
  }

  function defaultSpecFromBrief() {
    const brief = pipelineBriefFromForm();
    const chapterCount = Math.max(1, Number(brief.chapterCount) || 3);
    const chapterKeys = Array.from({ length: chapterCount }, (_, i) => `ch${i + 1}`);
    const constraints = brief.requirements?.trim() ? pipelineLinesToArray(brief.requirements) : [];
    return {
      playerCount: Math.max(2, Number(brief.playerCount) || 6),
      chapterCount,
      targetWordCount: Number(brief.targetWordCount) || 6000,
      sceneCount: Number(brief.sceneCount) || 8,
      investigationPointCount: Number(brief.investigationPointCount) || 10,
      clueCount: Number(brief.clueCount) || 10,
      chapterKeys,
      constraints,
      notes: []
    };
  }

  function pipelineValidateSpec(spec) {
    if (!spec?.chapterKeys?.length) {
      showToast("请填写至少一个章节 key");
      return false;
    }
    if ((spec.playerCount || 0) < 2) {
      showToast("玩家人数至少 2");
      return false;
    }
    return true;
  }

  window.zhimuPipelineBrief = {
    pipelineLinesToArray,
    pipelineArrayToLines,
    pipelineBriefFromForm,
    defaultSpecFromBrief,
    pipelineValidateSpec
  };
})(window);
export {};
