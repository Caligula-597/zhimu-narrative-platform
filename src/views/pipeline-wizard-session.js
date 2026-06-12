/** AI pipeline session model — 5-step flow (no DOM). */
(function (window) {
  const PIPELINE_LAYER_ORDER = ["setup", "narrative", "roles", "evaluate", "sync"];
  const PIPELINE_LAYER_LABEL = {
    setup: "创作立项",
    narrative: "逐章总剧情",
    roles: "角色私人本",
    evaluate: "AI 评判",
    sync: "汇总同步",
    spec: "创作立项",
    structure: "汇总同步",
    matrix: "角色私人本",
    section: "角色私人本"
  };
  const PIPELINE_LAYER_DEPS = {
    setup: [],
    narrative: ["setup"],
    roles: ["setup", "narrative"],
    evaluate: ["setup", "narrative", "roles"],
    sync: ["setup", "narrative", "roles"]
  };

  function narrativeMinChars(session) {
    const target = session.setting?.wordsPerChapter
      || session.config?.targetWordCount / Math.max(session.config?.chapterCount || 1, 1)
      || 8000;
    return Math.max(2000, Math.floor(Number(target) * 0.45));
  }

  function sectionMinWords(session) {
    return session.config?.wordsPerSectionMin || Math.min(800, Math.max(400, Math.floor((session.setting?.wordsPerChapter || 8000) / 8)));
  }

  function countRoleScriptSections(session) {
    const roles = session.rolesMeta?.roles || [];
    const chapterKeys = session.config?.chapterKeys || [];
    const min = sectionMinWords(session);
    let done = 0;
    const total = roles.length * chapterKeys.length;
    for (const role of roles) {
      for (const chapterKey of chapterKeys) {
        const body = session.sections?.[role.key]?.[chapterKey]?.body || "";
        if (body.length >= min) done += 1;
      }
    }
    return { done, total, min };
  }

  function isRoleScriptSectionComplete(session, roleKey, chapterKey) {
    const min = sectionMinWords(session);
    return (session.sections?.[roleKey]?.[chapterKey]?.body || "").length >= min;
  }

  function defaultPipelineSession() {
    return {
      setting: null,
      synopsis: null,
      config: null,
      narrativeChapters: {},
      rolesMeta: null,
      sections: {},
      evaluation: null,
      proposal: null,
      locks: {},
      activeLayer: "setup",
      _editorRev: {}
    };
  }

  function migrateLegacySession(raw) {
    if (!raw || typeof raw !== "object") return raw;
    const next = { ...raw };
    if (!next.config && next.spec) next.config = next.spec;
    if (!next.rolesMeta && next.roleMatrix) next.rolesMeta = next.roleMatrix;
    if (next.activeLayer === "spec") next.activeLayer = "setup";
    if (next.activeLayer === "structure") next.activeLayer = "sync";
    if (next.activeLayer === "matrix" || next.activeLayer === "section") next.activeLayer = "roles";
    if (next.locks?.spec && !next.locks.setup) next.locks.setup = next.locks.spec;
    if (next.locks?.structure && !next.locks.sync) next.locks.sync = next.locks.structure;
    if (next.locks?.matrix && !next.locks.roles) next.locks.roles = next.locks.matrix;
    return next;
  }

  function normalizePipelineSession(raw) {
    const session = defaultPipelineSession();
    const migrated = migrateLegacySession(raw);
    if (!migrated) return session;
    Object.assign(session, {
      setting: migrated.setting ?? null,
      synopsis: migrated.synopsis ?? null,
      config: migrated.config ?? null,
      narrativeChapters: migrated.narrativeChapters || {},
      rolesMeta: migrated.rolesMeta ?? null,
      sections: migrated.sections || {},
      evaluation: migrated.evaluation ?? null,
      proposal: migrated.proposal ?? null,
      locks: migrated.locks || {},
      activeLayer: migrated.activeLayer || "setup",
      _editorRev: migrated._editorRev || {}
    });
    if (!raw?.locks) {
      if (session.setting && session.synopsis && session.config) {
        session.locks.setup = pipelineLayerHasData(session, "narrative");
      }
      if (pipelineLayerHasData(session, "narrative")) {
        session.locks.narrative = Boolean(session.rolesMeta?.roles?.length);
      }
      if (session.rolesMeta?.roles?.length) {
        session.locks.roles = Object.values(session.sections || {}).some(
          (chapters) => Object.keys(chapters || {}).length
        );
      }
      if (session.proposal) session.locks.sync = Boolean(session.evaluation);
    }
    return session;
  }

  function pipelineChaptersForSession(session) {
    if (session.proposal?.chapters?.length) return session.proposal.chapters;
    const keys = session.config?.chapterKeys || [];
    return keys.map((key, index) => {
      const narrative = session.narrativeChapters?.[key];
      return {
        key,
        title: narrative?.title || `第 ${index + 1} 章`,
        summary: narrative?.summary || "",
        sequence: index + 1
      };
    });
  }

  function pipelineNarrativeChapterList(session) {
    const keys = session.config?.chapterKeys || [];
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
      title: title || session.config?.title || session.setting?.theme || "剧本",
      logline: "",
      chapters,
      scenes,
      investigationPoints: [],
      clues: [],
      edges: [],
      suggestions: []
    };
  }

  function pipelineLayerHasData(session, layer) {
    const normalized = layer === "spec" ? "setup" : layer === "structure" ? "sync" : layer === "matrix" || layer === "section" ? "roles" : layer;
    if (normalized === "setup") return Boolean(session.setting?.theme && session.synopsis?.body && session.config?.chapterKeys?.length);
    if (normalized === "narrative") {
      const keys = session.config?.chapterKeys || [];
      const min = narrativeMinChars(session);
      return keys.length > 0 && keys.every((key) => (session.narrativeChapters?.[key]?.narrativeBody || "").length >= min);
    }
    if (normalized === "roles") {
      return Boolean(session.rolesMeta?.roles?.length)
        && Object.values(session.sections || {}).some((chapters) => Object.keys(chapters || {}).length);
    }
    if (normalized === "evaluate") return Boolean(session.evaluation);
    if (normalized === "sync") return Boolean(session.proposal);
    return false;
  }

  function pipelineLayerStatus(session, layer) {
    const normalized = layer === "spec" ? "setup" : layer === "structure" ? "sync" : layer === "matrix" || layer === "section" ? "roles" : layer;
    if (!pipelineLayerHasData(session, normalized)) return "empty";
    return session.locks?.[normalized] ? "locked" : "draft";
  }

  function pipelineDepsLocked(session, layer) {
    const normalized = layer === "spec" ? "setup" : layer === "structure" ? "sync" : layer === "matrix" || layer === "section" ? "roles" : layer;
    return (PIPELINE_LAYER_DEPS[normalized] || []).every((dep) => session.locks?.[dep]);
  }

  function pipelineClearDownstream(session, fromLayer) {
    const normalized = fromLayer === "spec" ? "setup" : fromLayer === "structure" ? "sync" : fromLayer === "matrix" || fromLayer === "section" ? "roles" : fromLayer;
    const idx = PIPELINE_LAYER_ORDER.indexOf(normalized);
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
      if (layer === "roles") {
        session.sections = {};
        session.rolesMeta = null;
      } else if (layer === "evaluate") session.evaluation = null;
      else if (layer === "sync") session.proposal = null;
      else if (layer === "narrative") session.narrativeChapters = {};
    }
  }

  function pipelineStepLabel(step) {
    const normalized = step === "spec" ? "setup" : step === "structure" ? "sync" : step === "matrix" || step === "section" ? "roles" : step;
    return ({
      setup: "① 创作立项",
      narrative: "② 逐章总剧情",
      roles: "③ 角色私人本",
      evaluate: "④ AI 评判",
      sync: "⑤ 汇总同步"
    })[normalized] || step;
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
    narrativeMinChars,
    sectionMinWords,
    countRoleScriptSections,
    isRoleScriptSectionComplete,
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
