/** AI 分步创作 · 人机协作向导（生成 → 编辑 → 锁定 → 下一层） */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const { modal, modalBackdrop } = window.zhimuDom;
  const F = window.zhimuFormat || {};
  const M = window.zhimuModal || {};
  const T = window.zhimuToast || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatRelativeTime = F.formatRelativeTime || (() => "");
  const formatTime = F.formatTime || (() => "");
  const showToast = T.showToast || (() => {});
  const closeModal = M.closeModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const go = window.zhimuGo;
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }

  const AiDraft = () => window.zhimuAiDraft;
  const PIPELINE_LAYER_ORDER = ["spec", "outline", "structure", "matrix", "section", "synopsis", "evaluate"];
  const PIPELINE_LAYER_LABEL = { brief: "创作 brief", spec: "规格", outline: "总纲", structure: "编排结构", roleMatrix: "角色矩阵", matrix: "角色矩阵", section: "私人分幕", synopsis: "短母稿", evaluate: "评判" };
  const PIPELINE_LAYER_DEPS = { spec: [], outline: ["spec"], structure: ["spec", "outline"], matrix: ["spec", "outline", "structure"], section: ["spec", "outline", "structure", "matrix"], synopsis: ["spec", "outline", "structure"], evaluate: ["structure"] };
  const REVISION_PRIORITY_LABEL = { must_fix: "必改", should_fix: "建议改", optional: "可选" };

  function aiDraftWorldId() { return zhimuApi.context?.worldId || ""; }
  function collectAiFormFields() {
    const v = studioValues();
    return { aiTitle: v.aiTitle, aiPremise: v.aiPremise, aiStyle: v.aiStyle, aiRequirements: v.aiRequirements, aiRoleRequirements: v.aiRoleRequirements, aiEvalFocus: v.aiEvalFocus, aiPlayerCount: v.aiPlayerCount, aiTargetWordCount: v.aiTargetWordCount, aiChapterCount: v.aiChapterCount, aiSceneCount: v.aiSceneCount, aiPointCount: v.aiPointCount, aiClueCount: v.aiClueCount };
  }
  function restoreAiFormFields(form) {
    if (!form || !modal) return;
    for (const [field, value] of Object.entries(form)) {
      const el = modal.querySelector(`[data-studio-field="${field}"]`);
      if (el && value != null && value !== "") el.value = value;
    }
  }
  function saveLocalAiDraft(kind, payload, { silent = false } = {}) {
    const worldId = aiDraftWorldId();
    if (!worldId) return null;
    const result = AiDraft()?.save(worldId, kind, payload);
    if (!result?.ok && !silent) showToast(result?.error === "DRAFT_TOO_LARGE" ? "本地草稿过大，请精简分幕后再保存" : "无法写入浏览器本地存储");
    return result;
  }
  function loadLocalAiDraft(kind) { return AiDraft()?.load(aiDraftWorldId(), kind) || null; }
  function clearLocalAiDraft(kind) { AiDraft()?.clear(aiDraftWorldId(), kind); }
  function aiLocalDraftNote(savedAt) { return savedAt ? `<p class="muted-note local-draft-note">已保存到本机浏览器，尚未上传云端 · ${formatRelativeTime(savedAt) || formatTime(savedAt)}</p>` : ""; }
  function aiLocalDraftActions() { return `<button class="text-btn" type="button" data-ai-draft-clear>清除本地草稿</button>`; }
  function bindAiDraftClear(kind, onClear) {
    const btn = modal.querySelector("[data-ai-draft-clear]");
    if (!btn) return;
    btn.onclick = () => { clearLocalAiDraft(kind); onClear?.(); showToast("已清除本地 AI 草稿"); };
  }

  function pipelineBriefFromForm() {
    const values = studioValues();
    return {
      title: values.aiTitle, premise: values.aiPremise, style: values.aiStyle, requirements: values.aiRequirements,
      roleRequirements: values.aiRoleRequirements, evaluationFocus: values.aiEvalFocus,
      playerCount: Number(values.aiPlayerCount) || 6, targetWordCount: Number(values.aiTargetWordCount),
      chapterCount: Number(values.aiChapterCount), sceneCount: Number(values.aiSceneCount),
      investigationPointCount: Number(values.aiPointCount), clueCount: Number(values.aiClueCount),
      existingManuscript: modal.querySelector("[data-ai-reference]")?.checked ? modal.dataset.referenceManuscript || "" : ""
    };
  }

  function defaultSpecFromBrief() {
    const brief = pipelineBriefFromForm();
    const chapterCount = Math.max(1, Number(brief.chapterCount) || 3);
    const chapterKeys = Array.from({ length: chapterCount }, (_, i) => `ch${i + 1}`);
    const constraints = brief.requirements?.trim() ? pipelineLinesToArray(brief.requirements) : [];
    return {
      playerCount: Math.max(2, Number(brief.playerCount) || 6),
      chapterCount,
      targetWordCount: Number(brief.targetWordCount) || 6000,
      sceneCount: Number(brief.sceneCount) || 8,
      investigationPointCount: Number(brief.investigationPointCount) || 10,
      clueCount: Number(brief.clueCount) || 10,
      chapterKeys,
      constraints,
      notes: []
    };
  }

  function pipelineValidateSpec(spec) {
    if (!spec?.chapterKeys?.length) { showToast("请填写至少一个章节 key"); return false; }
    if ((spec.playerCount || 0) < 2) { showToast("玩家人数至少 2"); return false; }
    return true;
  }

  function pipelineLinesToArray(text) { return String(text || "").split(/\n/).map((line) => line.trim()).filter(Boolean); }
  function pipelineArrayToLines(items) { return (items || []).join("\n"); }

  function defaultPipelineSession() {
    return { spec: null, outline: null, proposal: null, roleMatrix: null, sections: {}, synopsis: null, evaluation: null, locks: {}, activeLayer: "spec", _editorRev: {} };
  }

  function normalizePipelineSession(raw) {
    const session = defaultPipelineSession();
    if (!raw) return session;
    Object.assign(session, {
      spec: raw.spec ?? null, outline: raw.outline ?? null, proposal: raw.proposal ?? null,
      roleMatrix: raw.roleMatrix ?? null, sections: raw.sections || {}, synopsis: raw.synopsis ?? null,
      evaluation: raw.evaluation ?? null, locks: raw.locks || {}, activeLayer: raw.activeLayer || "spec",
      _editorRev: raw._editorRev || {}
    });
    if (!raw.locks) {
      if (session.spec) session.locks.spec = Boolean(session.outline);
      if (session.outline) session.locks.outline = Boolean(session.proposal);
      if (session.proposal) session.locks.structure = Boolean(session.roleMatrix);
      if (session.roleMatrix) session.locks.matrix = Object.values(session.sections || {}).some((chapters) => Object.keys(chapters || {}).length);
    }
    return session;
  }

  function pipelineLayerHasData(session, layer) {
    if (layer === "spec") return Boolean(session.spec);
    if (layer === "outline") return Boolean(session.outline);
    if (layer === "structure") return Boolean(session.proposal);
    if (layer === "matrix") return Boolean(session.roleMatrix);
    if (layer === "section") return Object.values(session.sections || {}).some((chapters) => Object.keys(chapters || {}).length);
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
      else if (layer === "outline") session.outline = null;
    }
  }

  function pipelineStepLabel(step) {
    return ({ spec: "① 规格", outline: "② 总纲", structure: "③ 编排结构", matrix: "④ 角色矩阵", section: "⑤ 私人分幕", synopsis: "⑥ 短母稿", evaluate: "⑦ 评判" })[step] || step;
  }
  /** 去掉「① 」前缀，仅保留层级名（slice(3) 会误截 UTF-16 中文） */
  function pipelineStepName(step) {
    const label = pipelineStepLabel(step);
    const space = label.indexOf(" ");
    return space >= 0 ? label.slice(space + 1) : label;
  }

  function pipelineEvaluationPreview(evaluation) {
    if (!evaluation) return "";
    const scoreRows = Object.entries(evaluation.scores || {}).map(([key, score]) => {
      const labels = { playability: "可玩性", fairness: "公平推理", multiRoleDesign: "多人设计", pacing: "章节节奏", graphReady: "编排可落地", consistency: "内部一致", styleFit: "风格契合" };
      return `<span>${labels[key] || key} ${score}/10</span>`;
    }).join("");
    const style = evaluation.styleAlignment || {};
    const revisionRows = (evaluation.revisions || []).map((rev) => `<article class="revision-row ${rev.priority}"><div class="revision-head"><span class="cloud-pill">${REVISION_PRIORITY_LABEL[rev.priority] || rev.priority}</span><b>${escapeHtml(PIPELINE_LAYER_LABEL[rev.targetLayer] || rev.targetLayer)}${rev.targetKey ? ` · ${escapeHtml(rev.targetKey)}` : ""}</b></div><p><strong>问题</strong> ${escapeHtml(rev.problem)}</p><p><strong>方向</strong> ${escapeHtml(rev.direction)}</p>${rev.preserve ? `<p><strong>保留</strong> ${escapeHtml(rev.preserve)}</p>` : ""}${rev.promptHint ? `<p class="prompt-hint"><strong>下轮提示</strong> ${escapeHtml(rev.promptHint)}</p>` : ""}</article>`).join("") || `<div class="empty-state">暂无分层修改建议</div>`;
    const nextSteps = (evaluation.nextStepOrder || []).map((layer) => PIPELINE_LAYER_LABEL[layer] || layer).join(" → ");
    return `<section class="assistant-preview evaluation-preview"><div class="section-head"><div><p class="section-kicker">质检 · 修改指导</p><h3>${evaluation.overallScore}/10 · ${escapeHtml(evaluation.verdict || "")}</h3><p>${evaluation.readyForImport ? "✓ 可考虑导入" : "✗ 建议按修改方向重生成后再导入"}</p></div></div><div class="proposal-stats">${scoreRows}</div>${style.summary ? `<div class="assistant-guide"><b>风格契合 · ${escapeHtml(style.matchLevel || "medium")}</b><span>${escapeHtml(style.summary)}</span></div>` : ""}${nextSteps ? `<p class="muted-note"><b>建议重生成顺序</b> ${escapeHtml(nextSteps)}</p>` : ""}<div class="revision-list"><h4>分层修改方向</h4>${revisionRows}</div></section>`;
  }

  function pipelinePreviewHtml(session) {
    const parts = [];
    if (session.spec) parts.push(`<span>${session.spec.playerCount} 人 · ${session.spec.chapterKeys?.length || 0} 章</span>`);
    if (session.outline) parts.push(`<span>总纲：${escapeHtml((session.outline.logline || "").slice(0, 48))}</span>`);
    if (session.proposal) parts.push(`<span>${session.proposal.scenes?.length || 0} 场景 · ${session.proposal.edges?.length || 0} 边</span>`);
    if (session.roleMatrix) parts.push(`<span>${session.roleMatrix.roles?.length || 0} 角色矩阵</span>`);
    const sectionCount = Object.values(session.sections || {}).reduce((n, chapters) => n + Object.keys(chapters || {}).length, 0);
    if (sectionCount) parts.push(`<span>${sectionCount} 段分幕已确认</span>`);
    if (session.synopsis) parts.push(`<span>母稿 ${session.synopsis.overallManuscript?.length || 0} 字</span>`);
    return parts.length ? `<div class="proposal-stats">${parts.join("")}</div>` : "";
  }

  function pipelineLadderHtml(session, activeLayer) {
    return PIPELINE_LAYER_ORDER.map((layer) => {
      const status = pipelineLayerStatus(session, layer);
      const statusLabel = { empty: layer === "spec" ? "待填写" : "待生成", draft: "待确认", locked: "已锁定" }[status];
      return `<button type="button" class="pipeline-ladder-item ${layer === activeLayer ? "active" : ""} status-${status}" data-pipeline-layer="${layer}"><span class="pipeline-ladder-seq">${pipelineStepLabel(layer).slice(0, 2)}</span><span class="pipeline-ladder-text"><b>${escapeHtml(pipelineStepName(layer))}</b><small>${statusLabel}</small></span></button>`;
    }).join("");
  }

  function pipelineLayerHeadHtml(layer, session) {
    const status = pipelineLayerStatus(session, layer);
    const statusNote = {
      empty: layer === "spec" ? "请直接填写下方规格（人数、章节、规模等），本层不用 AI。填好后点「确认本层并继续」。" : "请填写 brief 后 AI 生成初稿，或直接编辑下方字段。",
      draft: "修改满意后点「确认本层」，再生成下一层。",
      locked: "本层已锁定，可继续编辑；保存后会清除下游内容。"
    }[status];
    const depNote = (PIPELINE_LAYER_DEPS[layer] || []).length && !pipelineDepsLocked(session, layer)
      ? `<p class="pipeline-dep-warn">请先在左侧完成并锁定：${(PIPELINE_LAYER_DEPS[layer] || []).map((item) => pipelineStepName(item)).join("、")}</p>` : "";
    return `<div class="pipeline-layer-head-inner"><div><p class="section-kicker">${pipelineStepLabel(layer)}</p><h3>${escapeHtml(PIPELINE_LAYER_LABEL[layer] || layer)}</h3><p class="wizard-intro">${statusNote || ""}</p>${depNote}</div><span class="cloud-pill pipeline-status-pill status-${status}">${{ empty: layer === "spec" ? "待填写" : "待生成", draft: "待确认", locked: "已锁定" }[status]}</span></div>`;
  }

  function pipelineSpecEditorHtml(spec) {
    const s = spec || defaultSpecFromBrief();
    return `<div class="pipeline-edit-grid">${studioField("玩家人数", "pipeSpecPlayerCount", "input", String(s.playerCount || 6))}${studioField("章节数", "pipeSpecChapterCount", "input", String(s.chapterCount || s.chapterKeys?.length || 3))}${studioField("建议总字数", "pipeSpecTargetWords", "input", String(s.targetWordCount || 6000))}${studioField("场景数", "pipeSpecSceneCount", "input", String(s.sceneCount || 8))}${studioField("调查点数", "pipeSpecPointCount", "input", String(s.investigationPointCount || 10))}${studioField("线索数", "pipeSpecClueCount", "input", String(s.clueCount || 10))}<label>章节 key（逗号分隔）</label><input class="field" data-pipe-spec-chapter-keys value="${escapeHtml((s.chapterKeys || []).join(", "))}"><label>约束（每行一条）</label><textarea class="field" rows="3" data-pipe-spec-constraints>${escapeHtml(pipelineArrayToLines(s.constraints))}</textarea><label>备注（每行一条）</label><textarea class="field" rows="3" data-pipe-spec-notes>${escapeHtml(pipelineArrayToLines(s.notes))}</textarea><p class="muted-note">数值可从左侧 brief 预填；确认后才会锁定并进入总纲 AI 生成。</p></div>`;
  }

  function pipelineOutlineEditorHtml(outline) {
    if (!outline) return `<div class="empty-state">请先生成并确认规格，再生成总纲。</div>`;
    const beats = (outline.chapterBeats || []).map((beat, index) => `<article class="pipeline-beat-card" data-beat-index="${index}"><input type="hidden" data-pipe-beat-key value="${escapeHtml(beat.chapterKey || "")}">${studioField(`第 ${index + 1} 章标题`, "pipeBeatTitle" + index, "input", beat.title || "")}${studioField("本章目标", "pipeBeatGoal" + index, "textarea", beat.goal || "")}${studioField("本章转折", "pipeBeatTurn" + index, "textarea", beat.turn || "")}${studioField("主持备注", "pipeBeatHost" + index, "textarea", beat.hostNotes || "")}</article>`).join("");
    return `<div class="pipeline-edit-grid">${studioField("一句话 logline", "pipeOutlineLogline", "textarea", outline.logline || "")}${studioField("幕后真相时间线", "pipeOutlineTruth", "textarea", outline.truthTimeline || "")}<label>误导线（每行一条）</label><textarea class="field" rows="3" data-pipe-outline-red>${escapeHtml(pipelineArrayToLines(outline.redHerrings))}</textarea><div class="pipeline-beat-list"><h4>章节节拍</h4>${beats}</div></div>`;
  }

  function pipelineStructureEditorHtml(proposal) {
    if (!proposal) return `<div class="empty-state">请先生成并确认总纲，再生成编排结构（原「结构提案」内容在此编辑）。</div>`;
    const chapters = (proposal.chapters || []).map((ch) => `<article class="pipeline-mini-card"><input type="hidden" data-pipe-chapter-key value="${escapeHtml(ch.key)}">${studioField("章节标题", "pipeChTitle" + ch.key, "input", ch.title || "")}${studioField("章节摘要", "pipeChSummary" + ch.key, "textarea", ch.summary || "")}</article>`).join("");
    const scenes = (proposal.scenes || []).map((sc) => `<article class="pipeline-mini-card"><input type="hidden" data-pipe-scene-key value="${escapeHtml(sc.key)}"><b>${escapeHtml(sc.key)}</b>${studioField("场景名", "pipeScName" + sc.key, "input", sc.name || "")}${studioField("公开描述", "pipeScPublic" + sc.key, "textarea", sc.publicText || "")}</article>`).join("");
    const clues = (proposal.clues || []).map((cl) => `<article class="pipeline-mini-card inline"><input type="hidden" data-pipe-clue-key value="${escapeHtml(cl.key)}">${studioField("线索", "pipeClName" + cl.key, "input", cl.name || "")}</article>`).join("");
    const sceneCount = proposal.scenes?.length || 0;
    const chapterOpen = (proposal.chapters?.length || 0) <= 4 ? " open" : "";
    const sceneOpen = sceneCount <= 4 ? " open" : "";
    return `<div class="pipeline-edit-grid">${studioField("剧本标题", "pipeStructTitle", "input", proposal.title || "")}${studioField("logline", "pipeStructLogline", "textarea", proposal.logline || "")}<div class="proposal-stats"><span>${proposal.chapters?.length || 0} 章</span><span>${sceneCount} 场景</span><span>${proposal.investigationPoints?.length || 0} 调查点</span><span>${proposal.clues?.length || 0} 线索</span><span>${proposal.edges?.length || 0} 连线</span></div><details${chapterOpen}><summary>章节</summary><div class="pipeline-card-grid">${chapters}</div></details><details${sceneOpen}><summary>场景</summary><div class="pipeline-card-grid">${scenes}</div></details><details><summary>线索名称</summary><div class="pipeline-card-grid inline-grid">${clues}</div></details><p class="muted-note">调查点与连线由 AI 生成，细调请上传后在编排台修改。场景/章节较多时默认折叠以减轻卡顿。</p></div>`;
  }

  function pipelineMatrixEditorHtml(matrix, proposal) {
    if (!matrix) return `<div class="empty-state">请先生成并确认编排结构，再生成角色矩阵。</div>`;
    const chapterTitles = new Map((proposal?.chapters || []).map((ch) => [ch.key, ch.title]));
    const roles = (matrix.roles || []).map((role) => {
      const knowledge = (role.chapterKnowledge || []).map((row) => `<article class="pipeline-knowledge-row"><b>${escapeHtml(chapterTitles.get(row.chapterKey) || row.chapterKey || "章节")}</b>${studioField("知道什么", "pipeKnow" + role.key + row.chapterKey, "textarea", row.knows || "")}${studioField("必须隐瞒", "pipeHide" + role.key + row.chapterKey, "textarea", row.mustHide || "")}${studioField("可讨论", "pipeDiscuss" + role.key + row.chapterKey, "textarea", row.canDiscuss || "")}</article>`).join("");
      return `<article class="pipeline-role-card" data-pipe-role-card="${escapeHtml(role.key)}"><h4>${escapeHtml(role.name || role.key)}</h4>${studioField("角色名", "pipeRoleName" + role.key, "input", role.name || "")}${studioField("公开身份", "pipeRolePublic" + role.key, "textarea", role.publicProfile || "")}${studioField("私人秘密", "pipeRolePrivate" + role.key, "textarea", role.privateProfile || "")}<div class="pipeline-knowledge-list">${knowledge}</div></article>`;
    }).join("");
    return `<div class="pipeline-edit-grid pipeline-matrix-grid">${roles}</div>`;
  }

  function pipelineSectionListHtml(session) {
    const rows = [];
    for (const [roleKey, chapters] of Object.entries(session.sections || {})) {
      for (const [chapterKey, section] of Object.entries(chapters || {})) {
        const roleName = session.roleMatrix?.roles?.find((r) => r.key === roleKey)?.name || roleKey;
        const chapterTitle = session.proposal?.chapters?.find((ch) => ch.key === chapterKey)?.title || chapterKey;
        rows.push(`<button type="button" class="pipeline-section-chip" data-pipeline-pick-section="${escapeHtml(roleKey)}|${escapeHtml(chapterKey)}">${escapeHtml(roleName)} · ${escapeHtml(chapterTitle)} · ${(section.body || "").length} 字</button>`);
      }
    }
    return rows.length ? `<div class="pipeline-section-list"><h4>已确认分幕</h4><div class="pipeline-section-chips">${rows.join("")}</div></div>` : "";
  }

  function pipelineSectionEditorHtml(session, roleKey, chapterKey) {
    const section = session.sections?.[roleKey]?.[chapterKey];
    const roleOptions = (session.roleMatrix?.roles || []).map((r) => `<option value="${escapeHtml(r.key)}" ${r.key === roleKey ? "selected" : ""}>${escapeHtml(r.name)}</option>`).join("");
    const chapterOptions = (session.proposal?.chapters || []).map((ch) => `<option value="${escapeHtml(ch.key)}" ${ch.key === chapterKey ? "selected" : ""}>${escapeHtml(ch.title)}</option>`).join("");
    if (!session.roleMatrix || !session.proposal) return `<div class="empty-state">请先生成并确认角色矩阵与编排结构。</div>`;
    return `<div class="pipeline-edit-grid"><label>角色</label><select class="field" data-pipeline-role>${roleOptions}</select><label>章节</label><select class="field" data-pipeline-chapter>${chapterOptions}</select>${studioField("分幕标题", "pipeSectionTitle", "input", section?.title || "")}<label>私人正文</label><textarea class="field manuscript-body" rows="14" data-pipe-section-body>${escapeHtml(section?.body || "")}</textarea><div data-pipeline-section-list-host>${pipelineSectionListHtml(session)}</div></div>`;
  }

  function pipelineSynopsisEditorHtml(synopsis) {
    if (!synopsis) return `<div class="empty-state">可选：在分幕后生成短母稿（创作者幕后总览）。</div>`;
    return `<div class="pipeline-edit-grid">${studioField("标题", "pipeSynTitle", "input", synopsis.title || "")}${studioField("摘要", "pipeSynSummary", "textarea", synopsis.summary || "")}<label>幕后总稿</label><textarea class="field manuscript-body" rows="12" data-pipe-synopsis-body>${escapeHtml(synopsis.overallManuscript || "")}</textarea><label>逻辑说明（每行一条）</label><textarea class="field" rows="4" data-pipe-synopsis-notes>${escapeHtml(pipelineArrayToLines(synopsis.logicNotes))}</textarea></div>`;
  }

  function pipelineLayerEditorHtml(layer, session, ctx) {
    if (layer === "spec") return pipelineSpecEditorHtml(session.spec);
    if (layer === "outline") return pipelineOutlineEditorHtml(session.outline);
    if (layer === "structure") return pipelineStructureEditorHtml(session.proposal);
    if (layer === "matrix") return pipelineMatrixEditorHtml(session.roleMatrix, session.proposal);
    if (layer === "section") return pipelineSectionEditorHtml(session, ctx.roleKey, ctx.chapterKey);
    if (layer === "synopsis") return pipelineSynopsisEditorHtml(session.synopsis);
    if (layer === "evaluate") return session.evaluation ? pipelineEvaluationPreview(session.evaluation) : `<div class="empty-state">基于当前已锁定内容，AI 会给出分层修改建议（可选）。</div>`;
    return "";
  }

  function pipelineReadSpecFromDom(existing) {
    const fallback = existing || defaultSpecFromBrief();
    const chapterCount = Number(modal.querySelector('[data-studio-field="pipeSpecChapterCount"]')?.value) || fallback.chapterCount;
    let keys = String(modal.querySelector("[data-pipe-spec-chapter-keys]")?.value || "").split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (!keys.length && chapterCount) keys = Array.from({ length: chapterCount }, (_, i) => `ch${i + 1}`);
    return {
      playerCount: Math.max(2, Number(modal.querySelector('[data-studio-field="pipeSpecPlayerCount"]')?.value) || fallback.playerCount),
      chapterCount: keys.length || chapterCount,
      targetWordCount: Number(modal.querySelector('[data-studio-field="pipeSpecTargetWords"]')?.value) || fallback.targetWordCount,
      sceneCount: Number(modal.querySelector('[data-studio-field="pipeSpecSceneCount"]')?.value) || fallback.sceneCount,
      investigationPointCount: Number(modal.querySelector('[data-studio-field="pipeSpecPointCount"]')?.value) || fallback.investigationPointCount,
      clueCount: Number(modal.querySelector('[data-studio-field="pipeSpecClueCount"]')?.value) || fallback.clueCount,
      chapterKeys: keys,
      constraints: pipelineLinesToArray(modal.querySelector("[data-pipe-spec-constraints]")?.value),
      notes: pipelineLinesToArray(modal.querySelector("[data-pipe-spec-notes]")?.value)
    };
  }

  function pipelineReadOutlineFromDom(session) {
    if (!session.outline) return null;
    const outline = { ...session.outline };
    outline.logline = modal.querySelector('[data-studio-field="pipeOutlineLogline"]')?.value || outline.logline;
    outline.truthTimeline = modal.querySelector('[data-studio-field="pipeOutlineTruth"]')?.value || outline.truthTimeline;
    outline.redHerrings = pipelineLinesToArray(modal.querySelector("[data-pipe-outline-red]")?.value);
    outline.chapterBeats = (outline.chapterBeats || []).map((beat, index) => {
      const card = modal.querySelector(`[data-beat-index="${index}"]`);
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
    if (!session.proposal) return null;
    const proposal = { ...session.proposal, chapters: [...(session.proposal.chapters || [])], scenes: [...(session.proposal.scenes || [])], clues: [...(session.proposal.clues || [])] };
    proposal.title = modal.querySelector('[data-studio-field="pipeStructTitle"]')?.value || proposal.title;
    proposal.logline = modal.querySelector('[data-studio-field="pipeStructLogline"]')?.value || proposal.logline;
    proposal.chapters = proposal.chapters.map((ch) => ({ ...ch, title: modal.querySelector(`[data-studio-field="pipeChTitle${ch.key}"]`)?.value ?? ch.title, summary: modal.querySelector(`[data-studio-field="pipeChSummary${ch.key}"]`)?.value ?? ch.summary }));
    proposal.scenes = proposal.scenes.map((sc) => ({ ...sc, name: modal.querySelector(`[data-studio-field="pipeScName${sc.key}"]`)?.value ?? sc.name, publicText: modal.querySelector(`[data-studio-field="pipeScPublic${sc.key}"]`)?.value ?? sc.publicText }));
    proposal.clues = proposal.clues.map((cl) => ({ ...cl, name: modal.querySelector(`[data-studio-field="pipeClName${cl.key}"]`)?.value ?? cl.name }));
    return proposal;
  }

  function pipelineReadMatrixFromDom(session) {
    if (!session.roleMatrix) return null;
    const roles = (session.roleMatrix.roles || []).map((role) => {
      const key = role.key;
      return {
        ...role,
        name: modal.querySelector(`[data-studio-field="pipeRoleName${key}"]`)?.value ?? role.name,
        publicProfile: modal.querySelector(`[data-studio-field="pipeRolePublic${key}"]`)?.value ?? role.publicProfile,
        privateProfile: modal.querySelector(`[data-studio-field="pipeRolePrivate${key}"]`)?.value ?? role.privateProfile,
        chapterKnowledge: (role.chapterKnowledge || []).map((row) => {
          const ck = row.chapterKey;
          return {
            ...row,
            knows: modal.querySelector(`[data-studio-field="pipeKnow${key}${ck}"]`)?.value ?? row.knows,
            mustHide: modal.querySelector(`[data-studio-field="pipeHide${key}${ck}"]`)?.value ?? row.mustHide,
            canDiscuss: modal.querySelector(`[data-studio-field="pipeDiscuss${key}${ck}"]`)?.value ?? row.canDiscuss
          };
        })
      };
    });
    return { ...session.roleMatrix, roles };
  }

  function pipelineReadSectionFromDom(roleKey, chapterKey) {
    const title = modal.querySelector('[data-studio-field="pipeSectionTitle"]')?.value || "";
    const body = modal.querySelector("[data-pipe-section-body]")?.value || "";
    if (!body.trim()) return null;
    return { roleKey, chapterKey, title, body };
  }

  function pipelineReadSynopsisFromDom(session) {
    if (!session.synopsis) return null;
    return {
      ...session.synopsis,
      title: modal.querySelector('[data-studio-field="pipeSynTitle"]')?.value ?? session.synopsis.title,
      summary: modal.querySelector('[data-studio-field="pipeSynSummary"]')?.value ?? session.synopsis.summary,
      overallManuscript: modal.querySelector("[data-pipe-synopsis-body]")?.value ?? session.synopsis.overallManuscript,
      logicNotes: pipelineLinesToArray(modal.querySelector("[data-pipe-synopsis-notes]")?.value)
    };
  }

  function pipelinePersistActiveEditor(session, ctx) {
    const layer = session.activeLayer;
    if (layer === "spec") session.spec = pipelineReadSpecFromDom(session.spec);
    else if (layer === "outline" && session.outline) session.outline = pipelineReadOutlineFromDom(session);
    else if (layer === "structure" && session.proposal) session.proposal = pipelineReadStructureFromDom(session);
    else if (layer === "matrix" && session.roleMatrix) session.roleMatrix = pipelineReadMatrixFromDom(session);
    else if (layer === "section") {
      const roleKey = modal.querySelector("[data-pipeline-role]")?.value || ctx.roleKey;
      const chapterKey = modal.querySelector("[data-pipeline-chapter]")?.value || ctx.chapterKey;
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
      if (lock && !pipelineValidateSpec(spec)) return false;
      session.spec = spec;
    } else if (layer === "outline" && session.outline) session.outline = pipelineReadOutlineFromDom(session);
    else if (layer === "structure" && session.proposal) session.proposal = pipelineReadStructureFromDom(session);
    else if (layer === "matrix" && session.roleMatrix) session.roleMatrix = pipelineReadMatrixFromDom(session);
    else if (layer === "section") {
      const roleKey = modal.querySelector("[data-pipeline-role]")?.value || ctx.roleKey;
      const chapterKey = modal.querySelector("[data-pipeline-chapter]")?.value || ctx.chapterKey;
      const section = pipelineReadSectionFromDom(roleKey, chapterKey);
      if (!section) { showToast("分幕正文不能为空"); return false; }
      session.sections[roleKey] = session.sections[roleKey] || {};
      session.sections[roleKey][chapterKey] = section;
    } else if (layer === "synopsis" && session.synopsis) session.synopsis = pipelineReadSynopsisFromDom(session);
    if (wasLocked) pipelineClearDownstream(session, layer);
    if (lock) session.locks[layer] = true;
    else if (layer !== "section") session.locks[layer] = false;
    return true;
  }

  function pipelineLocationBarHtml(session, mode) {
    const stepLabel = pipelineStepName(session.activeLayer);
    const modeLabel = mode === "auto" ? "一键串行" : "分步参与";
    return `<div class="pipeline-location-bar"><span class="pipeline-loc-muted">创作中心</span><span class="pipeline-loc-arrow">→</span><strong>AI 悬疑创作</strong><span class="pipeline-loc-arrow">→</span><span data-pipeline-loc-step>${escapeHtml(stepLabel)}</span><span class="cloud-pill pipeline-loc-mode">${modeLabel}</span></div>`;
  }

  function pipelineModeTabsHtml(mode) {
    return `<div class="pipeline-mode-tabs" role="tablist"><button type="button" class="pipeline-mode-tab ${mode === "interactive" ? "active" : ""}" data-pipeline-mode="interactive">分步参与<span>AI 初稿 → 你改 → 确认</span></button><button type="button" class="pipeline-mode-tab ${mode === "auto" ? "active" : ""}" data-pipeline-mode="auto">一键串行<span>自动生成全部层级</span></button></div>`;
  }

  function pipelineBriefFieldsHtml() {
    const world = state.cloudStudio?.world;
    return `<details class="pipeline-brief-fold"><summary>创作 brief</summary><div class="pipeline-brief-grid"><div class="form-group">${studioField("剧本名称", "aiTitle", "input", world?.name || "")}${studioField("一句话构想", "aiPremise", "textarea", world?.summary || "")}${studioField("风格", "aiStyle", "input", "悬疑调查")}${studioField("玩家人数", "aiPlayerCount", "input", "6")}${studioField("角色要求", "aiRoleRequirements", "textarea", "身份差异明显，秘密咬合")}${studioField("限制", "aiRequirements", "textarea", "不要跑团数值")}${studioField("评判侧重", "aiEvalFocus", "textarea", "偏硬核推理；不要内奸破坏公平")}${studioField("总字数", "aiTargetWordCount", "input", "6000")}${studioField("章节", "aiChapterCount", "input", "3")}${studioField("场景", "aiSceneCount", "input", "8")}${studioField("调查点", "aiPointCount", "input", "10")}${studioField("线索", "aiClueCount", "input", "10")}<label class="check-label"><input type="checkbox" data-ai-reference checked> 参考母稿</label></div></div></details>`;
  }

  function pipelineWizardFrameHtml(status, session, pipelineMode) {
    const statusClass = status.configured ? "ready" : "missing";
    const statusText = status.configured ? `${escapeHtml(status.model)} · 120s/步` : "请配置 DEEPSEEK_API_KEY";
    return `<div class="pipeline-wizard-frame"><header class="pipeline-wizard-header"><div class="pipeline-wizard-title-row"><div><h2>AI 悬疑创作</h2><p class="pipeline-wizard-hint">左栏选层级与 brief · 右侧编辑 · 单次 AI 约 <strong>30～120 秒</strong></p></div><div class="deepseek-status pipeline-status-chip ${statusClass}"><b>${status.configured ? "DeepSeek 已连接" : "未配置"}</b><span>${statusText}</span></div></div>${pipelineLocationBarHtml(session, pipelineMode)}</header><div class="pipeline-wizard-body"><aside class="pipeline-wizard-side"><p class="pipeline-side-kicker">创作模式</p>${pipelineModeTabsHtml(pipelineMode)}<p class="pipeline-side-kicker">层级进度</p><nav class="pipeline-ladder" data-pipeline-ladder aria-label="创作层级"></nav>${pipelineBriefFieldsHtml()}</aside><main class="pipeline-wizard-main ${pipelineMode === "auto" ? "pipeline-auto-layout" : ""}"><div class="pipeline-auto-panel ${pipelineMode === "auto" ? "" : "hidden"}" data-pipeline-auto-panel><div class="pipeline-auto-row"><div class="assistant-guide pipeline-auto-guide"><b>一键串行</b><span>须先在① 规格手动填写并确认；之后自动：总纲 → 编排 → 矩阵 → 分幕 → 母稿。</span></div><button type="button" class="primary-btn" data-pipeline-auto-run ${status.configured ? "" : "disabled"}>开始生成</button></div><p class="muted-note pipeline-auto-progress" data-pipeline-auto-progress>尚未开始</p></div><div class="pipeline-layer-head" data-pipeline-layer-head></div><div class="pipeline-layer-editor" data-pipeline-layer-editor></div><footer class="pipeline-layer-bar"><div class="pipeline-layer-actions row" data-pipeline-layer-actions></div><div class="pipeline-summary" data-pipeline-summary></div></footer></main></div><footer class="pipeline-wizard-footer"><div class="pipeline-wizard-footer-left">${aiLocalDraftActions()}</div><div class="pipeline-wizard-footer-right"><button class="secondary-btn" type="button" data-close>关闭</button><button class="secondary-btn" type="button" data-pipeline-apply-hints disabled>应用评判提示</button><button class="secondary-btn" type="button" data-pipeline-import-structure disabled>仅上传编排</button><button class="primary-btn" type="button" data-pipeline-import-all disabled>上传全部到云端</button></div></footer></div>`;
  }

  function migrateLegacyDrafts(session, existingDraft, restoreForm) {
    if (!session.proposal) {
      const structureDraft = loadLocalAiDraft(AiDraft()?.KIND?.STRUCTURE);
      if (structureDraft?.payload?.proposal) {
        session.proposal = structureDraft.payload.proposal;
        session.locks.structure = false;
        session.activeLayer = "structure";
        if (structureDraft.payload.form && !existingDraft?.payload?.form) restoreForm(structureDraft.payload.form);
      }
    }
    if (!session.spec) {
      const fullDraft = loadLocalAiDraft(AiDraft()?.KIND?.FULL_MYSTERY);
      const mystery = fullDraft?.payload?.mystery;
      if (mystery) {
        if (mystery.spec) session.spec = mystery.spec;
        if (mystery.outline) session.outline = mystery.outline;
        if (mystery.proposal) session.proposal = mystery.proposal;
        if (mystery.roleMatrix) session.roleMatrix = mystery.roleMatrix;
        if (mystery.synopsis) session.synopsis = mystery.synopsis;
        const pkg = mystery.package;
        if (pkg && !Object.keys(session.sections || {}).length) {
          session.sections = {};
          for (const role of pkg.roles || []) {
            session.sections[role.key] = {};
            for (const sec of role.sections || []) {
              session.sections[role.key][sec.chapterKey] = { roleKey: role.key, chapterKey: sec.chapterKey, title: sec.title, body: sec.body };
            }
          }
          if (!session.synopsis && pkg.overallManuscript) {
            session.synopsis = { title: pkg.title, summary: pkg.summary, overallManuscript: pkg.overallManuscript, logicNotes: pkg.logicNotes || [] };
          }
        }
        if (fullDraft.payload.form && !existingDraft?.payload?.form) restoreForm(fullDraft.payload.form);
      }
    }
  }

  async function openDeepseekPipeline(options = {}) {
    try {
      const [status, manuscript] = await Promise.all([zhimuApi.getDeepseekStatus(), zhimuApi.getStoryManuscript()]);
      const draftKind = AiDraft()?.KIND?.PIPELINE;
      const existingDraft = loadLocalAiDraft(draftKind);
      const session = normalizePipelineSession(existingDraft?.payload?.session);
      let draftSavedAt = existingDraft?.savedAt || null;
      let pipelineMode = options.mode === "auto" ? "auto" : (existingDraft?.payload?.mode || "interactive");
      const ctx = { roleKey: session.roleMatrix?.roles?.[0]?.key || "", chapterKey: session.proposal?.chapters?.[0]?.key || "" };
      if (options.focusLayer && PIPELINE_LAYER_ORDER.includes(options.focusLayer)) session.activeLayer = options.focusLayer;
      migrateLegacyDrafts(session, existingDraft, restoreAiFormFields);

      modal.className = "modal deepseek-modal pipeline-modal pipeline-wizard-modal";
      modal.dataset.referenceManuscript = manuscript.body || "";
      modal.innerHTML = pipelineWizardFrameHtml(status, session, pipelineMode);
      modalBackdrop.classList.add("show");
      modal.querySelectorAll("[data-close]").forEach((btn) => { btn.onclick = () => { flushDraftSave(); uiAbort.abort(); closeModal(); }; });
      if (existingDraft?.payload?.form) restoreAiFormFields(existingDraft.payload.form);

      const ladder = modal.querySelector("[data-pipeline-ladder]");
      const layerHead = modal.querySelector("[data-pipeline-layer-head]");
      const layerEditor = modal.querySelector("[data-pipeline-layer-editor]");
      const layerActions = modal.querySelector("[data-pipeline-layer-actions]");
      const summaryEl = modal.querySelector("[data-pipeline-summary]");
      const importStructure = modal.querySelector("[data-pipeline-import-structure]");
      const importAll = modal.querySelector("[data-pipeline-import-all]");
      const applyHints = modal.querySelector("[data-pipeline-apply-hints]");
      const autoPanel = modal.querySelector("[data-pipeline-auto-panel]");
      const autoProgress = modal.querySelector("[data-pipeline-auto-progress]");
      const autoRunBtn = modal.querySelector("[data-pipeline-auto-run]");

      const pipelinePayload = () => ({
        ...pipelineBriefFromForm(), evaluationFocus: studioValues().aiEvalFocus,
        spec: session.spec, outline: session.outline, proposal: session.proposal,
        roleMatrix: session.roleMatrix, sections: session.sections, synopsis: session.synopsis,
        sampleSection: Object.entries(session.sections).flatMap(([roleKey, chapters]) => Object.entries(chapters || {}).map(([chapterKey, section]) => ({ ...section, roleKey, chapterKey })))[0]
      });

      let lastDraftFingerprint = "";
      let draftSaveTimer = null;
      const flushDraftSave = () => {
        if (draftSaveTimer) { clearTimeout(draftSaveTimer); draftSaveTimer = null; }
        const payload = { form: collectAiFormFields(), session, mode: pipelineMode };
        const fp = JSON.stringify(payload);
        if (fp === lastDraftFingerprint) return null;
        lastDraftFingerprint = fp;
        const saved = saveLocalAiDraft(draftKind, payload, { silent: true });
        if (saved?.ok) draftSavedAt = saved.savedAt;
        return saved;
      };
      const scheduleDraftSave = () => {
        clearTimeout(draftSaveTimer);
        draftSaveTimer = setTimeout(flushDraftSave, 450);
      };

      const afterSessionChange = ({ editor = true, saveNow = false } = {}) => {
        if (saveNow) flushDraftSave();
        else scheduleDraftSave();
        renderPipelineUi({ editor });
      };

      let uiAbort = new AbortController();
      let lastLadderStatusFp = "";
      let lastHeadFp = "";
      let lastEditorKey = "";
      let lastActionsFp = "";
      let renderFrame = null;
      let pendingRender = { editor: true };

      const ladderStatusFingerprint = () => PIPELINE_LAYER_ORDER.map((layer) => `${layer}:${pipelineLayerStatus(session, layer)}`).join("|");
      const editorRenderKey = () => {
        const rev = session._editorRev?.[session.activeLayer] || 0;
        const sectionCtx = session.activeLayer === "section" ? `${ctx.roleKey}|${ctx.chapterKey}` : "";
        return `${session.activeLayer}:${rev}:${sectionCtx}`;
      };
      const bumpEditorRevision = (layer) => {
        session._editorRev = session._editorRev || {};
        session._editorRev[layer] = (session._editorRev[layer] || 0) + 1;
      };
      const actionsFingerprint = () => {
        const layer = session.activeLayer;
        const hasData = layer === "spec" ? true : pipelineLayerHasData(session, layer);
        const canGenerate = status.configured && layer !== "spec" && pipelineDepsLocked(session, layer);
        return `${layer}:${pipelineMode}:${hasData}:${canGenerate}:${Boolean(session.proposal)}:${Boolean(session.evaluation?.revisions?.length)}`;
      };

      const updateLadderActive = () => {
        ladder.querySelectorAll("[data-pipeline-layer]").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.pipelineLayer === session.activeLayer);
        });
      };

      const renderLadder = () => {
        const fp = ladderStatusFingerprint();
        if (fp === lastLadderStatusFp && ladder.children.length) {
          updateLadderActive();
          return;
        }
        lastLadderStatusFp = fp;
        ladder.innerHTML = pipelineLadderHtml(session, session.activeLayer);
      };

      const updateLocationBar = () => {
        const stepEl = modal.querySelector("[data-pipeline-loc-step]");
        const modeEl = modal.querySelector(".pipeline-loc-mode");
        if (stepEl) stepEl.textContent = pipelineStepName(session.activeLayer);
        if (modeEl) modeEl.textContent = pipelineMode === "auto" ? "一键串行" : "分步参与";
      };

      const bindPipelineUiEvents = () => {
        const frame = modal.querySelector(".pipeline-wizard-frame");
        if (!frame || frame.dataset.pipelineUiBound) return;
        frame.dataset.pipelineUiBound = "1";
        const signal = uiAbort.signal;

        frame.addEventListener("click", (event) => {
          const layerBtn = event.target.closest("[data-pipeline-layer]");
          if (layerBtn) {
            pipelinePersistActiveEditor(session, ctx);
            session.activeLayer = layerBtn.dataset.pipelineLayer;
            renderPipelineUi();
            return;
          }
          const pickBtn = event.target.closest("[data-pipeline-pick-section]");
          if (pickBtn) {
            pipelinePersistActiveEditor(session, ctx);
            const [roleKey, chapterKey] = pickBtn.dataset.pipelinePickSection.split("|");
            ctx.roleKey = roleKey;
            ctx.chapterKey = chapterKey;
            renderPipelineUi();
            return;
          }
          if (event.target.closest("[data-pipeline-generate]")) runPipelineGenerate();
          else if (event.target.closest("[data-pipeline-save]")) {
            const layer = session.activeLayer;
            if (pipelineApplyLayerSave(session, layer, ctx, { lock: false })) {
              afterSessionChange({ editor: false, saveNow: true });
              showToast("已保存修改");
            }
          } else if (event.target.closest("[data-pipeline-lock]")) {
            const layer = session.activeLayer;
            if (!pipelineApplyLayerSave(session, layer, ctx, { lock: true })) return;
            const next = PIPELINE_LAYER_ORDER[PIPELINE_LAYER_ORDER.indexOf(layer) + 1];
            if (next) session.activeLayer = next;
            afterSessionChange({ saveNow: true });
            showToast(layer === "section" ? "本分幕已确认" : layer === "spec" ? "规格已确认" : "本层已锁定，可生成下一层");
          }
        }, { signal });

        frame.addEventListener("change", (event) => {
          if (event.target.matches("[data-pipeline-role]")) {
            pipelinePersistActiveEditor(session, ctx);
            ctx.roleKey = event.target.value;
            renderPipelineUi();
          } else if (event.target.matches("[data-pipeline-chapter]")) {
            pipelinePersistActiveEditor(session, ctx);
            ctx.chapterKey = event.target.value;
            renderPipelineUi();
          }
        }, { signal });
      };

      const renderLayerActions = () => {
        const fp = actionsFingerprint();
        if (fp === lastActionsFp && layerActions.children.length) return;
        lastActionsFp = fp;
        const layer = session.activeLayer;
        const hasData = layer === "spec" ? true : pipelineLayerHasData(session, layer);
        const canGenerate = status.configured && layer !== "spec" && pipelineDepsLocked(session, layer);
        const interactiveActions = pipelineMode === "interactive";
        const generateBtn = interactiveActions && layer !== "evaluate" && layer !== "spec"
          ? `<button class="secondary-btn" type="button" data-pipeline-generate ${canGenerate ? "" : "disabled"}>${hasData ? "重新 AI 生成" : "AI 生成初稿"}</button>`
          : interactiveActions && layer === "evaluate"
            ? `<button class="secondary-btn" type="button" data-pipeline-generate ${status.configured && session.proposal ? "" : "disabled"}>AI 评判</button>`
            : "";
        const saveBtn = interactiveActions && hasData && layer !== "evaluate" ? `<button class="text-btn" type="button" data-pipeline-save>保存修改</button>` : "";
        const lockBtn = interactiveActions && hasData && layer !== "evaluate" ? `<button class="primary-btn" type="button" data-pipeline-lock>${layer === "section" ? "确认本分幕" : layer === "spec" ? "确认规格并继续" : "确认本层并继续"}</button>` : "";
        layerActions.innerHTML = interactiveActions ? `${generateBtn}${saveBtn}${lockBtn}` : `<p class="muted-note">一键模式下请用上方「开始一键串行生成」；生成后可在左侧选层编辑。</p>`;
      };

      const patchSectionEditor = () => {
        const roleSelect = layerEditor.querySelector("[data-pipeline-role]");
        const chapterSelect = layerEditor.querySelector("[data-pipeline-chapter]");
        if (!roleSelect || !chapterSelect) return false;
        roleSelect.value = ctx.roleKey;
        chapterSelect.value = ctx.chapterKey;
        const section = session.sections?.[ctx.roleKey]?.[ctx.chapterKey];
        const titleEl = layerEditor.querySelector('[data-studio-field="pipeSectionTitle"]');
        const bodyEl = layerEditor.querySelector("[data-pipe-section-body]");
        if (titleEl) titleEl.value = section?.title || "";
        if (bodyEl) bodyEl.value = section?.body || "";
        const listHost = layerEditor.querySelector("[data-pipeline-section-list-host]");
        if (listHost) listHost.innerHTML = pipelineSectionListHtml(session);
        return true;
      };

      const doRenderPipelineUi = ({ editor = true } = {}) => {
        updateLocationBar();
        renderLadder();
        const headFp = `${session.activeLayer}:${pipelineLayerStatus(session, session.activeLayer)}`;
        if (headFp !== lastHeadFp) {
          lastHeadFp = headFp;
          layerHead.innerHTML = pipelineLayerHeadHtml(session.activeLayer, session);
        }
        if (editor) {
          const editorKey = editorRenderKey();
          if (editorKey !== lastEditorKey) {
            const prevLayer = lastEditorKey.split(":")[0];
            const canPatchSection = session.activeLayer === "section" && prevLayer === "section" && patchSectionEditor();
            if (!canPatchSection) {
              layerEditor.innerHTML = pipelineLayerEditorHtml(session.activeLayer, session, ctx);
            }
            lastEditorKey = editorKey;
          }
        }
        summaryEl.innerHTML = (draftSavedAt ? aiLocalDraftNote(draftSavedAt) : "") + pipelinePreviewHtml(session);
        importStructure.disabled = !session.proposal;
        importAll.disabled = !session.proposal;
        applyHints.disabled = !(session.evaluation?.revisions || []).some((rev) => rev.promptHint);
        renderLayerActions();
        bindPipelineUiEvents();
      };

      function renderPipelineUi(opts = {}) {
        pendingRender.editor = pendingRender.editor !== false && opts.editor !== false;
        if (renderFrame) return;
        renderFrame = requestAnimationFrame(() => {
          renderFrame = null;
          const editor = pendingRender.editor;
          pendingRender = { editor: true };
          doRenderPipelineUi({ editor });
        });
      }

      const setAutoProgress = (text) => { if (autoProgress) autoProgress.textContent = text; };

      const runAutoPipeline = async () => {
        if (!status.configured) return showToast("DeepSeek 未配置");
        pipelinePersistActiveEditor(session, ctx);
        const spec = pipelineReadSpecFromDom(session.spec);
        if (!pipelineValidateSpec(spec)) return showToast("请先在① 规格填写并确认");
        session.spec = spec;
        if (!session.locks?.spec) return showToast("请先在① 规格点「确认本层并继续」后再一键串行");
        const brief = pipelineBriefFromForm();
        try {
          autoRunBtn.disabled = true;

          setAutoProgress("② 生成总纲…");
          session.activeLayer = "outline";
          session.outline = (await zhimuApi.deepseekPipelineOutline({ ...brief, spec: session.spec })).outline;
          session.locks.outline = true;
          afterSessionChange({ editor: false });

          setAutoProgress("③ 生成编排结构（原结构提案）…");
          session.activeLayer = "structure";
          session.proposal = (await zhimuApi.deepseekPipelineStructure({ ...brief, spec: session.spec, outline: session.outline })).proposal;
          session.locks.structure = true;
          afterSessionChange({ editor: false });

          setAutoProgress("④ 生成角色矩阵…");
          session.activeLayer = "matrix";
          session.roleMatrix = (await zhimuApi.deepseekPipelineRoleMatrix({ ...brief, spec: session.spec, outline: session.outline, proposal: session.proposal })).roleMatrix;
          session.locks.matrix = true;
          ctx.roleKey = session.roleMatrix.roles?.[0]?.key || "";
          afterSessionChange({ editor: false });

          const roles = session.roleMatrix.roles || [];
          const chapters = session.proposal.chapters || [];
          let done = 0;
          const total = roles.length * chapters.length;
          session.activeLayer = "section";
          for (const role of roles) {
            for (const chapter of chapters) {
              done += 1;
              setAutoProgress(`⑤ 私人分幕 ${done}/${total}：${role.name} · ${chapter.title}…`);
              const result = await zhimuApi.deepseekPipelineSection({ ...brief, spec: session.spec, outline: session.outline, proposal: session.proposal, roleMatrix: session.roleMatrix, roleKey: role.key, chapterKey: chapter.key });
              session.sections[role.key] = session.sections[role.key] || {};
              session.sections[role.key][chapter.key] = result.section;
              ctx.roleKey = role.key;
              ctx.chapterKey = chapter.key;
              if (done === total || done % 3 === 0) afterSessionChange({ editor: false });
              else scheduleDraftSave();
            }
          }
          session.locks.section = true;

          setAutoProgress("⑥ 生成短母稿…");
          session.activeLayer = "synopsis";
          session.synopsis = (await zhimuApi.deepseekPipelineManuscriptSynopsis({ ...brief, spec: session.spec, outline: session.outline, proposal: session.proposal, roleMatrix: session.roleMatrix })).synopsis;
          session.locks.synopsis = true;
          afterSessionChange({ editor: false, saveNow: true });

          clearLocalAiDraft(AiDraft()?.KIND?.FULL_MYSTERY);
          clearLocalAiDraft(AiDraft()?.KIND?.STRUCTURE);
          setAutoProgress(`完成 · 共 ${3 + total + 1} 次 API。请在左侧逐层检查，满意后点「上传全部到云端」。`);
          showToast("一键串行生成完成 · 请复核后上传");
        } catch (error) {
          setAutoProgress(`中断：${error.message}`);
          showToast(error.message);
        } finally {
          autoRunBtn.disabled = !status.configured;
          renderPipelineUi();
        }
      };

      autoRunBtn.onclick = runAutoPipeline;

      modal.querySelectorAll("[data-pipeline-mode]").forEach((tab) => {
        tab.onclick = () => {
          pipelineMode = tab.dataset.pipelineMode;
          autoPanel?.classList.toggle("hidden", pipelineMode !== "auto");
          modal.querySelector(".pipeline-wizard-main")?.classList.toggle("pipeline-auto-layout", pipelineMode === "auto");
          modal.querySelectorAll(".pipeline-mode-tab").forEach((el) => el.classList.toggle("active", el.dataset.pipelineMode === pipelineMode));
          afterSessionChange({ editor: false });
        };
      });

      const runPipelineGenerate = async () => {
        const layer = session.activeLayer;
        const btn = layerActions.querySelector("[data-pipeline-generate]");
        try {
          if (btn) { btn.disabled = true; btn.textContent = "请求中…"; }
          if (layer === "spec") return showToast("规格请手动填写并确认，本层不用 AI");
          else if (layer === "outline") {
            if (!session.locks?.spec) return showToast("请先生成并确认规格");
            session.outline = (await zhimuApi.deepseekPipelineOutline({ ...pipelineBriefFromForm(), spec: session.spec })).outline;
          } else if (layer === "structure") {
            if (!session.locks?.spec || !session.locks?.outline) return showToast("请先确认规格与总纲");
            session.proposal = (await zhimuApi.deepseekPipelineStructure({ ...pipelineBriefFromForm(), spec: session.spec, outline: session.outline })).proposal;
          } else if (layer === "matrix") {
            if (!session.locks?.structure) return showToast("请先确认编排结构");
            session.roleMatrix = (await zhimuApi.deepseekPipelineRoleMatrix({ ...pipelineBriefFromForm(), spec: session.spec, outline: session.outline, proposal: session.proposal })).roleMatrix;
            if (!ctx.roleKey) ctx.roleKey = session.roleMatrix.roles?.[0]?.key || "";
          } else if (layer === "section") {
            const roleKey = modal.querySelector("[data-pipeline-role]")?.value || ctx.roleKey;
            const chapterKey = modal.querySelector("[data-pipeline-chapter]")?.value || ctx.chapterKey;
            if (!roleKey || !chapterKey) return showToast("请选择角色与章节");
            if (!session.locks?.matrix) return showToast("请先确认角色矩阵");
            const result = await zhimuApi.deepseekPipelineSection({ ...pipelineBriefFromForm(), spec: session.spec, outline: session.outline, proposal: session.proposal, roleMatrix: session.roleMatrix, roleKey, chapterKey });
            session.sections[roleKey] = session.sections[roleKey] || {};
            session.sections[roleKey][chapterKey] = result.section;
            ctx.roleKey = roleKey; ctx.chapterKey = chapterKey;
          } else if (layer === "synopsis") {
            if (!session.locks?.structure) return showToast("请先确认编排结构");
            session.synopsis = (await zhimuApi.deepseekPipelineManuscriptSynopsis({ ...pipelineBriefFromForm(), spec: session.spec, outline: session.outline, proposal: session.proposal, roleMatrix: session.roleMatrix })).synopsis;
          } else if (layer === "evaluate") {
            if (!session.proposal) return showToast("请至少完成编排结构");
            session.evaluation = (await zhimuApi.deepseekPipelineEvaluate(pipelinePayload())).evaluation;
          }
          session.locks[layer] = false;
          if (layer !== "evaluate") pipelineClearDownstream(session, layer);
          bumpEditorRevision(layer);
          afterSessionChange({ saveNow: true });
          showToast(`${pipelineStepLabel(layer)} 已生成 · 请修改后确认`);
        } catch (error) { showToast(error.message); }
        finally { renderPipelineUi(); }
      };

      bindAiDraftClear(draftKind, () => {
        uiAbort.abort();
        uiAbort = new AbortController();
        const frame = modal.querySelector(".pipeline-wizard-frame");
        if (frame) delete frame.dataset.pipelineUiBound;
        Object.assign(session, defaultPipelineSession());
        draftSavedAt = null;
        lastLadderStatusFp = "";
        lastHeadFp = "";
        lastEditorKey = "";
        lastActionsFp = "";
        renderPipelineUi();
      });
      applyHints.onclick = () => {
        const field = modal.querySelector('[data-studio-field="aiRequirements"]');
        if (!field || !session.evaluation) return;
        const hints = (session.evaluation.revisions || []).filter((rev) => rev.promptHint).map((rev) => rev.promptHint);
        if (!hints.length) return showToast("无可应用的提示语");
        field.value = [field.value.trim(), ...hints].filter(Boolean).join("\n");
        scheduleDraftSave();
        showToast(`已追加 ${hints.length} 条提示到「限制」`);
      };
      importStructure.onclick = async () => {
        if (!session.proposal) return;
        try {
          importStructure.disabled = true;
          pipelinePersistActiveEditor(session, ctx);
          const result = await zhimuApi.importDeepseekProposal(session.proposal);
          session.structureImported = true;
          showToast(`编排已上传：${result.chapters} 章 · ${result.scenes} 场景`);
          await loadCloudData();
          if (!session.roleMatrix && !session.synopsis && !Object.keys(session.sections).length) {
            clearLocalAiDraft(draftKind); closeModal(); go("studio");
          } else importStructure.disabled = false;
        } catch (error) { importStructure.disabled = false; showToast(error.message); }
      };
      importAll.onclick = async () => {
        if (!session.proposal) return;
        try {
          importAll.disabled = true;
          pipelinePersistActiveEditor(session, ctx);
          const result = await zhimuApi.importDeepseekPipeline({ proposal: session.proposal, roleMatrix: session.roleMatrix, sections: session.sections, synopsis: session.synopsis });
          clearLocalAiDraft(draftKind);
          clearLocalAiDraft(AiDraft()?.KIND?.STRUCTURE);
          clearLocalAiDraft(AiDraft()?.KIND?.FULL_MYSTERY);
          closeModal();
          await loadCloudData();
          go("writer");
          if (session.structureImported) {
            showToast(`已上传角色与分幕（编排沿用已有 ${result.chapters} 章 · ${result.scenes} 场景）`);
          } else {
            showToast(`已上传云端：${result.roles} 角色 · ${result.sections} 分幕`);
          }
        } catch (error) { importAll.disabled = false; showToast(error.message); }
      };

      if (existingDraft) showToast("已恢复本机 AI 悬疑草稿");
      else if (options.focusLayer === "structure") showToast("已打开 · 当前层级：③ 编排结构");
      else if (options.mode === "auto") showToast("已打开 · 一键串行模式（原整本悬疑）");
      renderPipelineUi();
    } catch (error) { showToast(error.message); }
  }

  window.zhimuPipelineWizard = { openDeepseekPipeline, pipelineEvaluationPreview, pipelinePreviewHtml, pipelineStepLabel };
})(window);
