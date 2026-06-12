/** AI pipeline session model — layer order, locks, downstream invalidation (no DOM). */
(function (window) {
  const PIPELINE_LAYER_ORDER = ["spec", "outline", "narrative", "matrix", "section", "structure", "synopsis", "evaluate"];
  const PIPELINE_LAYER_LABEL = {
    brief: "创作 brief",
    spec: "创作设定",
    outline: "总纲",
    narrative: "章节总剧情",
    structure: "编排结构",
    roleMatrix: "角色矩阵",
    matrix: "角色矩阵",
    section: "私人分幕",
    synopsis: "短母稿",
    evaluate: "评判"
  };
  const PIPELINE_LAYER_DEPS = {
    spec: [],
    outline: ["spec"],
    narrative: ["spec", "outline"],
    matrix: ["spec", "outline", "narrative"],
    section: ["spec", "outline", "narrative", "matrix"],
    structure: ["spec", "outline", "narrative", "matrix", "section"],
    synopsis: ["spec", "outline", "structure"],
    evaluate: ["structure"]
  };

  function defaultPipelineSession() {
    return {
      spec: null,
      outline: null,
      narrativeChapters: {},
      proposal: null,
      roleMatrix: null,
      sections: {},
      synopsis: null,
      evaluation: null,
      locks: {},
      activeLayer: "spec",
      _editorRev: {}
    };
  }

  function normalizePipelineSession(raw) {
    const session = defaultPipelineSession();
    if (!raw) return session;
    Object.assign(session, {
      spec: raw.spec ?? null,
      outline: raw.outline ?? null,
      narrativeChapters: raw.narrativeChapters || {},
      proposal: raw.proposal ?? null,
      roleMatrix: raw.roleMatrix ?? null,
      sections: raw.sections || {},
      synopsis: raw.synopsis ?? null,
      evaluation: raw.evaluation ?? null,
      locks: raw.locks || {},
      activeLayer: raw.activeLayer || "spec",
      _editorRev: raw._editorRev || {}
    });
    if (!raw.locks) {
      if (session.spec) session.locks.spec = Boolean(session.outline);
      if (session.outline) session.locks.outline = pipelineLayerHasData(session, "narrative");
      if (pipelineLayerHasData(session, "narrative")) session.locks.narrative = Boolean(session.roleMatrix);
      if (session.roleMatrix) {
        session.locks.matrix = Object.values(session.sections || {}).some(
          (chapters) => Object.keys(chapters || {}).length
        );
      }
      if (session.proposal) session.locks.structure = Boolean(session.synopsis);
    }
    return session;
  }

  function pipelineChaptersForSession(session) {
    if (session.proposal?.chapters?.length) return session.proposal.chapters;
    const keys = session.spec?.chapterKeys || [];
    return keys.map((key, index) => {
      const narrative = session.narrativeChapters?.[key];
      const beat = (session.outline?.chapterBeats || []).find((row) => row.chapterKey === key);
      return {
        key,
        title: narrative?.title || beat?.title || `第 ${index + 1} 章`,
        summary: narrative?.summary || beat?.goal || "",
        sequence: index + 1
      };
    });
  }

  function pipelineNarrativeChapterList(session) {
    const keys = session.spec?.chapterKeys || [];
    return keys.map((key) => session.narrativeChapters?.[key] || null).filter(Boolean);
  }

  function pipelineStubProposal(session, title = "") {
    const chapters = pipelineChaptersForSession(session);
    const scenes = chapters.map((chapter, index) => ({
      key: `scene-${index + 1}`,
      chapterKey: chapter.key,
      name: chapter.title || `场景 ${index + 1}`,
      publicText: chapter.summary || "待从总剧情抽取",
      hostText: ""
    }));
    return {
      title: title || session.spec?.title || "剧本",
      logline: session.outline?.logline || "",
      chapters,
      scenes,
      investigationPoints: [],
      clues: [],
      edges: [],
      suggestions: []
    };
  }

  function pipelineLayerHasData(session, layer) {
    if (layer === "spec") return Boolean(session.spec);
    if (layer === "outline") return Boolean(session.outline);
    if (layer === "narrative") {
      const keys = session.spec?.chapterKeys || [];
      return keys.length > 0 && keys.every((key) => (session.narrativeChapters?.[key]?.narrativeBody || "").length >= 400);
    }
    if (layer === "structure") return Boolean(session.proposal);
    if (layer === "matrix") return Boolean(session.roleMatrix);
    if (layer === "section") {
      return Object.values(session.sections || {}).some((chapters) => Object.keys(chapters || {}).length);
    }
    if (layer === "synopsis") return Boolean(session.synopsis);
    if (layer === "evaluate") return Boolean(session.evaluation);
    return false;
  }

  function pipelineLayerStatus(session, layer) {
    if (!pipelineLayerHasData(session, layer)) return "empty";
    return session.locks?.[layer] ? "locked" : "draft";
  }

  function pipelineDepsLocked(session, layer) {
    return (PIPELINE_LAYER_DEPS[layer] || []).every((dep) => session.locks?.[dep]);
  }

  function pipelineClearDownstream(session, fromLayer) {
    const idx = PIPELINE_LAYER_ORDER.indexOf(fromLayer);
    if (idx < 0) return;
    if (session._editorRev) {
      for (let i = idx + 1; i < PIPELINE_LAYER_ORDER.length; i++) {
        const layer = PIPELINE_LAYER_ORDER[i];
        session._editorRev[layer] = (session._editorRev[layer] || 0) + 1;
      }
    }
    for (let i = idx + 1; i < PIPELINE_LAYER_ORDER.length; i++) {
      const layer = PIPELINE_LAYER_ORDER[i];
      session.locks[layer] = false;
      if (layer === "section") session.sections = {};
      else if (layer === "evaluate") session.evaluation = null;
      else if (layer === "synopsis") session.synopsis = null;
      else if (layer === "matrix") session.roleMatrix = null;
      else if (layer === "structure") session.proposal = null;
      else if (layer === "narrative") session.narrativeChapters = {};
      else if (layer === "outline") session.outline = null;
    }
  }

  function pipelineStepLabel(step) {
    return ({
      spec: "① 创作设定",
      outline: "② 总纲",
      narrative: "③ 章节总剧情",
      matrix: "④ 角色矩阵",
      section: "⑤ 私人分幕",
      structure: "⑥ 编排结构",
      synopsis: "⑦ 短母稿",
      evaluate: "⑧ 评判"
    })[step] || step;
  }

  function pipelineStepName(step) {
    const label = pipelineStepLabel(step);
    const space = label.indexOf(" ");
    return space >= 0 ? label.slice(space + 1) : label;
  }

  window.zhimuPipelineSession = {
    PIPELINE_LAYER_ORDER,
    PIPELINE_LAYER_LABEL,
    PIPELINE_LAYER_DEPS,
    defaultPipelineSession,
    normalizePipelineSession,
    pipelineChaptersForSession,
    pipelineNarrativeChapterList,
    pipelineStubProposal,
    pipelineLayerHasData,
    pipelineLayerStatus,
    pipelineDepsLocked,
    pipelineClearDownstream,
    pipelineStepLabel,
    pipelineStepName
  };
})(window);
export {};
