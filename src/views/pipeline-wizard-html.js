/** AI pipeline wizard HTML templates. */
import { studioStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as M from "../components/modal.js";
(function (window) {
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
      const labels = {
        playability: "可玩性", fairness: "公平推理", multiRoleDesign: "多人设计", pacing: "章节节奏",
        graphReady: "编排可落地", consistency: "内部一致", styleFit: "风格契合",
        matrixConsistency: "矩阵一致", spoilerSafety: "剧透安全", taskCompleteness: "任务完整", importReady: "可入库"
      };
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
    if (config?.chapterKeys?.length) parts.push(`<span>${config.chapterKeys.length} 幕</span>`);
    if (session.truthBible?.killer) parts.push(`<span>真相已建</span>`);
    if (session.characterArchives?.roles?.length) parts.push(`<span>${session.characterArchives.roles.length} 角色</span>`);
    if (session.infoMatrix?.clues?.length) parts.push(`<span>${session.infoMatrix.clues.length} 线索</span>`);
    const scriptCount = Object.values(session.scripts || {}).reduce((n, acts) => n + Object.keys(acts || {}).length, 0);
    if (scriptCount) parts.push(`<span>${scriptCount} 段剧本</span>`);
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
    const matrixNote = layer === "truth" && status !== "locked"
      ? "<p class=\"muted-note\">② 生成结构化真相 Bible（凶手/手法/时间线/误导/剧透门禁），约 1～3 分钟。</p>"
      : layer === "scripts" && status !== "locked"
        ? "<p class=\"muted-note\">⑥ 按「角色 × 幕」从信息矩阵生成私人本；每次只写一格，约 30～90 秒。</p>"
        : layer === "sync" && status !== "locked"
          ? "<p class=\"muted-note\">⑧ 从信息矩阵机械生成编排图（非 NLP 反推），确认后上传。</p>"
          : "";
    const evaluateNote = layer === "evaluate" && status === "draft"
      ? "<p class=\"muted-note\">查看分层修改建议后点「确认评判并继续」，进入 ⑧ 机械入库；也可点底部「应用评判提示」写回立项。</p>"
      : layer === "evaluate" && status === "empty" && pipelineDepsLocked(session, layer)
        ? "<p class=\"muted-note\">基于信息矩阵与逐幕剧本给出质检与改稿方向，通常需 1～3 分钟。</p>"
        : "";
    const depNote = (PIPELINE_LAYER_DEPS[layer] || []).length && !pipelineDepsLocked(session, layer)
      ? `<p class="pipeline-dep-warn">请先在左侧完成并锁定：${(PIPELINE_LAYER_DEPS[layer] || []).map((item) => pipelineStepName(item)).join("、")}</p>` : "";
    return `<div class="pipeline-layer-head-inner"><div><p class="section-kicker">${pipelineStepLabel(layer)}</p><h3>${escapeHtml(PIPELINE_LAYER_LABEL[layer] || layer)}</h3><p class="wizard-intro">${statusNote || ""}</p>${matrixNote}${evaluateNote}${depNote}</div><span class="cloud-pill pipeline-status-pill status-${status}">${{ empty: layer === "setup" ? "待填写" : "待生成", draft: "待确认", locked: "已锁定" }[status]}</span></div>`;
  }

  function pipelineSetupEditorHtml(session) {
    const world = studioStore.get().cloudStudio?.world;
    const setting = session.setting || PB().pipelineSettingFromForm?.() || {};
    const synopsis = session.synopsis || PB().pipelineSynopsisFromForm?.() || {};
    const theme = setting.theme || world?.name || "";
    const body = synopsis.body || world?.summary || "";
    const volumeTier = setting.volumeTier || "standard";
    const pov = setting.pov || "second";
    const matrixMode = setting.matrixMode || "honkaku";
    const eraPreset = setting.eraPreset || "modern-cn";
    return `<div class="pipeline-edit-grid pipeline-spec-simple"><h4>创作设定</h4>${studioField("主题", "aiTheme", "input", theme)}${studioField("玩家人数（4～8）", "aiPlayerCount", "input", String(setting.playerCount || 6))}${studioField("幕数（3～5）", "aiChapterCount", "input", String(setting.chapterCount || 5))}<label for="aiMatrixMode">Matrix 模式</label><select class="field" id="aiMatrixMode" name="aiMatrixMode" data-studio-field="aiMatrixMode"><option value="honkaku" ${matrixMode === "honkaku" ? "selected" : ""}>本格（honkaku）</option><option value="henkaku" ${matrixMode === "henkaku" ? "selected" : ""}>变格（henkaku）</option></select><label for="aiEraPreset">时代背景</label><select class="field" id="aiEraPreset" name="aiEraPreset" data-studio-field="aiEraPreset"><option value="republic-cn" ${eraPreset === "republic-cn" ? "selected" : ""}>民国中国</option><option value="modern-cn" ${eraPreset === "modern-cn" ? "selected" : ""}>当代中国</option><option value="campus-2000s" ${eraPreset === "campus-2000s" ? "selected" : ""}>千禧校园</option><option value="victorian-uk" ${eraPreset === "victorian-uk" ? "selected" : ""}>维多利亚英国</option><option value="edo-jp" ${eraPreset === "edo-jp" ? "selected" : ""}>江户日本</option><option value="lighthouse-industrial" ${eraPreset === "lighthouse-industrial" ? "selected" : ""}>工业灯塔</option><option value="near-future" ${eraPreset === "near-future" ? "selected" : ""}>近未来</option><option value="rural-contemporary" ${eraPreset === "rural-contemporary" ? "selected" : ""}>当代乡村</option></select><label for="aiVolumeTier">体量档位</label><select class="field" id="aiVolumeTier" name="aiVolumeTier" data-studio-field="aiVolumeTier"><option value="demo" ${volumeTier === "demo" ? "selected" : ""}>示范档（短）</option><option value="standard" ${volumeTier === "standard" ? "selected" : ""}>标准档</option><option value="epic" ${volumeTier === "epic" ? "selected" : ""}>完整档（长）</option></select><label for="aiPov">玩家本视角</label><select class="field" id="aiPov" name="aiPov" data-studio-field="aiPov"><option value="second" ${pov === "second" ? "selected" : ""}>第二人称「你」</option><option value="first" ${pov === "first" ? "selected" : ""}>第一人称「我」</option></select>${studioField("额外的矛盾冲突", "aiConflicts", "textarea", setting.extraConflicts || "")}${studioField("场景基调（选填）", "aiTone", "input", setting.tone || "")}${studioField("文风锚点（2～3 段范例）", "aiStyleAnchor", "textarea", setting.styleAnchor || "")}${studioField("禁用词/套话（每行一条）", "aiForbiddenPhrases", "textarea", setting.forbiddenPhrases || "")}<h4>剧情纲要</h4>${studioField("纲要正文", "aiSynopsisBody", "textarea", body)}${studioField("人物关系（选填）", "aiCharactersSketch", "textarea", synopsis.charactersSketch || "")}${studioField("真相概要（选填）", "aiTruthSketch", "textarea", synopsis.truthSketch || "")}${studioField("误导线（选填）", "aiRedHerringsSketch", "textarea", synopsis.redHerringsSketch || "")}<p class="muted-note">① 立项后按瀑布流生成：真相 → 角色档案 → 信息矩阵 → 主持手册 → 逐幕剧本 → 评判 → 机械入库。</p></div>`;
  }

  function pipelineSpecEditorHtml(session) {
    return pipelineSetupEditorHtml(session);
  }

  function pipelineEmptyLayerHtml(layer, session) {
    const label = PIPELINE_LAYER_LABEL[layer] || layer;
    if (pipelineDepsLocked(session, layer)) {
      const hints = {
        truth: `<div class="empty-state"><p>② 真相 Bible</p><p class="muted-note">生成结构化真相档案（凶手/手法/时间线/误导/剧透门禁），约 1～3 分钟。</p></div>`,
        characters: `<div class="empty-state"><p>③ 角色秘密档案</p><p class="muted-note">为每位玩家生成秘密、动机、谎言与分幕任务。</p></div>`,
        matrix: `<div class="empty-state"><p>④ 信息矩阵</p><p class="muted-note">线索 + 角色×幕信息行，是后续剧本与机械入库的唯一数据源。</p></div>`,
        host: `<div class="empty-state"><p>⑤ 主持手册</p><p class="muted-note">按幕生成流程、真相与线索发放说明；可一次生成全部幕。</p></div>`,
        scripts: `<div class="empty-state"><p>⑥ 逐幕剧本</p><p class="muted-note">按「角色 × 幕」逐格生成私人本；也可批量串行生成全部格。</p></div>`,
        evaluate: `<div class="empty-state"><p>⑦ 矩阵评判</p><p class="muted-note">检查矩阵一致性与剧透安全，给出分层修改建议。</p></div>`,
        sync: `<div class="empty-state"><p>⑧ 机械入库</p><p class="muted-note">从信息矩阵<strong>机械</strong>生成编排图（非 NLP 反推），确认后上传。</p></div>`
      };
      if (hints[layer]) return hints[layer];
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
    const roles = session.characterArchives?.roles || [];
    for (const [roleKey, acts] of Object.entries(session.scripts || {})) {
      for (const [actKey, script] of Object.entries(acts || {})) {
        const roleName = roles.find((r) => r.key === roleKey)?.name || roleKey;
        const actTitle = pipelineChaptersForSession(session).find((ch) => ch.key === actKey)?.title || actKey;
        rows.push(`<button type="button" class="pipeline-section-chip" data-pipeline-pick-section="${escapeHtml(roleKey)}|${escapeHtml(actKey)}">${escapeHtml(roleName)} · ${escapeHtml(actTitle)} · ${(script.body || "").length} 字</button>`);
      }
    }
    const { done, total } = PS().countMatrixScripts?.(session) || { done: 0, total: 0 };
    const overall = total ? `<p class="muted-note">全部进度：${done}/${total} 格剧本</p>` : "";
    return rows.length ? `<div class="pipeline-section-list"><h4>已生成分幕</h4><div class="pipeline-section-chips">${rows.join("")}</div>${overall}</div>` : "";
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

  function pipelineJsonEditorHtml(label, dataAttr, value) {
    const json = value ? JSON.stringify(value, null, 2) : "";
    return `<div class="pipeline-edit-grid">${pipelineLabeledTextarea(label, "pipe-json-layer", json, { rows: 22, className: "field manuscript-body", dataAttr })}<p class="muted-note">可直接编辑 JSON；保存后进入下一步。</p></div>`;
  }

  function pipelineScriptsEditorHtml(session, roleKey, actKey) {
    const roles = session.characterArchives?.roles || [];
    const chapters = pipelineChaptersForSession(session);
    if (!roles.length || !chapters.length) return pipelineEmptyLayerHtml("scripts", session);
    const activeRoleKey = roleKey && roles.some((r) => r.key === roleKey) ? roleKey : roles[0]?.key;
    const activeActKey = actKey && chapters.some((c) => c.key === actKey) ? actKey : chapters[0]?.key;
    const roleOptions = roles.map((r) => `<option value="${escapeHtml(r.key)}" ${r.key === activeRoleKey ? "selected" : ""}>${escapeHtml(r.name)}</option>`).join("");
    const actOptions = chapters.map((c) => `<option value="${escapeHtml(c.key)}" ${c.key === activeActKey ? "selected" : ""}>${escapeHtml(c.title || c.key)}</option>`).join("");
    const script = session.scripts?.[activeRoleKey]?.[activeActKey] || {};
    const min = PS().scriptMinWords?.(session) || 600;
    const progress = PS().countMatrixScripts?.(session) || { done: 0, total: 0, min };
    return `<div class="pipeline-edit-grid"><p class="muted-note">进度 ${progress.done}/${progress.total} · 最低 ${min} 字/格</p>${pipelineLabeledSelect("当前角色", "pipe-role", roleOptions, "data-pipeline-role")}${pipelineLabeledSelect("当前幕", "pipe-chapter", actOptions, "data-pipeline-chapter")}${studioField("分幕标题", "pipeSectionTitle", "input", script.title || "")}${pipelineLabeledTextarea("私人正文", "pipe-section-body", script.body || "", { rows: 14, className: "field manuscript-body", dataAttr: "data-pipe-section-body" })}${studioField("本幕任务（每行一条）", "pipeScriptTasks", "textarea", (script.tasks || []).join("\n"))}${studioField("结尾钩子", "pipeScriptHook", "input", script.closingHook || "")}<div data-pipeline-section-list-host>${pipelineSectionListHtml(session)}</div></div>`;
  }

  function pipelineHostEditorHtml(session) {
    const books = session.hostRunbooks || [];
    return `<div class="pipeline-edit-grid"><p class="muted-note">已生成 ${books.length} / ${session.config?.chapterKeys?.length || 0} 幕主持手册</p>${pipelineJsonEditorHtml("主持手册 JSON（可编辑）", "data-pipe-host-json", books)}</div>`;
  }

  function pipelineLayerEditorHtml(layer, session, ctx) {
    const normalized = PS().normalizeLayerName?.(layer) || layer;
    if (normalized === "setup" || layer === "spec") return pipelineSetupEditorHtml(session);
    if (normalized === "truth") return pipelineJsonEditorHtml("真相 Bible JSON", "data-pipe-truth-json", session.truthBible);
    if (normalized === "characters") return pipelineJsonEditorHtml("角色秘密档案 JSON", "data-pipe-characters-json", session.characterArchives);
    if (normalized === "matrix") return pipelineJsonEditorHtml("信息矩阵 JSON", "data-pipe-matrix-json", session.infoMatrix);
    if (normalized === "host") return pipelineHostEditorHtml(session);
    if (normalized === "scripts") return pipelineScriptsEditorHtml(session, ctx.roleKey, ctx.chapterKey);
    if (normalized === "sync" || layer === "structure") return pipelineStructureEditorHtml(session.proposal, session);
    if (normalized === "evaluate") {
      return session.evaluation
        ? pipelineEvaluationPreview(session.evaluation)
        : pipelineEmptyLayerHtml("evaluate", session);
    }
    return "";
  }

  function pipelineLocationBarHtml(session) {
    const stepLabel = pipelineStepName(session.activeLayer);
    return `<div class="pipeline-location-bar"><span class="pipeline-loc-muted">创作中心</span><span class="pipeline-loc-arrow">→</span><strong>AI 剧本创作</strong><span class="pipeline-loc-arrow">→</span><span data-pipeline-loc-step>${escapeHtml(stepLabel)}</span><span class="cloud-pill pipeline-loc-mode">八层生成</span></div>`;
  }

  function pipelineModeTabsHtml() {
    return "";
  }

  function pipelineBriefFieldsHtml() {
    return "";
  }

  function pipelineWizardFrameHtml(status, session, pipelineMode) {
    const statusClass = status.configured ? "ready" : "missing";
    const sourceLabel =
      status.source === "user"
        ? "自备 API"
        : status.source === "platform"
          ? "平台额度"
          : "未配置";
    const nameSuffix = status.connectionName ? ` · ${escapeHtml(status.connectionName)}` : "";
    const statusTitle = status.configured ? `${sourceLabel} 已连接` : "AI 未就绪";
    const statusText = status.configured
      ? `${escapeHtml(status.model || "")}${nameSuffix} · 180s/步`
      : "请在账号设置添加 API 连接，或等待平台额度开放";
    return `<div class="pipeline-wizard-frame"><header class="pipeline-wizard-header"><div class="pipeline-wizard-title-row"><div><h2>AI 剧本创作</h2><p class="pipeline-wizard-hint">${escapeHtml(PS().PIPELINE_FLOW_SUMMARY || "八层生成流程：立项 → 真相 → 角色 → 信息矩阵 → 主持手册 → 逐幕剧本 → 评判 → 入库")}</p><p class="pipeline-wizard-estimate">${escapeHtml(PS().PIPELINE_FLOW_ESTIMATE || "")}</p></div><div class="deepseek-status pipeline-status-chip ${statusClass}"><b>${statusTitle}</b><span>${statusText}</span></div></div>${pipelineLocationBarHtml(session)}</header><div class="pipeline-wizard-body"><aside class="pipeline-wizard-side"><p class="pipeline-side-kicker">创作步骤</p><nav class="pipeline-ladder" data-pipeline-ladder aria-label="创作层级"></nav>${pipelineBriefFieldsHtml()}</aside><main class="pipeline-wizard-main"><div class="pipeline-layer-head" data-pipeline-layer-head></div><div class="pipeline-layer-editor" data-pipeline-layer-editor></div><footer class="pipeline-layer-bar"><div class="pipeline-layer-actions row" data-pipeline-layer-actions></div><div class="pipeline-summary" data-pipeline-summary></div></footer></main></div><footer class="pipeline-wizard-footer"><div class="pipeline-wizard-footer-left">${aiLocalDraftActions()}</div><div class="pipeline-wizard-footer-right"><button class="secondary-btn" type="button" data-close>关闭</button><button class="secondary-btn" type="button" data-pipeline-apply-hints disabled>应用评判提示</button><button class="secondary-btn" type="button" data-pipeline-import-structure disabled>仅上传编排</button><button class="primary-btn" type="button" data-pipeline-import-all disabled>上传全部到云端</button></div></footer></div>`;
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
    pipelineScriptsEditorHtml,
    pipelineHostEditorHtml,
    pipelineJsonEditorHtml,
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
