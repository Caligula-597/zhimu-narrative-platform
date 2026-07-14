/** AI pipeline session model — matrix-first 8-step flow (no DOM). */
(function (window) {
  const PIPELINE_LAYER_ORDER = ["setup", "truth", "characters", "matrix", "host", "scripts", "evaluate", "sync"];
  /** Canonical product copy for entry points and wizard chrome (doc §9.2). */
  const PIPELINE_FLOW_SUMMARY =
    "八层生成流程：立项 → 真相 → 角色 → 信息矩阵 → 主持手册 → 逐幕剧本 → 评判 → 入库";
  const PIPELINE_FLOW_ESTIMATE =
    "分步可中断；已锁定层可复用。完整跑通约 8～20 次模型调用，视幕数与角色数而定（通常十几到数十分钟）。";
  const PIPELINE_LAYER_LABEL = {
    setup: "创作立项",
    truth: "真相档案",
    characters: "角色档案",
    matrix: "信息矩阵",
    host: "主持手册",
    scripts: "逐幕剧本",
    evaluate: "矩阵评判",
    sync: "机械入库",
    narrative: "逐幕剧本",
    roles: "逐幕剧本",
    spec: "创作立项",
    structure: "机械入库",
    matrix_legacy: "信息矩阵",
    section: "逐幕剧本"
  };
  const PIPELINE_LAYER_DEPS = {
    setup: [],
    truth: ["setup"],
    characters: ["setup", "truth"],
    matrix: ["setup", "truth", "characters"],
    host: ["setup", "truth", "matrix"],
    scripts: ["setup", "truth", "characters", "matrix"],
    evaluate: ["setup", "truth", "characters", "matrix", "scripts"],
    sync: ["setup", "truth", "characters", "matrix", "scripts", "evaluate"]
  };

  function pipelineWordTargets(session) {
    const tier = session?.setting?.volumeTier || "standard";
    const map = {
      demo: { perScript: 800, minScript: 400 },
      standard: { perScript: 1500, minScript: 600 },
      epic: { perScript: 4000, minScript: 2000 }
    };
    return map[tier] || map.standard;
  }

  function scriptMinWords(session) {
    return session?.config?.wordsPerSectionMin || pipelineWordTargets(session).minScript;
  }

  function countMatrixScripts(session) {
    const roles = session.characterArchives?.roles || [];
    const keys = session.config?.chapterKeys || [];
    const min = scriptMinWords(session);
    let done = 0;
    const total = roles.length * keys.length;
    for (const role of roles) {
      for (const actKey of keys) {
        const body = session.scripts?.[role.key]?.[actKey]?.body || "";
        if (body.length >= min) done += 1;
      }
    }
    return { done, total, min };
  }

  function isMatrixScriptComplete(session, roleKey, actKey) {
    return (session.scripts?.[roleKey]?.[actKey]?.body || "").length >= scriptMinWords(session);
  }

  function defaultPipelineSession() {
    return {
      setting: null,
      synopsis: null,
      config: null,
      truthBible: null,
      characterArchives: null,
      infoMatrix: null,
      hostRunbooks: null,
      scripts: {},
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
    if (next.narrativeChapters && !next.truthBible) {
      next.truthBible = null;
      next.characterArchives = null;
      next.infoMatrix = null;
      next.hostRunbooks = null;
      next.scripts = {};
      next.evaluation = null;
      next.proposal = null;
      next.locks = { setup: next.locks?.setup || false };
    }
    if (next.sections && !next.scripts) next.scripts = next.sections;
    if (next.rolesMeta && !next.characterArchives) next.characterArchives = null;
    if (next.activeLayer === "spec" || next.activeLayer === "narrative") next.activeLayer = "truth";
    if (next.activeLayer === "roles" || next.activeLayer === "section" || next.activeLayer === "matrix_legacy") next.activeLayer = "scripts";
    if (next.activeLayer === "structure") next.activeLayer = "sync";
    if (next.locks?.spec && !next.locks.setup) next.locks.setup = next.locks.spec;
    if (next.locks?.narrative && !next.locks.truth) next.locks.truth = false;
    if (next.locks?.roles && !next.locks.scripts) next.locks.scripts = false;
    if (next.locks?.structure && !next.locks.sync) next.locks.sync = next.locks.structure;
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
      truthBible: migrated.truthBible ?? null,
      characterArchives: migrated.characterArchives ?? null,
      infoMatrix: migrated.infoMatrix ?? null,
      hostRunbooks: migrated.hostRunbooks ?? null,
      scripts: migrated.scripts || {},
      evaluation: migrated.evaluation ?? null,
      proposal: migrated.proposal ?? null,
      locks: migrated.locks || {},
      activeLayer: PIPELINE_LAYER_ORDER.includes(migrated.activeLayer) ? migrated.activeLayer : "setup",
      _editorRev: migrated._editorRev || {}
    });
    return session;
  }

  function pipelineChaptersForSession(session) {
    if (session.proposal?.chapters?.length) return session.proposal.chapters;
    const keys = session.config?.chapterKeys || [];
    return keys.map((key, index) => ({
      key,
      title: session.infoMatrix?.actTitles?.[key] || `第 ${index + 1} 幕`,
      summary: session.infoMatrix?.actSummaries?.[key] || "",
      sequence: index + 1
    }));
  }

  function pipelineLayerHasData(session, layer) {
    const normalized = normalizeLayerName(layer);
    if (normalized === "setup") {
      return Boolean(session.setting?.theme && session.synopsis?.body && session.config?.chapterKeys?.length);
    }
    if (normalized === "truth") {
      return Boolean(session.truthBible?.summary && session.truthBible?.killer && session.truthBible?.method);
    }
    if (normalized === "characters") {
      return Boolean(session.characterArchives?.roles?.length === session.config?.playerCount);
    }
    if (normalized === "matrix") {
      return Boolean(session.infoMatrix?.clues?.length && session.infoMatrix?.rows?.length);
    }
    if (normalized === "host") {
      const keys = session.config?.chapterKeys || [];
      return Boolean(session.hostRunbooks?.length >= keys.length);
    }
    if (normalized === "scripts") {
      const progress = countMatrixScripts(session);
      return progress.total > 0 && progress.done === progress.total;
    }
    if (normalized === "evaluate") return Boolean(session.evaluation);
    if (normalized === "sync") return Boolean(session.proposal);
    return false;
  }

  function normalizeLayerName(layer) {
    if (layer === "spec") return "setup";
    if (layer === "narrative") return "truth";
    if (layer === "roles" || layer === "section" || layer === "matrix_legacy") return "scripts";
    if (layer === "structure") return "sync";
    return layer;
  }

  function pipelineLayerStatus(session, layer) {
    const normalized = normalizeLayerName(layer);
    if (!pipelineLayerHasData(session, normalized)) return "empty";
    return session.locks?.[normalized] ? "locked" : "draft";
  }

  function pipelineDepsLocked(session, layer) {
    const normalized = normalizeLayerName(layer);
    return (PIPELINE_LAYER_DEPS[normalized] || []).every((dep) => session.locks?.[dep]);
  }

  function pipelineClearDownstream(session, fromLayer) {
    const normalized = normalizeLayerName(fromLayer);
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
      if (layer === "characters") session.characterArchives = null;
      else if (layer === "matrix") session.infoMatrix = null;
      else if (layer === "host") session.hostRunbooks = null;
      else if (layer === "scripts") session.scripts = {};
      else if (layer === "evaluate") session.evaluation = null;
      else if (layer === "sync") session.proposal = null;
      else if (layer === "truth") {
        session.truthBible = null;
        session.characterArchives = null;
        session.infoMatrix = null;
        session.hostRunbooks = null;
        session.scripts = {};
        session.evaluation = null;
        session.proposal = null;
      }
    }
  }

  function pipelineStepLabel(step) {
    const normalized = normalizeLayerName(step);
    return ({
      setup: "① 创作立项",
      truth: "② 真相档案",
      characters: "③ 角色档案",
      matrix: "④ 信息矩阵",
      host: "⑤ 主持手册",
      scripts: "⑥ 逐幕剧本",
      evaluate: "⑦ 矩阵评判",
      sync: "⑧ 机械入库"
    })[normalized] || step;
  }

  function pipelineStepName(step) {
    const label = pipelineStepLabel(step);
    const space = label.indexOf(" ");
    return space >= 0 ? label.slice(space + 1) : label;
  }

  function pipelinePayload(session) {
    return {
      setting: session.setting,
      synopsis: session.synopsis,
      config: session.config,
      truthBible: session.truthBible,
      characterArchives: session.characterArchives,
      infoMatrix: session.infoMatrix,
      hostRunbooks: session.hostRunbooks,
      scripts: session.scripts,
      proposal: session.proposal
    };
  }

  window.zhimuPipelineSession = {
    PIPELINE_LAYER_ORDER,
    PIPELINE_LAYER_LABEL,
    PIPELINE_LAYER_DEPS,
    PIPELINE_FLOW_SUMMARY,
    PIPELINE_FLOW_ESTIMATE,
    pipelineWordTargets,
    scriptMinWords,
    countMatrixScripts,
    isMatrixScriptComplete,
    defaultPipelineSession,
    normalizePipelineSession,
    pipelineChaptersForSession,
    pipelineLayerHasData,
    pipelineLayerStatus,
    pipelineDepsLocked,
    pipelineClearDownstream,
    pipelineStepLabel,
    pipelineStepName,
    pipelinePayload,
    normalizeLayerName
  };
})(window);
export {};
