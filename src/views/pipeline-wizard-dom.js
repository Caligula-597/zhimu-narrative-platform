/** AI pipeline editor DOM read/write — sync modal fields to session. */
import { showToast } from "../components/toast.js";
import { modal as modalElement } from "../dom.js";
(function (window) {
  const modal = () => modalElement;
  const PB = () => window.zhimuPipelineBrief || {};
  const PS = () => window.zhimuPipelineSession || {};

  function normalizeLayer(layer) {
    return PS().normalizeLayerName?.(layer) || layer;
  }

  function pipelineReadSetupFromDom() {
    return PB().pipelineCreativeFromForm?.() || { setting: {}, synopsis: {}, config: {} };
  }

  function pipelineReadSpecFromDom() {
    return pipelineReadSetupFromDom().config;
  }

  function pipelineReadJsonFromDom(dataAttr) {
    const el = modal();
    const raw = el?.querySelector(`[${dataAttr}]`)?.value || "";
    if (!raw.trim()) return null;
    try {
      return JSON.parse(raw);
    } catch {
      showToast("JSON 格式无效，请检查后再保存");
      return undefined;
    }
  }

  function pipelineReadStructureFromDom(session) {
    const el = modal();
    if (!session.proposal) return null;
    const proposal = {
      ...session.proposal,
      chapters: [...(session.proposal.chapters || [])],
      scenes: [...(session.proposal.scenes || [])],
      clues: [...(session.proposal.clues || [])]
    };
    proposal.title = el?.querySelector('[data-studio-field="pipeStructTitle"]')?.value || proposal.title;
    proposal.logline = el?.querySelector('[data-studio-field="pipeStructLogline"]')?.value || proposal.logline;
    proposal.chapters = proposal.chapters.map((ch) => ({
      ...ch,
      title: el?.querySelector(`[data-studio-field="pipeChTitle${ch.key}"]`)?.value ?? ch.title,
      summary: el?.querySelector(`[data-studio-field="pipeChSummary${ch.key}"]`)?.value ?? ch.summary
    }));
    proposal.scenes = proposal.scenes.map((sc) => ({
      ...sc,
      name: el?.querySelector(`[data-studio-field="pipeScName${sc.key}"]`)?.value ?? sc.name,
      publicText: el?.querySelector(`[data-studio-field="pipeScPublic${sc.key}"]`)?.value ?? sc.publicText
    }));
    proposal.clues = proposal.clues.map((cl) => ({
      ...cl,
      name: el?.querySelector(`[data-studio-field="pipeClName${cl.key}"]`)?.value ?? cl.name
    }));
    return proposal;
  }

  function pipelineReadScriptFromDom(roleKey, actKey) {
    const el = modal();
    const title = el?.querySelector('[data-studio-field="pipeSectionTitle"]')?.value || "";
    const body = el?.querySelector("[data-pipe-section-body]")?.value || "";
    const tasks = PB().pipelineLinesToArray?.(el?.querySelector('[data-studio-field="pipeScriptTasks"]')?.value);
    const closingHook = el?.querySelector('[data-studio-field="pipeScriptHook"]')?.value || "";
    if (!body.trim()) return null;
    return { roleKey, actKey, title, body, tasks, closingHook };
  }

  function pipelinePersistActiveEditor(session, ctx) {
    const layer = normalizeLayer(session.activeLayer);
    if (layer === "setup") {
      const creative = pipelineReadSetupFromDom();
      session.setting = creative.setting;
      session.synopsis = creative.synopsis;
      session.config = creative.config;
    } else if (layer === "truth") {
      const parsed = pipelineReadJsonFromDom("data-pipe-truth-json");
      if (parsed !== undefined) session.truthBible = parsed;
    } else if (layer === "characters") {
      const parsed = pipelineReadJsonFromDom("data-pipe-characters-json");
      if (parsed !== undefined) session.characterArchives = parsed;
    } else if (layer === "matrix") {
      const parsed = pipelineReadJsonFromDom("data-pipe-matrix-json");
      if (parsed !== undefined) session.infoMatrix = parsed;
    } else if (layer === "host") {
      const parsed = pipelineReadJsonFromDom("data-pipe-host-json");
      if (parsed !== undefined) session.hostRunbooks = Array.isArray(parsed) ? parsed : parsed?.runbooks || [];
    } else if (layer === "scripts") {
      const el = modal();
      const roleKey = el?.querySelector("[data-pipeline-role]")?.value || ctx.roleKey;
      const actKey = el?.querySelector("[data-pipeline-chapter]")?.value || ctx.chapterKey;
      const script = pipelineReadScriptFromDom(roleKey, actKey);
      if (script) {
        session.scripts[roleKey] = session.scripts[roleKey] || {};
        session.scripts[roleKey][actKey] = script;
      }
    } else if (layer === "sync" && session.proposal) {
      session.proposal = pipelineReadStructureFromDom(session);
    }
  }

  function pipelineApplyLayerSave(session, layer, ctx, { lock = false } = {}) {
    const normalized = normalizeLayer(layer);
    const wasLocked = Boolean(session.locks?.[normalized]);
    pipelinePersistActiveEditor(session, ctx);
    if (normalized === "setup") {
      const creative = pipelineReadSetupFromDom();
      if (lock && !PB().pipelineValidateSetup?.(creative)) return false;
      session.setting = creative.setting;
      session.synopsis = creative.synopsis;
      session.config = creative.config;
    } else if (normalized === "truth") {
      if (lock && !session.truthBible?.summary) {
        showToast("请先生成或填写真相 Bible");
        return false;
      }
    } else if (normalized === "characters") {
      if (lock && session.characterArchives?.roles?.length !== session.config?.playerCount) {
        showToast("角色档案数量与玩家人数不一致");
        return false;
      }
    } else if (normalized === "matrix") {
      if (lock && (!session.infoMatrix?.clues?.length || !session.infoMatrix?.rows?.length)) {
        showToast("信息矩阵需包含线索与行");
        return false;
      }
    } else if (normalized === "host") {
      const expected = session.config?.chapterKeys?.length || 0;
      if (lock && (session.hostRunbooks?.length || 0) < expected) {
        showToast(`主持手册尚未齐全（${session.hostRunbooks?.length || 0}/${expected}）`);
        return false;
      }
    } else if (normalized === "scripts") {
      if (lock) {
        const progress = PS().countMatrixScripts?.(session) || { done: 0, total: 0 };
        if (progress.done < progress.total) {
          showToast(`逐幕剧本尚未齐全（${progress.done}/${progress.total}）`);
          return false;
        }
      }
    } else if (normalized === "evaluate") {
      if (lock && !session.evaluation) {
        showToast("请先完成矩阵评判");
        return false;
      }
    } else if (normalized === "sync") {
      if (lock && !session.proposal) {
        showToast("请先生成编排预览");
        return false;
      }
    }
    if (wasLocked) PS().pipelineClearDownstream?.(session, normalized);
    if (lock) session.locks[normalized] = true;
    else session.locks[normalized] = false;
    return true;
  }

  window.zhimuPipelineDom = {
    pipelineReadSetupFromDom,
    pipelineReadSpecFromDom,
    pipelineReadStructureFromDom,
    pipelineReadJsonFromDom,
    pipelineReadScriptFromDom,
    pipelinePersistActiveEditor,
    pipelineApplyLayerSave
  };
})(window);
export {};
