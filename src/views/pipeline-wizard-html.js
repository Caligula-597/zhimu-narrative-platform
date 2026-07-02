/** AI pipeline wizard HTML templates. */
import { studioStore } from "../state/index.js";
import * as F from "../utils/format.js";
(function (window) {
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
  const pipelineChaptersForSession = (...a) => PS().pipelineChaptersForSession?.(...a) ?? [];
  const pipelineArrayToLines = (...a) => PB().pipelineArrayToLines?.(...a) ?? "";
  const defaultSpecFromBrief = (...a) => PB().defaultSpecFromBrief?.(...a) ?? {};
  const aiLocalDraftActions = () => '<button class="text-btn" type="button" data-ai-draft-clear>清除本地草稿</button>';

  function pipelineLabeledTextarea(label, id, value = "", { rows = 4, className = "field", dataAttr = "" } = {}) {
    const safeId = escapeHtml(id);
    return `<label for="${safeId}">${escapeHtml(label)}</label><textarea class="${className}" id="${safeId}" name="${safeId}" rows="${rows}" ${dataAttr}>${escapeHtml(value)}</textarea>`;
  }

  function pipelineLabeledSelect(label, id, optionsHtml, dataAttr = "") {
    const safeId = escapeHtml(id);
    return `<label for="${safeId}">${escapeHtml(label)}</label><select class="field" id="${safeId}" name="${safeId}" ${dataAttr}>${optionsHtml}</select>`;
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
    const config = session.config;
    const theme = session.setting?.theme || config?.title || "";
    if (theme) parts.push(`<span>${escapeHtml(theme.slice(0, 24))}</span>`);
    if (config?.chapterKeys?.length) parts.push(`<span>${config.chapterKeys.length} 章</span>`);
    const min = PS().narrativeMinChars?.(session) || 2000;
    const narrativeCount = Object.keys(session.narrativeChapters || {}).filter((key) => (session.narrativeChapters[key]?.narrativeBody || "").length >= min).length;
    if (narrativeCount) parts.push(`<span>${narrativeCount} 章总剧情</span>`);
    if (session.rolesMeta?.roles?.length) parts.push(`<span>${session.rolesMeta.roles.length} 角色</span>`);
    const sectionCount = Object.values(session.sections || {}).reduce((n, chapters) => n + Object.keys(chapters || {}).length, 0);
    if (sectionCount) parts.push(`<span>${sectionCount} 段私人本</span>`);
    if (session.proposal) parts.push(`<span>${session.proposal.scenes?.length || 0} 场景 · ${session.proposal.edges?.length || 0} 边</span>`);
    return parts.length ? `<div class="proposal-stats">${parts.join("")}</div>` : "";
  }

  function pipelineLadderHtml(session, activeLayer) {
    return PIPELINE_LAYER_ORDER.map((layer) => {
      const status = pipelineLayerStatus(session, layer);
      const statusLabel = { empty: layer === "setup" ? "待填写" : "待生成", draft: "待确认", locked: "已锁定" }[status];
      return `<button type="button" class="pipeline-ladder-item ${layer === activeLayer ? "active" : ""} status-${status}" data-pipeline-layer="${layer}"><span class="pipeline-ladder-seq">${pipelineStepLabel(layer).slice(0, 2)}</span><span class="pipeline-ladder-text"><b>${escapeHtml(pipelineStepName(layer))}</b><small>${statusLabel}</small></span></button>`;
    }).join("");
  }

  function pipelineLayerHeadHtml(layer, session) {
    const status = pipelineLayerStatus(session, layer);
    const statusNote = {
      empty: layer === "setup" ? "请填写创作设定与剧情纲要，本层不用 AI。填好后点「确认并继续」。" : "请 AI 生成初稿，或直接编辑下方字段。",
      draft: "修改满意后点「确认本层」，再进入下一步。",
      locked: "本层已锁定，可继续编辑；保存后会清除下游内容。"
    }[status];
    const narrativeNote = layer === "narrative" && status !== "locked"
      ? "<p class=\"muted-note\">② 总剧情按章生成：每次只写当前选中章节，约 1～3 分钟/章（非一口气全书）。</p>"
      : "";
    const evaluateNote = layer === "evaluate" && status === "draft"
      ? "<p class=\"muted-note\">查看分层修改建议后点「确认评判结果并继续」，进入 ⑤ 汇总同步；也可点底部「应用评判提示」写回立项。</p>"
      : layer === "evaluate" && status === "empty" && pipelineDepsLocked(session, layer)
        ? "<p class=\"muted-note\">基于总剧情与私人本给出质检与改稿方向，通常需 1～3 分钟。</p>"
        : "";
    const depNote = (PIPELINE_LAYER_DEPS[layer] || []).length && !pipelineDepsLocked(session, layer)
      ? `<p class="pipeline-dep-warn">请先在左侧完成并锁定：${(PIPELINE_LAYER_DEPS[layer] || []).map((item) => pipelineStepName(item)).join("、")}</p>` : "";
    return `<div class="pipeline-layer-head-inner"><div><p class="section-kicker">${pipelineStepLabel(layer)}</p><h3>${escapeHtml(PIPELINE_LAYER_LABEL[layer] || layer)}</h3><p class="wizard-intro">${statusNote || ""}</p>${narrativeNote}${evaluateNote}${depNote}</div><span class="cloud-pill pipeline-status-pill status-${status}">${{ empty: layer === "setup" ? "待填写" : "待生成", draft: "待确认", locked: "已锁定" }[status]}</span></div>`;
  }

  function pipelineSetupEditorHtml(session) {
    const world = studioStore.get().cloudStudio?.world;
    const setting = session.setting || PB().pipelineSettingFromForm?.() || {};
    const synopsis = session.synopsis || PB().pipelineSynopsisFromForm?.() || {};
    const theme = setting.theme || world?.name || "";
    const body = synopsis.body || world?.summary || "";
    return `<div class="pipeline-edit-grid pipeline-spec-simple"><h4>创作设定</h4>${studioField("主题", "aiTheme", "input", theme)}${studioField("玩家人数（4～8）", "aiPlayerCount", "input", String(setting.playerCount || 6))}${studioField("章节数量（3～5）", "aiChapterCount", "input", String(setting.chapterCount || 5))}${studioField("每章节字数（约 8000）", "aiWordsPerChapter", "input", String(setting.wordsPerChapter || 8000))}${studioField("额外的矛盾冲突", "aiConflicts", "textarea", setting.extraConflicts || "")}${studioField("场景基调（选填）", "aiTone", "input", setting.tone || "")}<h4>剧情纲要</h4>${studioField("纲要正文", "aiSynopsisBody", "textarea", body)}${studioField("人物关系（选填）", "aiCharactersSketch", "textarea", synopsis.charactersSketch || "")}${studioField("真相概要（选填）", "aiTruthSketch", "textarea", synopsis.truthSketch || "")}${studioField("误导线（选填）", "aiRedHerringsSketch", "textarea", synopsis.redHerringsSketch || "")}<p class="muted-note">① 创作立项：设定与纲要会随每一步 API 一并发送，避免 AI 自由发挥。确认后进入逐章总剧情。</p></div>`;
  }

  function pipelineSpecEditorHtml(session) {
    return pipelineSetupEditorHtml(session);
  }

  function pipelineEmptyLayerHtml(layer, session) {
    const label = PIPELINE_LAYER_LABEL[layer] || layer;
    if (pipelineDepsLocked(session, layer)) {
      if (layer === "narrative") {
        return `<div class="empty-state"><p>② 逐章总剧情</p><p class="muted-note"><strong>每次只生成当前选中的一章</strong>，不是一口气生成全书。选好章节后点「AI 生成本章」；也可点「逐章生成全部」自动串行各章（每章约 1～3 分钟）。</p></div>`;
      }
      if (layer === "roles") {
        return `<div class="empty-state"><p>③ 角色私人本</p><p class="muted-note">先点「识别角色」，再<strong>逐章</strong>生成每位玩家的私人剧本（每次只生成当前角色+当前章节）；也可点「批量生成全部私人本」自动串行完成。</p></div>`;
      }
      if (layer === "sync") {
        return `<div class="empty-state"><p>⑤ 汇总同步</p><p class="muted-note">从总剧情与私人本中<strong>抽取</strong>场景、线索与调查点，确认后上传编排台。</p></div>`;
      }
      if (layer === "evaluate") {
        return `<div class="empty-state"><p>④ AI 评判</p><p class="muted-note">基于总剧情与全部私人本给出分层修改建议（可选）。点击下方「AI 评判」后按钮会显示<strong>实时计时</strong>，通常需 1～3 分钟。</p></div>`;
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
    return `<div class="pipeline-edit-grid">${studioField("一句话 logline", "pipeOutlineLogline", "textarea", outline.logline || "")}${studioField("幕后真相时间线", "pipeOutlineTruth", "textarea", outline.truthTimeline || "")}${pipelineLabeledTextarea("误导线（每行一条）", "pipe-outline-red", pipelineArrayToLines(outline.redHerrings), { rows: 3, dataAttr: "data-pipe-outline-red" })}<div class="pipeline-beat-list"><h4>章节节拍</h4>${beats}</div></div>`;
  }

  function pipelineNarrativeListHtml(session) {
    const keys = session.config?.chapterKeys || [];
    const min = PS().narrativeMinChars?.(session) || 2000;
    const rows = keys.map((key) => {
      const chapter = session.narrativeChapters?.[key];
      const title = chapter?.title || key;
      const len = (chapter?.narrativeBody || "").length;
      const status = len >= min ? `${len} 字` : "未生成";
      return `<button type="button" class="pipeline-section-chip" data-pipeline-pick-narrative="${escapeHtml(key)}">${escapeHtml(title)} · ${status}</button>`;
    });
    const downloadBtn = keys.length
      ? `<button type="button" class="secondary-btn" data-pipeline-download-narrative>下载全部总剧情 (.md)</button>`
      : "";
    return rows.length ? `<div class="pipeline-section-list"><h4>各章进度</h4><div class="pipeline-section-chips">${rows.join("")}</div>${downloadBtn}</div>` : "";
  }

  function pipelineNarrativeEditorHtml(session, chapterKey) {
    const keys = session.config?.chapterKeys || [];
    if (!keys.length) return pipelineEmptyLayerHtml("narrative", session);
    const activeKey = chapterKey && keys.includes(chapterKey) ? chapterKey : keys[0];
    const chapter = session.narrativeChapters?.[activeKey];
    const chapterOptions = keys.map((key, index) => {
      const label = session.narrativeChapters?.[key]?.title || `第 ${index + 1} 章`;
      return `<option value="${escapeHtml(key)}" ${key === activeKey ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
    const chapterIndex = keys.indexOf(activeKey);
    const prevHint = chapterIndex > 0
      ? `<p class="muted-note">生成本章时 AI 会读取前 ${chapterIndex} 章全文（${keys.slice(0, chapterIndex).map((key) => (session.narrativeChapters?.[key]?.narrativeBody || "").length).join(" + ")} 字）。</p>`
      : `<p class="muted-note">第一章 · 无需前置章节。点击下方「AI 生成本章」；<strong>每次只生成当前这一章</strong>，约 1～3 分钟。</p>`;
    const bodyHint = chapter?.narrativeBody?.trim()
      ? ""
      : `<p class="muted-note">正文为空 · 点「AI 生成本章」生成本章（非全书一次性生成）。</p>`;
    return `<div class="pipeline-edit-grid">${pipelineLabeledSelect("章节", "pipe-narrative-chapter", chapterOptions, "data-pipeline-narrative-chapter")}${prevHint}${studioField("章节标题", "pipeNarrativeTitle", "input", chapter?.title || "")}${studioField("章节摘要", "pipeNarrativeSummary", "textarea", chapter?.summary || "")}${bodyHint}${pipelineLabeledTextarea("总剧情正文", "pipe-narrative-body", chapter?.narrativeBody || "", { rows: 16, className: "field manuscript-body", dataAttr: "data-pipe-narrative-body" })}${studioField("主持备注", "pipeNarrativeHost", "textarea", chapter?.hostNotes || "")}<div data-pipeline-narrative-list-host>${pipelineNarrativeListHtml(session)}</div></div>`;
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
    const chapters = pipelineChaptersForSession(session);
    const chapterTitles = new Map(chapters.map((ch) => [ch.key, ch.title]));
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
        const roleName = session.rolesMeta?.roles?.find((r) => r.key === roleKey)?.name || roleKey;
        const chapterTitle = pipelineChaptersForSession(session).find((ch) => ch.key === chapterKey)?.title || chapterKey;
        rows.push(`<button type="button" class="pipeline-section-chip" data-pipeline-pick-section="${escapeHtml(roleKey)}|${escapeHtml(chapterKey)}">${escapeHtml(roleName)} · ${escapeHtml(chapterTitle)} · ${(section.body || "").length} 字</button>`);
      }
    }
    return rows.length ? `<div class="pipeline-section-list"><h4>已确认分幕</h4><div class="pipeline-section-chips">${rows.join("")}</div></div>` : "";
  }

  function pipelineRolesMetaHtml(session) {
    const roles = session.rolesMeta?.roles || [];
    if (!roles.length) return "";
    return roles.map((role) => `<article class="pipeline-role-card compact"><b>${escapeHtml(role.name)}</b><p class="muted-note">${escapeHtml((role.publicProfile || "").slice(0, 120))}</p></article>`).join("");
  }

  function pipelineRoleScriptListHtml(session, activeRoleKey) {
    const keys = session.config?.chapterKeys || [];
    const min = PS().sectionMinWords?.(session) || 400;
    const rows = keys.map((key, index) => {
      const section = session.sections?.[activeRoleKey]?.[key];
      const title = session.narrativeChapters?.[key]?.title || `第 ${index + 1} 章`;
      const len = (section?.body || "").length;
      const status = len >= min ? `${len} 字` : "未生成";
      return `<button type="button" class="pipeline-section-chip" data-pipeline-pick-section="${escapeHtml(activeRoleKey)}|${escapeHtml(key)}">${escapeHtml(title)} · ${status}</button>`;
    });
    const { done, total } = PS().countRoleScriptSections?.(session) || { done: 0, total: 0 };
    const overall = total ? `<p class="muted-note">全部进度：${done}/${total} 段私人本</p>` : "";
    return rows.length ? `<div class="pipeline-section-list"><h4>本角色各章进度</h4><div class="pipeline-section-chips">${rows.join("")}</div>${overall}</div>` : "";
  }

  function pipelineRolesEditorHtml(session, roleKey, chapterKey) {
    const roles = session.rolesMeta?.roles || [];
    const chapters = pipelineChaptersForSession(session);
    if (!roles.length || !chapters.length) return pipelineEmptyLayerHtml("roles", session);
    const activeRoleKey = roleKey && roles.some((r) => r.key === roleKey) ? roleKey : roles[0]?.key;
    const activeChapterKey = chapterKey && chapters.some((ch) => ch.key === chapterKey) ? chapterKey : chapters[0]?.key;
    const roleOptions = roles.map((r) => `<option value="${escapeHtml(r.key)}" ${r.key === activeRoleKey ? "selected" : ""}>${escapeHtml(r.name)}</option>`).join("");
    const chapterOptions = chapters.map((ch) => `<option value="${escapeHtml(ch.key)}" ${ch.key === activeChapterKey ? "selected" : ""}>${escapeHtml(ch.title)}</option>`).join("");
    const section = session.sections?.[activeRoleKey]?.[activeChapterKey];
    const roleMeta = roles.find((r) => r.key === activeRoleKey);
    const sectionHint = `<p class="muted-note">每次只生成<strong>当前角色 + 当前章节</strong>的私人本（约 30～90 秒）；总剧情在 prompt 中已压缩，避免超时。</p>`;
    const metaBlock = roleMeta
      ? `<div class="assistant-guide"><b>${escapeHtml(roleMeta.name)}</b><span>${escapeHtml(roleMeta.publicProfile || "")}</span></div>`
      : "";
    return `<div class="pipeline-edit-grid">${metaBlock}<div class="pipeline-roles-meta-grid">${pipelineRolesMetaHtml(session)}</div>${sectionHint}${pipelineLabeledSelect("当前角色", "pipe-role", roleOptions, "data-pipeline-role")}${pipelineLabeledSelect("章节", "pipe-chapter", chapterOptions, "data-pipeline-chapter")}${studioField("分幕标题", "pipeSectionTitle", "input", section?.title || "")}${pipelineLabeledTextarea("私人正文", "pipe-section-body", section?.body || "", { rows: 14, className: "field manuscript-body", dataAttr: "data-pipe-section-body" })}${studioField("AI 改稿说明（选填）", "pipeRoleRevisionHint", "textarea", "")}<div data-pipeline-section-list-host>${pipelineRoleScriptListHtml(session, activeRoleKey)}</div></div>`;
  }

  function pipelineSectionEditorHtml(session, roleKey, chapterKey) {
    return pipelineRolesEditorHtml(session, roleKey, chapterKey);
  }

  function pipelineSynopsisEditorHtml(synopsis, session) {
    if (!synopsis) return pipelineEmptyLayerHtml("synopsis", session);
    return `<div class="pipeline-edit-grid">${studioField("标题", "pipeSynTitle", "input", synopsis.title || "")}${studioField("摘要", "pipeSynSummary", "textarea", synopsis.summary || "")}${pipelineLabeledTextarea("幕后总稿", "pipe-synopsis-body", synopsis.overallManuscript || "", { rows: 12, className: "field manuscript-body", dataAttr: "data-pipe-synopsis-body" })}${pipelineLabeledTextarea("逻辑说明（每行一条）", "pipe-synopsis-notes", pipelineArrayToLines(synopsis.logicNotes), { rows: 4, dataAttr: "data-pipe-synopsis-notes" })}</div>`;
  }

  function pipelineLayerEditorHtml(layer, session, ctx) {
    if (layer === "setup" || layer === "spec") return pipelineSetupEditorHtml(session);
    if (layer === "narrative") return pipelineNarrativeEditorHtml(session, ctx.narrativeChapterKey);
    if (layer === "roles" || layer === "section" || layer === "matrix") return pipelineRolesEditorHtml(session, ctx.roleKey, ctx.chapterKey);
    if (layer === "sync" || layer === "structure") return pipelineStructureEditorHtml(session.proposal, session);
    if (layer === "evaluate") {
      return session.evaluation
        ? pipelineEvaluationPreview(session.evaluation)
        : pipelineEmptyLayerHtml("evaluate", session);
    }
    return "";
  }

  function pipelineLocationBarHtml(session) {
    const stepLabel = pipelineStepName(session.activeLayer);
    return `<div class="pipeline-location-bar"><span class="pipeline-loc-muted">创作中心</span><span class="pipeline-loc-arrow">→</span><strong>AI 剧本创作</strong><span class="pipeline-loc-arrow">→</span><span data-pipeline-loc-step>${escapeHtml(stepLabel)}</span><span class="cloud-pill pipeline-loc-mode">五步流程</span></div>`;
  }

  function pipelineModeTabsHtml() {
    return "";
  }

  function pipelineBriefFieldsHtml() {
    return "";
  }

  function pipelineWizardFrameHtml(status, session, pipelineMode) {
    const statusClass = status.configured ? "ready" : "missing";
    const statusText = status.configured ? `${escapeHtml(status.model)} · 180s/步` : "请配置 DEEPSEEK_API_KEY";
    return `<div class="pipeline-wizard-frame"><header class="pipeline-wizard-header"><div class="pipeline-wizard-title-row"><div><h2>AI 剧本创作</h2><p class="pipeline-wizard-hint">① 立项 → ② 逐章总剧情 → ③ 角色私人本 → ④ 评判 → ⑤ 汇总同步 · ②③ 均为<strong>逐章/逐段</strong>生成（非一次性全书），每步约 1～2 分钟</p></div><div class="deepseek-status pipeline-status-chip ${statusClass}"><b>${status.configured ? "DeepSeek 已连接" : "未配置"}</b><span>${statusText}</span></div></div>${pipelineLocationBarHtml(session)}</header><div class="pipeline-wizard-body"><aside class="pipeline-wizard-side"><p class="pipeline-side-kicker">创作步骤</p><nav class="pipeline-ladder" data-pipeline-ladder aria-label="创作层级"></nav>${pipelineBriefFieldsHtml()}</aside><main class="pipeline-wizard-main"><div class="pipeline-layer-head" data-pipeline-layer-head></div><div class="pipeline-layer-editor" data-pipeline-layer-editor></div><footer class="pipeline-layer-bar"><div class="pipeline-layer-actions row" data-pipeline-layer-actions></div><div class="pipeline-summary" data-pipeline-summary></div></footer></main></div><footer class="pipeline-wizard-footer"><div class="pipeline-wizard-footer-left">${aiLocalDraftActions()}</div><div class="pipeline-wizard-footer-right"><button class="secondary-btn" type="button" data-close>关闭</button><button class="secondary-btn" type="button" data-pipeline-apply-hints disabled>应用评判提示</button><button class="secondary-btn" type="button" data-pipeline-import-structure disabled>仅上传编排</button><button class="primary-btn" type="button" data-pipeline-import-all disabled>上传全部到云端</button></div></footer></div>`;
  }

  window.zhimuPipelineHtml = {
    pipelineEvaluationPreview,
    pipelinePreviewHtml,
    pipelineLadderHtml,
    pipelineLayerHeadHtml,
    pipelineSetupEditorHtml,
    pipelineSpecEditorHtml,
    pipelineRolesEditorHtml,
    pipelineOutlineEditorHtml,
    pipelineNarrativeEditorHtml,
    pipelineNarrativeListHtml,
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
