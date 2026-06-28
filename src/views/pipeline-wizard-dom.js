/** AI pipeline editor DOM read/write — sync modal fields to session. */
import { showToast } from "../components/toast.js";
(function (window) {
  const modal = () => window.zhimuDom?.modal;
  const PB = () => window.zhimuPipelineBrief || {};
  const PS = () => window.zhimuPipelineSession || {};

  function pipelineReadSetupFromDom() {
    return PB().pipelineCreativeFromForm?.() || { setting: {}, synopsis: {}, config: {} };
  }

  function pipelineReadSpecFromDom() {
    return pipelineReadSetupFromDom().config;
  }

  function pipelineReadOutlineFromDom(session) {
    const el = modal();
    if (!session.outline) return null;
    const outline = { ...session.outline };
    outline.logline = el?.querySelector('[data-studio-field="pipeOutlineLogline"]')?.value || outline.logline;
    outline.truthTimeline = el?.querySelector('[data-studio-field="pipeOutlineTruth"]')?.value || outline.truthTimeline;
    outline.redHerrings = PB().pipelineLinesToArray?.(el?.querySelector("[data-pipe-outline-red]")?.value);
    outline.chapterBeats = (outline.chapterBeats || []).map((beat, index) => {
      const card = el?.querySelector(`[data-beat-index="${index}"]`);
      if (!card) return beat;
      return {
        ...beat,
        chapterKey: card.querySelector("[data-pipe-beat-key]")?.value || beat.chapterKey,
        title: card.querySelector(`[data-studio-field="pipeBeatTitle${index}"]`)?.value || beat.title,
        goal: card.querySelector(`[data-studio-field="pipeBeatGoal${index}"]`)?.value || beat.goal,
        turn: card.querySelector(`[data-studio-field="pipeBeatTurn${index}"]`)?.value || beat.turn,
        hostNotes: card.querySelector(`[data-studio-field="pipeBeatHost${index}"]`)?.value || beat.hostNotes
      };
    });
    return outline;
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

  function pipelineReadMatrixFromDom(session) {
    const el = modal();
    if (!session.roleMatrix) return null;
    const roles = (session.roleMatrix.roles || []).map((role) => {
      const key = role.key;
      return {
        ...role,
        name: el?.querySelector(`[data-studio-field="pipeRoleName${key}"]`)?.value ?? role.name,
        publicProfile: el?.querySelector(`[data-studio-field="pipeRolePublic${key}"]`)?.value ?? role.publicProfile,
        privateProfile: el?.querySelector(`[data-studio-field="pipeRolePrivate${key}"]`)?.value ?? role.privateProfile,
        chapterKnowledge: (role.chapterKnowledge || []).map((row) => {
          const ck = row.chapterKey;
          return {
            ...row,
            knows: el?.querySelector(`[data-studio-field="pipeKnow${key}${ck}"]`)?.value ?? row.knows,
            mustHide: el?.querySelector(`[data-studio-field="pipeHide${key}${ck}"]`)?.value ?? row.mustHide,
            canDiscuss: el?.querySelector(`[data-studio-field="pipeDiscuss${key}${ck}"]`)?.value ?? row.canDiscuss
          };
        })
      };
    });
    return { ...session.roleMatrix, roles };
  }

  function pipelineReadNarrativeFromDom(chapterKey) {
    const el = modal();
    const title = el?.querySelector('[data-studio-field="pipeNarrativeTitle"]')?.value || "";
    const summary = el?.querySelector('[data-studio-field="pipeNarrativeSummary"]')?.value || "";
    const narrativeBody = el?.querySelector("[data-pipe-narrative-body]")?.value || "";
    const hostNotes = el?.querySelector('[data-studio-field="pipeNarrativeHost"]')?.value || "";
    if (!narrativeBody.trim()) return null;
    return { chapterKey, title, summary, narrativeBody, hostNotes };
  }

  function pipelineReadSectionFromDom(roleKey, chapterKey) {
    const el = modal();
    const title = el?.querySelector('[data-studio-field="pipeSectionTitle"]')?.value || "";
    const body = el?.querySelector("[data-pipe-section-body]")?.value || "";
    if (!body.trim()) return null;
    return { roleKey, chapterKey, title, body };
  }

  function pipelineReadSynopsisFromDom(session) {
    const el = modal();
    if (!session.synopsis) return null;
    return {
      ...session.synopsis,
      title: el?.querySelector('[data-studio-field="pipeSynTitle"]')?.value ?? session.synopsis.title,
      summary: el?.querySelector('[data-studio-field="pipeSynSummary"]')?.value ?? session.synopsis.summary,
      overallManuscript: el?.querySelector("[data-pipe-synopsis-body]")?.value ?? session.synopsis.overallManuscript,
      logicNotes: PB().pipelineLinesToArray?.(el?.querySelector("[data-pipe-synopsis-notes]")?.value)
    };
  }

  function pipelinePersistActiveEditor(session, ctx) {
    const layer = session.activeLayer;
    if (layer === "setup" || layer === "spec") {
      const creative = pipelineReadSetupFromDom();
      session.setting = creative.setting;
      session.synopsis = creative.synopsis;
      session.config = creative.config;
    } else if (layer === "sync" || layer === "structure") {
      if (session.proposal) session.proposal = pipelineReadStructureFromDom(session);
    } else if (layer === "narrative") {
      const el = modal();
      const chapterKey = el?.querySelector("[data-pipeline-narrative-chapter]")?.value || ctx.narrativeChapterKey;
      const chapter = pipelineReadNarrativeFromDom(chapterKey);
      if (chapter && chapterKey) {
        session.narrativeChapters = session.narrativeChapters || {};
        session.narrativeChapters[chapterKey] = chapter;
      }
    } else if (layer === "roles" || layer === "section" || layer === "matrix") {
      const el = modal();
      const roleKey = el?.querySelector("[data-pipeline-role]")?.value || ctx.roleKey;
      const chapterKey = el?.querySelector("[data-pipeline-chapter]")?.value || ctx.chapterKey;
      const section = pipelineReadSectionFromDom(roleKey, chapterKey);
      if (section) {
        session.sections[roleKey] = session.sections[roleKey] || {};
        session.sections[roleKey][chapterKey] = section;
      }
    }
  }

  function pipelineApplyLayerSave(session, layer, ctx, { lock = false } = {}) {
    const normalized = layer === "spec" ? "setup" : layer === "structure" ? "sync" : layer === "section" || layer === "matrix" ? "roles" : layer;
    const wasLocked = Boolean(session.locks?.[normalized]);
    pipelinePersistActiveEditor(session, ctx);
    if (normalized === "setup") {
      const creative = pipelineReadSetupFromDom();
      if (lock && !PB().pipelineValidateSetup?.(creative)) return false;
      session.setting = creative.setting;
      session.synopsis = creative.synopsis;
      session.config = creative.config;
    } else if (normalized === "sync" && session.proposal) session.proposal = pipelineReadStructureFromDom(session);
    else if (normalized === "narrative") {
      const el = modal();
      const chapterKey = el?.querySelector("[data-pipeline-narrative-chapter]")?.value || ctx.narrativeChapterKey;
      const chapter = pipelineReadNarrativeFromDom(chapterKey);
      if (chapter && chapterKey) {
        session.narrativeChapters = session.narrativeChapters || {};
        session.narrativeChapters[chapterKey] = chapter;
      }
      if (lock) {
        const keys = session.config?.chapterKeys || [];
        const min = PS().narrativeMinChars?.(session) || 2000;
        const missing = keys.filter((key) => (session.narrativeChapters?.[key]?.narrativeBody || "").length < min);
        if (missing.length) {
          showToast(`尚有 ${missing.length} 章总剧情未生成或字数不足`);
          return false;
        }
      }
    } else if (normalized === "roles") {
      const el = modal();
      const roleKey = el?.querySelector("[data-pipeline-role]")?.value || ctx.roleKey;
      const chapterKey = el?.querySelector("[data-pipeline-chapter]")?.value || ctx.chapterKey;
      const section = pipelineReadSectionFromDom(roleKey, chapterKey);
      if (section) {
        session.sections[roleKey] = session.sections[roleKey] || {};
        session.sections[roleKey][chapterKey] = section;
      }
      if (lock) {
        const roles = session.rolesMeta?.roles || [];
        const keys = session.config?.chapterKeys || [];
        const expected = roles.length * keys.length;
        const actual = Object.values(session.sections || {}).reduce((n, chapters) => n + Object.keys(chapters || {}).length, 0);
        if (!roles.length) {
          showToast("请先识别角色");
          return false;
        }
        if (actual < expected) {
          showToast(`私人本尚未齐全（${actual}/${expected}）`);
          return false;
        }
      } else if (!section) {
        showToast("分幕正文不能为空");
        return false;
      }
    } else if (normalized === "evaluate") {
      if (lock && !session.evaluation) {
        showToast("请先完成 AI 评判");
        return false;
      }
    }
    if (wasLocked) PS().pipelineClearDownstream?.(session, normalized);
    if (lock) session.locks[normalized] = true;
    else if (normalized !== "roles" && normalized !== "narrative") session.locks[normalized] = false;
    return true;
  }

  window.zhimuPipelineDom = {
    pipelineReadSetupFromDom,
    pipelineReadSpecFromDom,
    pipelineReadOutlineFromDom,
    pipelineReadStructureFromDom,
    pipelineReadMatrixFromDom,
    pipelineReadNarrativeFromDom,
    pipelineReadSectionFromDom,
    pipelineReadSynopsisFromDom,
    pipelinePersistActiveEditor,
    pipelineApplyLayerSave
  };
})(window);
export {};
