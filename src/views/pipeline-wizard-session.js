/** AI pipeline session model — truth → character → sparse clue network → public flow (no DOM). */
import { playStructureProfile } from "../../shared/play-structure.js";
(function (window) {
  const PIPELINE_LAYER_ORDER = ["setup", "truth", "characters", "clues", "matrix", "host", "scripts", "evaluate", "sync"];
  /** Canonical product copy for entry points and wizard chrome (doc §9.2). */
  const PIPELINE_FLOW_SUMMARY =
    "九层创作流程：立项 → 真相节点 → 角色主观认知 → 稀疏线索网 → 公共流程 → 主持手册 → 逐幕剧本 → 评判 → 入库";
  const PIPELINE_FLOW_ESTIMATE =
    "分步可中断；已锁定层可复用。完整跑通约 9～21 次模型调用，视幕数与角色数而定（通常十几到数十分钟）。";
  const PIPELINE_LAYER_LABEL = {
    setup: "创作立项",
    truth: "世界与真相合同",
    characters: "角色档案",
    clues: "稀疏线索网络",
    matrix: "公共流程矩阵",
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
    clues: ["setup", "truth", "characters"],
    matrix: ["setup", "truth", "characters", "clues"],
    host: ["setup", "truth", "characters", "clues", "matrix"],
    scripts: ["setup", "truth", "characters", "clues", "matrix", "host"],
    evaluate: ["setup", "truth", "characters", "clues", "matrix", "host", "scripts"],
    sync: ["setup", "truth", "characters", "clues", "matrix", "host", "scripts", "evaluate"]
  };
  const REPAIR_STAGE_TO_LAYER = {
    source: "setup",
    truth: "truth",
    characters: "characters",
    clues: "clues",
    matrix: "matrix",
    outlines: "scripts",
    scripts: "scripts",
    host: "host",
    evaluation: "evaluate"
  };

  const LAYER_TO_ARTIFACT_PREFIX = {
    setup: "source",
    truth: "truth",
    characters: "characters",
    clues: "clues",
    matrix: "matrix",
    host: "host",
    scripts: "scripts",
    evaluate: "evaluation",
    sync: "proposal"
  };

  function artifactPathForLayer(layer, { roleKey = "", actKey = "" } = {}) {
    const normalized = normalizeLayerName(layer);
    if (normalized === "scripts" && roleKey && actKey) return `scripts.cells.${roleKey}.${actKey}`;
    if (normalized === "host" && actKey) return `host.acts.${actKey}`;
    return LAYER_TO_ARTIFACT_PREFIX[normalized] || normalized;
  }

  function recordPipelineGeneration(session, path, result = {}) {
    session.generationProvenance = session.generationProvenance || { version: "1.0", records: {} };
    session.generationProvenance.records = session.generationProvenance.records || {};
    session.generationProvenance.records[path] = {
      originKind: "ai_generated",
      provider: String(result.provider || ""),
      model: String(result.model || ""),
      generatedAt: new Date().toISOString(),
      humanEditedAt: null
    };
    clearPipelineStalePath(session, path);
  }

  function markPipelineHumanEdit(session, path) {
    if (!path) return;
    session.generationProvenance = session.generationProvenance || { version: "1.0", records: {} };
    session.generationProvenance.records = session.generationProvenance.records || {};
    session.generationProvenance.records[path] = {
      ...(session.generationProvenance.records[path] || {}),
      originKind: "human_edited",
      provider: "human",
      model: "",
      humanEditedAt: new Date().toISOString()
    };
    clearPipelineStalePath(session, path);
  }

  function clearPipelineStalePath(session, path) {
    if (!session?.staleArtifacts || !path) return;
    for (const stalePath of Object.keys(session.staleArtifacts)) {
      if (stalePath === path || stalePath.startsWith(`${path}.`)) delete session.staleArtifacts[stalePath];
    }
    if (!Object.keys(session.staleArtifacts).length) session.pendingRepairPlan = null;
  }

  function resolvePipelineRepairForLayer(session, layer, context = {}) {
    const path = artifactPathForLayer(layer, context);
    clearPipelineStalePath(session, path);
    return path;
  }

  function pipelineLayerStalePaths(session, layer) {
    const prefix = artifactPathForLayer(layer);
    return Object.keys(session?.staleArtifacts || {}).filter((path) => path === prefix || path.startsWith(`${prefix}.`));
  }

  function applyPipelineRepairPlan(session) {
    const repairPlan = session?.evaluation?.repairPlan || {};
    const fallbackRevision = (session?.evaluation?.revisions || [])[0];
    const targetStage = repairPlan.earliestStage || fallbackRevision?.targetLayer || "evaluation";
    const targetLayer = REPAIR_STAGE_TO_LAYER[targetStage] || "evaluate";
    session.locks = session.locks || {};
    session.staleArtifacts = session.staleArtifacts || {};
    for (const invalidatedStage of repairPlan.items?.flatMap((item) => item.invalidates || []) || []) {
      const invalidatedLayer = REPAIR_STAGE_TO_LAYER[invalidatedStage];
      if (invalidatedLayer) session.locks[invalidatedLayer] = false;
    }
    for (const item of repairPlan.items || []) {
      const paths = item.invalidatesPaths?.length
        ? item.invalidatesPaths
        : (item.invalidates || []).map((stage) => stage);
      for (const path of paths) {
        session.staleArtifacts[path] = {
          repairKey: item.key,
          reason: item.problem,
          target: item.targetPaths?.includes(path) === true
        };
      }
    }
    session.pendingRepairPlan = repairPlan;
    session.locks[targetLayer] = false;
    session.locks.sync = false;
    session.activeLayer = targetLayer;
    return { targetStage, targetLayer };
  }

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
      clueNetwork: null,
      infoMatrix: null,
      hostRunbooks: null,
      scripts: {},
      evaluation: null,
      proposal: null,
      generationProvenance: { version: "1.0", records: {} },
      staleArtifacts: {},
      pendingRepairPlan: null,
      generationAudit: null,
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
      next.clueNetwork = null;
      next.hostRunbooks = null;
      next.scripts = {};
      next.evaluation = null;
      next.proposal = null;
      next.locks = { setup: next.locks?.setup || false };
    }
    if (next.sections && !next.scripts) next.scripts = next.sections;
    if (!next.clueNetwork && next.infoMatrix?.clues?.length) {
      next.clueNetwork = {
        version: "legacy-needs-review",
        clues: next.infoMatrix.clues.map((clue) => ({
          ...clue,
          scope: clue.scope || "private",
          function: clue.function || "truth",
          hostMeaning: clue.hostMeaning || "待人工补写真正含义",
          involvedRoleKeys: clue.involvedRoleKeys || [],
          holderRoleKeys: clue.holderRoleKeys || [],
          interpreterRoleKeys: clue.interpreterRoleKeys || [],
          misreaderRoleKeys: clue.misreaderRoleKeys || [],
          truthNodeKeys: clue.truthNodeKeys || [],
          acquisition: clue.acquisition || { method: "待补充", location: "", condition: "" },
          missingEffect: clue.missingEffect || { type: "none", description: "待评估" }
        })),
        truthCoverage: [],
        links: [],
        publicAnchorKeys: []
      };
      next.locks = { ...(next.locks || {}), clues: false, matrix: false };
    }
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
      clueNetwork: migrated.clueNetwork ?? null,
      infoMatrix: migrated.infoMatrix ?? null,
      hostRunbooks: migrated.hostRunbooks ?? null,
      scripts: migrated.scripts || {},
      evaluation: migrated.evaluation ?? null,
      proposal: migrated.proposal ?? null,
      generationProvenance: migrated.generationProvenance || { version: "1.0", records: {} },
      staleArtifacts: migrated.staleArtifacts || {},
      pendingRepairPlan: migrated.pendingRepairPlan || null,
      generationAudit: migrated.generationAudit || null,
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
      const profile = playStructureProfile(session.setting?.playStructure);
      if (!session.truthBible?.summary || !session.truthBible?.playerExperiencePromise || !session.truthBible?.retellableMoment ||
          session.truthBible?.worldSpecificActions?.length < 2 || !session.truthBible?.sharedObjective ||
          session.truthBible?.truthNodes?.length < 4) return false;
      return profile.requiresCulprit
        ? Boolean(session.truthBible.killer && session.truthBible.method)
        : Boolean(
            session.truthBible.centralQuestion &&
            session.truthBible.publicCrisis &&
            session.truthBible.irreversibleDeadline &&
            session.truthBible.endingAxes?.length >= 2 &&
            (session.truthBible.roleEpilogues || []).length === session.config?.playerCount &&
            (session.truthBible.roleEpilogues || []).every((item) => item.variants?.length >= 2)
          );
    }
    if (normalized === "characters") {
      return Boolean(session.characterArchives?.roles?.length === session.config?.playerCount);
    }
    if (normalized === "clues") {
      return Boolean(session.clueNetwork?.clues?.length && session.clueNetwork?.truthCoverage?.length);
    }
    if (normalized === "matrix") {
      return Boolean(session.infoMatrix?.rows?.length && session.infoMatrix?.actTitles);
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
    if (pipelineLayerStalePaths(session, normalized).length) return "stale";
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
    const localizedRepair = Boolean(session.pendingRepairPlan && Object.keys(session.staleArtifacts || {}).length);
    if (session._editorRev) {
      for (let i = idx + 1; i < PIPELINE_LAYER_ORDER.length; i++) {
        const layer = PIPELINE_LAYER_ORDER[i];
        session._editorRev[layer] = (session._editorRev[layer] || 0) + 1;
      }
    }
    if (localizedRepair) {
      for (let i = idx + 1; i < PIPELINE_LAYER_ORDER.length; i++) {
        const layer = PIPELINE_LAYER_ORDER[i];
        if (pipelineLayerStalePaths(session, layer).length || ["evaluate", "sync"].includes(layer)) session.locks[layer] = false;
      }
      session.evaluation = null;
      session.proposal = null;
      return;
    }
    for (let i = idx + 1; i < PIPELINE_LAYER_ORDER.length; i++) {
      const layer = PIPELINE_LAYER_ORDER[i];
      session.locks[layer] = false;
      if (layer === "characters") session.characterArchives = null;
      else if (layer === "clues") session.clueNetwork = null;
      else if (layer === "matrix") session.infoMatrix = null;
      else if (layer === "host") session.hostRunbooks = null;
      else if (layer === "scripts") session.scripts = {};
      else if (layer === "evaluate") session.evaluation = null;
      else if (layer === "sync") session.proposal = null;
      else if (layer === "truth") {
        session.truthBible = null;
        session.characterArchives = null;
        session.clueNetwork = null;
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
      truth: "② 世界与真相合同",
      characters: "③ 角色档案",
      clues: "④ 稀疏线索网络",
      matrix: "⑤ 公共流程矩阵",
      host: "⑥ 主持手册",
      scripts: "⑦ 逐幕剧本",
      evaluate: "⑧ 矩阵评判",
      sync: "⑨ 机械入库"
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
      clueNetwork: session.clueNetwork,
      infoMatrix: session.infoMatrix,
      hostRunbooks: session.hostRunbooks,
      scripts: session.scripts,
      proposal: session.proposal,
      evaluation: session.evaluation,
      generationProvenance: session.generationProvenance,
      scriptGenerationMode: "structured"
    };
  }

  window.zhimuPipelineSession = {
    PIPELINE_LAYER_ORDER,
    PIPELINE_LAYER_LABEL,
    PIPELINE_LAYER_DEPS,
    REPAIR_STAGE_TO_LAYER,
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
    applyPipelineRepairPlan,
    artifactPathForLayer,
    recordPipelineGeneration,
    markPipelineHumanEdit,
    resolvePipelineRepairForLayer,
    pipelineLayerStalePaths,
    pipelinePayload,
    normalizeLayerName
  };
})(window);
export {};
