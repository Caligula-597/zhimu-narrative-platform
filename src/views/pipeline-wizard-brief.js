/** AI pipeline brief form + spec validation helpers. */
(function (window) {
  const T = window.zhimuToast || {};
  const showToast = T.showToast || (() => {});
  const studioValues = () => window.zhimuModal?.studioValues?.() || {};

  function pipelineLinesToArray(text) {
    return String(text || "").split(/\n/).map((line) => line.trim()).filter(Boolean);
  }

  function pipelineArrayToLines(items) {
    return (items || []).join("\n");
  }

  function pipelineBriefFromForm() {
    const values = studioValues();
    const chapterCount = Math.max(3, Math.min(5, Number(values.aiChapterCount) || 3));
    const wordsPerChapter = Math.max(400, Math.min(2500, Number(values.aiWordsPerChapter) || 800));
    const conflicts = String(values.aiConflicts || "").trim();
    return {
      title: values.aiTitle,
      premise: values.aiPremise,
      wordsPerChapter,
      conflicts,
      chapterCount,
      conflicts: values.aiConflicts,
      style: "悬疑调查，信息逐步揭示，适合线上长线剧本杀",
      roleRequirements: "",
      evaluationFocus: "",
      playerCount: 6,
      targetWordCount: chapterCount * wordsPerChapter,
      sceneCount: Math.max(chapterCount * 2, 6),
      investigationPointCount: Math.max(chapterCount * 3, 8),
      clueCount: Math.max(chapterCount * 3, 8),
      existingManuscript: ""
    };
  }

  function defaultSpecFromBrief() {
    const brief = pipelineBriefFromForm();
    const chapterCount = brief.chapterCount;
    const chapterKeys = Array.from({ length: chapterCount }, (_, i) => `ch${i + 1}`);
    const conflicts = pipelineLinesToArray(brief.conflicts);
    const sectionMin = Math.min(800, Math.max(150, Math.floor(brief.wordsPerChapter / 3)));
    return {
      title: brief.title,
      playerCount: 6,
      chapterCount,
      targetWordCount: brief.targetWordCount,
      wordsPerSectionMin: sectionMin,
      sceneCount: brief.sceneCount,
      investigationPointCount: brief.investigationPointCount,
      clueCount: brief.clueCount,
      chapterKeys,
      constraints: conflicts,
      notes: [`每章总剧情目标字数约 ${brief.wordsPerChapter} 字`]
    };
  }

  function pipelineValidateSpec(spec) {
    const brief = pipelineBriefFromForm();
    if (!brief.title?.trim()) {
      showToast("请填写主题");
      return false;
    }
    if (!brief.premise?.trim()) {
      showToast("请填写剧情纲要");
      return false;
    }
    const chapterCount = Number(brief.chapterCount);
    if (chapterCount < 3 || chapterCount > 5) {
      showToast("章节数量请填写 3～5");
      return false;
    }
    const wordsPerChapter = Number(brief.wordsPerChapter);
    if (wordsPerChapter < 400 || wordsPerChapter > 2500) {
      showToast("每章节字数建议 400～2500");
      return false;
    }
    if (!spec?.chapterKeys?.length) {
      showToast("章节配置无效，请检查章节数量");
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
