/** AI pipeline creative input — setting + synopsis + derived config. */
import { showToast } from "../components/toast.js";
import { studioValues } from "../components/modal.js";
(function (window) {


  function pipelineLinesToArray(text) {
    return String(text || "").split(/\n/).map((line) => line.trim()).filter(Boolean);
  }

  function pipelineArrayToLines(items) {
    return (items || []).join("\n");
  }

  function pipelineSettingFromForm() {
    const values = studioValues();
    const chapterCount = Math.max(3, Math.min(5, Number(values.aiChapterCount) || 5));
    const wordsPerChapter = Math.max(2000, Math.min(12000, Number(values.aiWordsPerChapter) || 8000));
    const playerCount = Math.max(4, Math.min(8, Number(values.aiPlayerCount) || 6));
    return {
      theme: String(values.aiTheme || values.aiTitle || "").trim(),
      playerCount,
      chapterCount,
      wordsPerChapter,
      extraConflicts: String(values.aiConflicts || "").trim(),
      tone: String(values.aiTone || "").trim()
    };
  }

  function pipelineSynopsisFromForm() {
    const values = studioValues();
    return {
      body: String(values.aiSynopsisBody || values.aiPremise || "").trim(),
      charactersSketch: String(values.aiCharactersSketch || "").trim(),
      truthSketch: String(values.aiTruthSketch || "").trim(),
      redHerringsSketch: String(values.aiRedHerringsSketch || "").trim()
    };
  }

  function defaultConfigFromSetting(setting) {
    const chapterCount = setting.chapterCount;
    const chapterKeys = Array.from({ length: chapterCount }, (_, i) => `ch${i + 1}`);
    const conflicts = pipelineLinesToArray(setting.extraConflicts);
    const sectionMin = Math.min(800, Math.max(400, Math.floor(setting.wordsPerChapter / 8)));
    return {
      title: setting.theme,
      playerCount: setting.playerCount,
      chapterCount,
      targetWordCount: chapterCount * setting.wordsPerChapter,
      wordsPerSectionMin: sectionMin,
      sceneCount: Math.max(chapterCount * 2, 6),
      investigationPointCount: Math.max(chapterCount * 3, 8),
      clueCount: Math.max(chapterCount * 3, 8),
      chapterKeys,
      constraints: conflicts,
      notes: [`每章总剧情目标约 ${setting.wordsPerChapter} 字`]
    };
  }

  function pipelineCreativeFromForm() {
    const setting = pipelineSettingFromForm();
    const synopsis = pipelineSynopsisFromForm();
    const config = defaultConfigFromSetting(setting);
    return { setting, synopsis, config };
  }

  function pipelineValidateSetup({ setting, synopsis, config } = {}) {
    if (!setting?.theme?.trim()) {
      showToast("请填写主题");
      return false;
    }
    if (!synopsis?.body?.trim()) {
      showToast("请填写剧情纲要正文");
      return false;
    }
    const chapterCount = Number(setting.chapterCount);
    if (chapterCount < 3 || chapterCount > 5) {
      showToast("章节数量请填写 3～5");
      return false;
    }
    const wordsPerChapter = Number(setting.wordsPerChapter);
    if (wordsPerChapter < 2000 || wordsPerChapter > 12000) {
      showToast("每章节字数建议 2000～12000");
      return false;
    }
    if (!config?.chapterKeys?.length) {
      showToast("章节配置无效，请检查章节数量");
      return false;
    }
    return true;
  }

  /** @deprecated use pipelineCreativeFromForm */
  function pipelineBriefFromForm() {
    const { setting, synopsis, config } = pipelineCreativeFromForm();
    return {
      title: setting.theme,
      premise: synopsis.body,
      wordsPerChapter: setting.wordsPerChapter,
      conflicts: setting.extraConflicts,
      chapterCount: setting.chapterCount,
      playerCount: setting.playerCount,
      targetWordCount: config.targetWordCount,
      sceneCount: config.sceneCount,
      investigationPointCount: config.investigationPointCount,
      clueCount: config.clueCount
    };
  }

  /** @deprecated use pipelineCreativeFromForm */
  function defaultSpecFromBrief() {
    return pipelineCreativeFromForm().config;
  }

  /** @deprecated use pipelineValidateSetup */
  function pipelineValidateSpec(config) {
    const { setting, synopsis } = pipelineCreativeFromForm();
    return pipelineValidateSetup({ setting, synopsis, config });
  }

  window.zhimuPipelineBrief = {
    pipelineLinesToArray,
    pipelineArrayToLines,
    pipelineSettingFromForm,
    pipelineSynopsisFromForm,
    defaultConfigFromSetting,
    pipelineCreativeFromForm,
    pipelineValidateSetup,
    pipelineBriefFromForm,
    defaultSpecFromBrief,
    pipelineValidateSpec
  };
})(window);
export {};
