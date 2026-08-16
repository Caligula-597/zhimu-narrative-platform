/** AI pipeline editor DOM read/write — sync modal fields to session. */
import { showToast } from "../components/toast.js";
import { modal as modalElement } from "../dom.js";
import {
  diagnoseScriptCollection,
  fingerprintScriptCollection
} from "../../shared/prose-quality-gate.js";
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
    const changed = (before, after) => JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);
    if (layer === "setup") {
      const creative = pipelineReadSetupFromDom();
      const before = { setting: session.setting, synopsis: session.synopsis, config: session.config };
      session.setting = creative.setting;
      session.synopsis = creative.synopsis;
      session.config = creative.config;
      if (changed(before, creative)) PS().markPipelineHumanEdit?.(session, "source");
    } else if (layer === "truth") {
      const parsed = pipelineReadJsonFromDom("data-pipe-truth-json");
      if (parsed !== undefined) {
        if (changed(session.truthBible, parsed)) PS().markPipelineHumanEdit?.(session, "truth");
        session.truthBible = parsed;
      }
    } else if (layer === "characters") {
      const parsed = pipelineReadJsonFromDom("data-pipe-characters-json");
      if (parsed !== undefined) {
        if (changed(session.characterArchives, parsed)) PS().markPipelineHumanEdit?.(session, "characters");
        session.characterArchives = parsed;
      }
    } else if (layer === "clues") {
      const parsed = pipelineReadJsonFromDom("data-pipe-clues-json");
      if (parsed !== undefined) {
        if (changed(session.clueNetwork, parsed)) PS().markPipelineHumanEdit?.(session, "clues");
        session.clueNetwork = parsed;
      }
    } else if (layer === "matrix") {
      const parsed = pipelineReadJsonFromDom("data-pipe-matrix-json");
      if (parsed !== undefined) {
        if (changed(session.infoMatrix, parsed)) PS().markPipelineHumanEdit?.(session, "matrix");
        session.infoMatrix = parsed;
      }
    } else if (layer === "host") {
      const parsed = pipelineReadJsonFromDom("data-pipe-host-json");
      if (parsed !== undefined) {
        const next = Array.isArray(parsed) ? parsed : parsed?.runbooks || [];
        if (changed(session.hostRunbooks, next)) PS().markPipelineHumanEdit?.(session, "host");
        session.hostRunbooks = next;
      }
    } else if (layer === "scripts") {
      const el = modal();
      const roleKey = el?.querySelector("[data-pipeline-role]")?.value || ctx.roleKey;
      const actKey = el?.querySelector("[data-pipeline-chapter]")?.value || ctx.chapterKey;
      const script = pipelineReadScriptFromDom(roleKey, actKey);
      if (script) {
        if (changed(session.scripts?.[roleKey]?.[actKey], script)) {
          PS().markPipelineHumanEdit?.(session, `scripts.cells.${roleKey}.${actKey}`);
        }
        session.scripts[roleKey] = session.scripts[roleKey] || {};
        session.scripts[roleKey][actKey] = script;
      }
    } else if (layer === "sync" && session.proposal) {
      const next = pipelineReadStructureFromDom(session);
      if (changed(session.proposal, next)) PS().markPipelineHumanEdit?.(session, "proposal");
      session.proposal = next;
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
      const truth = session.truthBible;
      if (lock && (!truth?.summary || !truth.playerExperiencePromise || !truth.retellableMoment ||
        truth.worldSpecificActions?.length < 2 || !truth.sharedObjective || truth.truthNodes?.length < 4)) {
        showToast("真相层尚未完成：需补齐体验承诺、可复述场面、世界专属动作、共同目标与至少 4 个真相节点");
        return false;
      }
      if (lock && session.setting?.playStructure !== "mystery" && (
        truth?.roleEpilogues?.length !== session.config?.playerCount ||
        truth.roleEpilogues.some((item) => item.variants?.length < 2)
      )) {
        showToast("真相层尚未完成：每名角色需 2～3 个读取主结局轴的个人尾声变体");
        return false;
      }
    } else if (normalized === "characters") {
      if (lock && session.characterArchives?.roles?.length !== session.config?.playerCount) {
        showToast("角色档案数量与玩家人数不一致");
        return false;
      }
    } else if (normalized === "clues") {
      const clues = session.clueNetwork?.clues || [];
      const coverage = session.clueNetwork?.truthCoverage || [];
      const criticalKeys = new Set((session.truthBible?.truthNodes || []).filter((node) => node.importance === "critical").map((node) => node.key));
      const criticalCovered = [...criticalKeys].every((key) => {
        const item = coverage.find((row) => row.truthNodeKey === key);
        return item?.paths?.length >= 2 && item?.fallback;
      });
      const allRoleNonPublic = clues.some((clue) =>
        clue.scope !== "public_anchor" && clue.involvedRoleKeys?.length >= (session.config?.playerCount || 0)
      );
      if (lock && (!clues.length || !coverage.length || !criticalCovered || allRoleNonPublic)) {
        showToast(allRoleNonPublic
          ? "存在把所有角色强行连在一起的非公共线索，请改为局部线索或真正的公共锚点"
          : "线索网尚未覆盖关键真相：每个 critical 节点需两条独立路径与一条兜底路径");
        return false;
      }
    } else if (normalized === "matrix") {
      if (lock && (!session.infoMatrix?.rows?.length || !session.infoMatrix?.actTitles)) {
        showToast("公共流程矩阵需包含逐幕标题与完整角色行");
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
        const diagnostics = diagnoseScriptCollection(session.scripts, { expectedPov: session.setting?.pov });
        if (!diagnostics.passed) {
          const first = diagnostics.issues.find((issue) => issue.severity === "high");
          showToast(first
            ? `正文门禁拦截 ${first.cell} 第 ${first.paragraph || "-"} 段：${first.message}`
            : "玩家正文未通过场景化正文门禁");
          return false;
        }
      }
    } else if (normalized === "evaluate") {
      if (lock && !session.evaluation) {
        showToast("请先完成矩阵评判");
        return false;
      }
      if (lock && !session.evaluation.readyForSync) {
        showToast("评判或正文门禁未通过，修复必改项后请重新评判");
        return false;
      }
      if (lock && session.evaluation.scriptFingerprint !== fingerprintScriptCollection(session.scripts)) {
        showToast("正文在评判后发生过修改，请重新运行矩阵评判");
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
