/** AI pipeline wizard HTML templates. */
(function (window) {
  const state = window.zhimuState;
  const F = window.zhimuFormat || {};
  const M = window.zhimuModal || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const studioField = M.studioField || (() => "");
  const PS = () => window.zhimuPipelineSession || {};
  const PB = () => window.zhimuPipelineBrief || {};
  const PIPELINE_LAYER_ORDER = PS().PIPELINE_LAYER_ORDER || [];
  const PIPELINE_LAYER_LABEL = PS().PIPELINE_LAYER_LABEL || {};
  const PIPELINE_LAYER_DEPS = PS().PIPELINE_LAYER_DEPS || {};
  const REVISION_PRIORITY_LABEL = { must_fix: "必改", should_fix: "建议改", optional: "可选" };
  const pipelineLayerStatus = (...a) => PS().pipelineLayerStatus?.(...a) ?? "empty";
  const pipelineDepsLocked = (...a) => PS().pipelineDepsLocked?.(...a) ?? false;
  const pipelineStepLabel = (...a) => PS().pipelineStepLabel?.(...a) ?? "";
  const pipelineStepName = (...a) => PS().pipelineStepName?.(...a) ?? "";
  const pipelineArrayToLines = (...a) => PB().pipelineArrayToLines?.(...a) ?? "";
  const defaultSpecFromBrief = (...a) => PB().defaultSpecFromBrief?.(...a) ?? {};
  const aiLocalDraftActions = () => '<button class="text-btn" type="button" data-ai-draft-clear>清除本地草稿</button>';

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

  function pipelineEmptyLayerHtml(layer, session) {
    const label = PIPELINE_LAYER_LABEL[layer] || layer;
    if (pipelineDepsLocked(session, layer)) {
      if (layer === "synopsis") {
        return `<div class="empty-state"><p>⑥ 短母稿（可选）</p><p class="muted-note">点击下方「AI 生成初稿」生成幕后总览；也可跳过，直接上传编排与分幕。</p></div>`;
      }
      if (layer === "evaluate") {
        return `<div class="empty-state"><p>基于已锁定内容，AI 可给出分层修改建议（可选）。</p><p class="muted-note">点击下方「AI 评判」生成。</p></div>`;
      }
      return `<div class="empty-state"><p>${escapeHtml(label)} 尚未生成。</p><p class="muted-note">前置层级已锁定 · 请点击下方「AI 生成初稿」。</p></div>`;
    }
    const deps = (PIPELINE_LAYER_DEPS[layer] || []).filter((dep) => !session.locks?.[dep]);
    const depNames = deps.map((d) => pipelineStepName(d)).join("、") || "前置层级";
    return `<div class="empty-state"><p>请先完成并锁定：${escapeHtml(depNames)}</p></div>`;
  }

  function pipelineOutlineEditorHtml(outline, session) {
    if (!outline) return pipelineEmptyLayerHtml("outline", session);
    const beats = (outline.chapterBeats || []).map((beat, index) => `<article class="pipeline-beat-card" data-beat-index="${index}"><input type="hidden" data-pipe-beat-key value="${escapeHtml(beat.chapterKey || "")}">${studioField(`第 ${index + 1} 章标题`, "pipeBeatTitle" + index, "input", beat.title || "")}${studioField("本章目标", "pipeBeatGoal" + index, "textarea", beat.goal || "")}${studioField("本章转折", "pipeBeatTurn" + index, "textarea", beat.turn || "")}${studioField("主持备注", "pipeBeatHost" + index, "textarea", beat.hostNotes || "")}</article>`).join("");
    return `<div class="pipeline-edit-grid">${studioField("一句话 logline", "pipeOutlineLogline", "textarea", outline.logline || "")}${studioField("幕后真相时间线", "pipeOutlineTruth", "textarea", outline.truthTimeline || "")}<label>误导线（每行一条）</label><textarea class="field" rows="3" data-pipe-outline-red>${escapeHtml(pipelineArrayToLines(outline.redHerrings))}</textarea><div class="pipeline-beat-list"><h4>章节节拍</h4>${beats}</div></div>`;
  }

  function pipelineStructureEditorHtml(proposal, session) {
    if (!proposal) return pipelineEmptyLayerHtml("structure", session);
    const chapters = (proposal.chapters || []).map((ch) => `<article class="pipeline-mini-card"><input type="hidden" data-pipe-chapter-key value="${escapeHtml(ch.key)}">${studioField("章节标题", "pipeChTitle" + ch.key, "input", ch.title || "")}${studioField("章节摘要", "pipeChSummary" + ch.key, "textarea", ch.summary || "")}</article>`).join("");
    const scenes = (proposal.scenes || []).map((sc) => `<article class="pipeline-mini-card"><input type="hidden" data-pipe-scene-key value="${escapeHtml(sc.key)}"><b>${escapeHtml(sc.key)}</b>${studioField("场景名", "pipeScName" + sc.key, "input", sc.name || "")}${studioField("公开描述", "pipeScPublic" + sc.key, "textarea", sc.publicText || "")}</article>`).join("");
    const clues = (proposal.clues || []).map((cl) => `<article class="pipeline-mini-card inline"><input type="hidden" data-pipe-clue-key value="${escapeHtml(cl.key)}">${studioField("线索", "pipeClName" + cl.key, "input", cl.name || "")}</article>`).join("");
    const sceneCount = proposal.scenes?.length || 0;
    const chapterOpen = (proposal.chapters?.length || 0) <= 4 ? " open" : "";
    const sceneOpen = sceneCount <= 4 ? " open" : "";
    return `<div class="pipeline-edit-grid">${studioField("剧本标题", "pipeStructTitle", "input", proposal.title || "")}${studioField("logline", "pipeStructLogline", "textarea", proposal.logline || "")}<div class="proposal-stats"><span>${proposal.chapters?.length || 0} 章</span><span>${sceneCount} 场景</span><span>${proposal.investigationPoints?.length || 0} 调查点</span><span>${proposal.clues?.length || 0} 线索</span><span>${proposal.edges?.length || 0} 连线</span></div><details${chapterOpen}><summary>章节</summary><div class="pipeline-card-grid">${chapters}</div></details><details${sceneOpen}><summary>场景</summary><div class="pipeline-card-grid">${scenes}</div></details><details><summary>线索名称</summary><div class="pipeline-card-grid inline-grid">${clues}</div></details><p class="muted-note">调查点与连线由 AI 生成，细调请上传后在编排台修改。场景/章节较多时默认折叠以减轻卡顿。</p></div>`;
  }

  function pipelineMatrixEditorHtml(matrix, proposal, session) {
    if (!matrix) return pipelineEmptyLayerHtml("matrix", session);
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
    if (!session.roleMatrix || !session.proposal) return pipelineEmptyLayerHtml("section", session);
    const bodyHint = section?.body?.trim()
      ? ""
      : `<p class="muted-note">正文为空 · 点击下方「AI 生成初稿」生成本角色本章分幕。</p>`;
    return `<div class="pipeline-edit-grid"><label>角色</label><select class="field" data-pipeline-role>${roleOptions}</select><label>章节</label><select class="field" data-pipeline-chapter>${chapterOptions}</select>${studioField("分幕标题", "pipeSectionTitle", "input", section?.title || "")}<label>私人正文</label>${bodyHint}<textarea class="field manuscript-body" rows="14" data-pipe-section-body>${escapeHtml(section?.body || "")}</textarea><div data-pipeline-section-list-host>${pipelineSectionListHtml(session)}</div></div>`;
  }

  function pipelineSynopsisEditorHtml(synopsis, session) {
    if (!synopsis) return pipelineEmptyLayerHtml("synopsis", session);
    return `<div class="pipeline-edit-grid">${studioField("标题", "pipeSynTitle", "input", synopsis.title || "")}${studioField("摘要", "pipeSynSummary", "textarea", synopsis.summary || "")}<label>幕后总稿</label><textarea class="field manuscript-body" rows="12" data-pipe-synopsis-body>${escapeHtml(synopsis.overallManuscript || "")}</textarea><label>逻辑说明（每行一条）</label><textarea class="field" rows="4" data-pipe-synopsis-notes>${escapeHtml(pipelineArrayToLines(synopsis.logicNotes))}</textarea></div>`;
  }

  function pipelineLayerEditorHtml(layer, session, ctx) {
    if (layer === "spec") return pipelineSpecEditorHtml(session.spec);
    if (layer === "outline") return pipelineOutlineEditorHtml(session.outline, session);
    if (layer === "structure") return pipelineStructureEditorHtml(session.proposal, session);
    if (layer === "matrix") return pipelineMatrixEditorHtml(session.roleMatrix, session.proposal, session);
    if (layer === "section") return pipelineSectionEditorHtml(session, ctx.roleKey, ctx.chapterKey);
    if (layer === "synopsis") return pipelineSynopsisEditorHtml(session.synopsis, session);
    if (layer === "evaluate") {
      return session.evaluation
        ? pipelineEvaluationPreview(session.evaluation)
        : pipelineEmptyLayerHtml("evaluate", session);
    }
    return "";
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
    const statusText = status.configured ? `${escapeHtml(status.model)} · 180s/步` : "请配置 DEEPSEEK_API_KEY";
    return `<div class="pipeline-wizard-frame"><header class="pipeline-wizard-header"><div class="pipeline-wizard-title-row"><div><h2>AI 悬疑创作</h2><p class="pipeline-wizard-hint">左栏选层级与 brief · 右侧编辑 · 单次 AI 约 <strong>30～180 秒</strong></p></div><div class="deepseek-status pipeline-status-chip ${statusClass}"><b>${status.configured ? "DeepSeek 已连接" : "未配置"}</b><span>${statusText}</span></div></div>${pipelineLocationBarHtml(session, pipelineMode)}</header><div class="pipeline-wizard-body"><aside class="pipeline-wizard-side"><p class="pipeline-side-kicker">创作模式</p>${pipelineModeTabsHtml(pipelineMode)}<p class="pipeline-side-kicker">层级进度</p><nav class="pipeline-ladder" data-pipeline-ladder aria-label="创作层级"></nav>${pipelineBriefFieldsHtml()}</aside><main class="pipeline-wizard-main ${pipelineMode === "auto" ? "pipeline-auto-layout" : ""}"><div class="pipeline-auto-panel ${pipelineMode === "auto" ? "" : "hidden"}" data-pipeline-auto-panel><div class="pipeline-auto-row"><div class="assistant-guide pipeline-auto-guide"><b>一键串行</b><span>须先在① 规格手动填写并确认；之后自动：总纲 → 编排 → 矩阵 → 分幕 → 母稿。</span></div><button type="button" class="primary-btn" data-pipeline-auto-run ${status.configured ? "" : "disabled"}>开始生成</button></div><p class="muted-note pipeline-auto-progress" data-pipeline-auto-progress>尚未开始</p></div><div class="pipeline-layer-head" data-pipeline-layer-head></div><div class="pipeline-layer-editor" data-pipeline-layer-editor></div><footer class="pipeline-layer-bar"><div class="pipeline-layer-actions row" data-pipeline-layer-actions></div><div class="pipeline-summary" data-pipeline-summary></div></footer></main></div><footer class="pipeline-wizard-footer"><div class="pipeline-wizard-footer-left">${aiLocalDraftActions()}</div><div class="pipeline-wizard-footer-right"><button class="secondary-btn" type="button" data-close>关闭</button><button class="secondary-btn" type="button" data-pipeline-apply-hints disabled>应用评判提示</button><button class="secondary-btn" type="button" data-pipeline-import-structure disabled>仅上传编排</button><button class="primary-btn" type="button" data-pipeline-import-all disabled>上传全部到云端</button></div></footer></div>`;
  }

  window.zhimuPipelineHtml = {
    pipelineEvaluationPreview,
    pipelinePreviewHtml,
    pipelineLadderHtml,
    pipelineLayerHeadHtml,
    pipelineSpecEditorHtml,
    pipelineOutlineEditorHtml,
    pipelineStructureEditorHtml,
    pipelineMatrixEditorHtml,
    pipelineSectionListHtml,
    pipelineSectionEditorHtml,
    pipelineSynopsisEditorHtml,
    pipelineLayerEditorHtml,
    pipelineLocationBarHtml,
    pipelineModeTabsHtml,
    pipelineBriefFieldsHtml,
    pipelineWizardFrameHtml
  };
})(window);
export {};
