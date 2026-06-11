/** AI pipeline editor DOM read/write — sync modal fields to session. */
(function (window) {
  const T = window.zhimuToast || {};
  const showToast = T.showToast || (() => {});
  const modal = () => window.zhimuDom?.modal;
  const PB = () => window.zhimuPipelineBrief || {};
  const PS = () => window.zhimuPipelineSession || {};

  function pipelineReadSpecFromDom(existing) {
    const el = modal();
    const fallback = existing || PB().defaultSpecFromBrief?.() || {};
    const chapterCount = Number(el?.querySelector('[data-studio-field="pipeSpecChapterCount"]')?.value) || fallback.chapterCount;
    let keys = String(el?.querySelector("[data-pipe-spec-chapter-keys]")?.value || "").split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (!keys.length && chapterCount) keys = Array.from({ length: chapterCount }, (_, i) => `ch${i + 1}`);
    return {
      playerCount: Math.max(2, Number(el?.querySelector('[data-studio-field="pipeSpecPlayerCount"]')?.value) || fallback.playerCount),
      chapterCount: keys.length || chapterCount,
      targetWordCount: Number(el?.querySelector('[data-studio-field="pipeSpecTargetWords"]')?.value) || fallback.targetWordCount,
      sceneCount: Number(el?.querySelector('[data-studio-field="pipeSpecSceneCount"]')?.value) || fallback.sceneCount,
      investigationPointCount: Number(el?.querySelector('[data-studio-field="pipeSpecPointCount"]')?.value) || fallback.investigationPointCount,
      clueCount: Number(el?.querySelector('[data-studio-field="pipeSpecClueCount"]')?.value) || fallback.clueCount,
      chapterKeys: keys,
      constraints: PB().pipelineLinesToArray?.(el?.querySelector("[data-pipe-spec-constraints]")?.value),
      notes: PB().pipelineLinesToArray?.(el?.querySelector("[data-pipe-spec-notes]")?.value)
    };
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
    if (layer === "spec") session.spec = pipelineReadSpecFromDom(session.spec);
    else if (layer === "outline" && session.outline) session.outline = pipelineReadOutlineFromDom(session);
    else if (layer === "structure" && session.proposal) session.proposal = pipelineReadStructureFromDom(session);
    else if (layer === "matrix" && session.roleMatrix) session.roleMatrix = pipelineReadMatrixFromDom(session);
    else if (layer === "section") {
      const el = modal();
      const roleKey = el?.querySelector("[data-pipeline-role]")?.value || ctx.roleKey;
      const chapterKey = el?.querySelector("[data-pipeline-chapter]")?.value || ctx.chapterKey;
      const section = pipelineReadSectionFromDom(roleKey, chapterKey);
      if (section) {
        session.sections[roleKey] = session.sections[roleKey] || {};
        session.sections[roleKey][chapterKey] = section;
      }
    } else if (layer === "synopsis" && session.synopsis) session.synopsis = pipelineReadSynopsisFromDom(session);
  }

  function pipelineApplyLayerSave(session, layer, ctx, { lock = false } = {}) {
    const wasLocked = Boolean(session.locks?.[layer]);
    pipelinePersistActiveEditor(session, ctx);
    if (layer === "spec") {
      const spec = pipelineReadSpecFromDom(session.spec);
      if (lock && !PB().pipelineValidateSpec?.(spec)) return false;
      session.spec = spec;
    } else if (layer === "outline" && session.outline) session.outline = pipelineReadOutlineFromDom(session);
    else if (layer === "structure" && session.proposal) session.proposal = pipelineReadStructureFromDom(session);
    else if (layer === "matrix" && session.roleMatrix) session.roleMatrix = pipelineReadMatrixFromDom(session);
    else if (layer === "section") {
      const el = modal();
      const roleKey = el?.querySelector("[data-pipeline-role]")?.value || ctx.roleKey;
      const chapterKey = el?.querySelector("[data-pipeline-chapter]")?.value || ctx.chapterKey;
      const section = pipelineReadSectionFromDom(roleKey, chapterKey);
      if (!section) {
        showToast("分幕正文不能为空");
        return false;
      }
      session.sections[roleKey] = session.sections[roleKey] || {};
      session.sections[roleKey][chapterKey] = section;
    } else if (layer === "synopsis" && session.synopsis) session.synopsis = pipelineReadSynopsisFromDom(session);
    if (wasLocked) PS().pipelineClearDownstream?.(session, layer);
    if (lock) session.locks[layer] = true;
    else if (layer !== "section") session.locks[layer] = false;
    return true;
  }

  window.zhimuPipelineDom = {
    pipelineReadSpecFromDom,
    pipelineReadOutlineFromDom,
    pipelineReadStructureFromDom,
    pipelineReadMatrixFromDom,
    pipelineReadSectionFromDom,
    pipelineReadSynopsisFromDom,
    pipelinePersistActiveEditor,
    pipelineApplyLayerSave
  };
})(window);
export {};
