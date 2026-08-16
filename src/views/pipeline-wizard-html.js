/** AI pipeline wizard HTML templates. */
import { studioStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as M from "../components/modal.js";
import { diagnosePlayerScript } from "../../shared/prose-quality-gate.js";
import { PLAY_STRUCTURE_PROFILES, normalizePlayStructure } from "../../shared/play-structure.js";
(function (window) {
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const studioField = M.studioField || (() => "");
  const PS = () => window.zhimuPipelineSession || {};
  const PB = () => window.zhimuPipelineBrief || {};
  const PIPELINE_LAYER_ORDER = PS().PIPELINE_LAYER_ORDER || [];
  const PIPELINE_LAYER_LABEL = PS().PIPELINE_LAYER_LABEL || {};
  const PIPELINE_LAYER_DEPS = PS().PIPELINE_LAYER_DEPS || {};
  const REVISION_PRIORITY_LABEL = { must_fix: "必改", should_fix: "建议改", optional: "可选" };
  const REPAIR_STAGE_LABEL = { source: "创作立项", truth: "世界与真相", characters: "角色档案", clues: "线索网络", matrix: "公共流程", outlines: "分幕认知纲要", scripts: "逐幕剧本", host: "主持手册", evaluation: "重新评判" };
  const repairStageLabel = (stage) => REPAIR_STAGE_LABEL[stage] || PIPELINE_LAYER_LABEL[stage] || stage || "评判";
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
        humanAuthorship: "真人作者感", subtext: "潜台词留白", voiceDistinctness: "角色声线",
        thesisPredictability: "立意不可预测", livedExperience: "生活可信度", consequenceContinuity: "幕间因果",
        matrixConsistency: "矩阵一致", spoilerSafety: "剧透安全", taskCompleteness: "任务完整", importReady: "可入库",
        logicalCoherence: "真相自洽", informationSymmetry: "信息可还原", immersiveMisdirection: "误导沉浸",
        mechanismRunnable: "机制可执行", roleBehaviorEntropy: "行为选择", readability: "可读性",
        roleAgency: "角色能动性", materialOperability: "物料可操作", sharedSceneConsistency: "公共场景一致",
        clueTopology: "线索拓扑", clueResilience: "线索抗毁", cooperationRhythm: "合作节奏", dramaticTension: "戏剧张力"
      };
      return `<span>${labels[key] || key} ${score}/10</span>`;
    }).join("");
    const style = evaluation.styleAlignment || {};
    const revisionRows = (evaluation.revisions || []).map((rev) => `<article class="revision-row ${rev.priority}"><div class="revision-head"><span class="cloud-pill">${REVISION_PRIORITY_LABEL[rev.priority] || rev.priority}</span><b>${escapeHtml(PIPELINE_LAYER_LABEL[rev.targetLayer] || rev.targetLayer)}${rev.targetKey ? ` · ${escapeHtml(rev.targetKey)}` : ""}</b></div><p><strong>问题</strong> ${escapeHtml(rev.problem)}</p><p><strong>方向</strong> ${escapeHtml(rev.direction)}</p>${rev.preserve ? `<p><strong>保留</strong> ${escapeHtml(rev.preserve)}</p>` : ""}${rev.promptHint ? `<p class="prompt-hint"><strong>下轮提示</strong> ${escapeHtml(rev.promptHint)}</p>` : ""}</article>`).join("") || `<div class="empty-state">暂无分层修改建议</div>`;
    const nextSteps = (evaluation.nextStepOrder || []).map((layer) => PIPELINE_LAYER_LABEL[layer] || layer).join(" → ");
    const repairPlan = evaluation.repairPlan || {};
    const repairRows = (repairPlan.items || []).slice(0, 12).map((item) => {
      const paths = item.invalidatesPaths || [];
      const pathSummary = paths.length ? `${paths.slice(0, 4).join("、")}${paths.length > 4 ? ` 等 ${paths.length} 项` : ""}` : "";
      return `<article class="revision-row ${item.severity === "high" ? "must_fix" : "should_fix"}"><div class="revision-head"><span class="cloud-pill">${escapeHtml(item.severity === "high" ? "阻断" : "返工")}</span><b>${escapeHtml(repairStageLabel(item.targetStage))}${item.key ? ` · ${escapeHtml(item.key)}` : ""}</b></div><p><strong>问题</strong> ${escapeHtml(item.problem || "")}</p><p><strong>只需失效</strong> ${escapeHtml((item.invalidates || []).map(repairStageLabel).join(" → "))}</p>${pathSummary ? `<p><strong>精确对象</strong> ${escapeHtml(pathSummary)}</p>` : ""}<p><strong>动作</strong> ${escapeHtml(item.direction || "")}</p></article>`;
    }).join("");
    const repairBlock = repairPlan.earliestStage
      ? `<div class="revision-list"><h4>局部返工计划 · 最早回到 ${escapeHtml(repairStageLabel(repairPlan.earliestStage))}</h4>${repairRows || "<p class=\"muted-note\">暂无具体返工项。</p>"}</div>`
      : "";
    const redTeamLabels = {
      selfish_withholder: "利己隐瞒者", silent_player: "沉默玩家", clue_saboteur: "线索破坏者",
      false_consensus: "错误共识", novice_host: "新手主持", remove_role: "删除角色"
    };
    const redTeamRows = (evaluation.redTeamFindings || []).map((item) => `<article class="revision-row ${item.severity === "high" || item.result === "blocked" ? "must_fix" : item.result === "fragile" ? "should_fix" : "optional"}"><div class="revision-head"><span class="cloud-pill">${escapeHtml(item.result || "unknown")}</span><b>${escapeHtml(redTeamLabels[item.scenario] || item.scenario || "红队场景")}${item.targetKey ? ` · ${escapeHtml(item.targetKey)}` : ""}</b></div>${item.observedFailure ? `<p>${escapeHtml(item.observedFailure)}</p>` : ""}${item.repairLayer ? `<p><strong>返工层</strong> ${escapeHtml(repairStageLabel(item.repairLayer))}</p>` : ""}</article>`).join("");
    const redTeamBlock = redTeamRows
      ? `<div class="revision-list"><h4>对抗性桌测 ${evaluation.redTeamComplete ? "· 已覆盖六类" : "· 覆盖不完整"}</h4>${redTeamRows}</div>`
      : "";
    const strategy = evaluation.strategyPlaytest;
    const strategyIssues = (strategy?.issues || []).slice(0, 8).map((item) => `<article class="revision-row ${item.severity === "high" ? "must_fix" : "should_fix"}"><div class="revision-head"><span class="cloud-pill">${item.severity === "high" ? "阻断" : "提醒"}</span><b>${escapeHtml(item.code || "策略压测")}</b></div><p>${escapeHtml(item.message || "")}</p></article>`).join("");
    const strategyBlock = strategy && !strategy.skipped
      ? `<div class="revision-list"><h4>100 局策略压力测试 · ${strategy.passed ? "结构通过" : "存在阻断"}</h4><p class="muted-note">关键真相整局还原 ${Math.round((strategy.metrics?.allCriticalTruthRecoveryRate || 0) * 100)}% · 默认推进 ${Math.round((strategy.metrics?.defaultDecisionRate || 0) * 100)}% · 可达主结局 ${(strategy.metrics?.reachableEndingKeys || []).length} 条</p><p class="muted-note">${escapeHtml(strategy.claimBoundary || "")}</p>${strategyIssues}</div>`
      : "";
    const ready = evaluation.readyForSync ?? evaluation.readyForImport;
    const proseGate = evaluation.proseDiagnostics ? proseDiagnosticsPreview(evaluation.proseDiagnostics, { collection: true }) : "";
    return `<section class="assistant-preview evaluation-preview"><div class="section-head"><div><p class="section-kicker">质检 · 修改指导</p><h3>${evaluation.overallScore}/10 · ${escapeHtml(evaluation.verdict || "")}</h3><p>${ready ? "✓ 已通过评判与正文门禁" : "✗ 未通过门禁，不能进入机械入库"}</p></div></div><div class="proposal-stats">${scoreRows}</div>${proseGate}${style.summary ? `<div class="assistant-guide"><b>风格契合 · ${escapeHtml(style.matchLevel || "medium")}</b><span>${escapeHtml(style.summary)}</span></div>` : ""}${nextSteps ? `<p class="muted-note"><b>建议重生成顺序</b> ${escapeHtml(nextSteps)}</p>` : ""}${strategyBlock}${repairBlock}${redTeamBlock}<div class="revision-list"><h4>分层修改方向</h4>${revisionRows}</div></section>`;
  }

  function proseDiagnosticsPreview(diagnostics, { collection = false } = {}) {
    if (!diagnostics) return "";
    const summary = diagnostics.summary || {};
    const state = diagnostics.passed ? "已通过" : "已拦截";
    const title = collection ? "全部正文场景化门禁" : "当前正文场景化门禁";
    const scope = collection
      ? `${summary.totalCells || 0} 格 · ${summary.blockedCells || 0} 格被拦截`
      : `${diagnostics.metrics?.paragraphCount || 0} 段 · 场景证据 ${Math.round((diagnostics.metrics?.sceneEvidenceRatio || 0) * 100)}%`;
    const issueRows = (diagnostics.issues || []).slice(0, 8).map((issue) => {
      const cell = issue.cell ? `${issue.cell} · ` : "";
      const paragraph = issue.paragraph ? `第 ${issue.paragraph} 段` : "全篇";
      return `<article class="revision-row ${issue.severity === "high" ? "must_fix" : "should_fix"}"><div class="revision-head"><span class="cloud-pill">${issue.severity === "high" ? "阻断" : "提醒"}</span><b>${escapeHtml(cell + paragraph)}</b></div>${issue.excerpt ? `<p><strong>原文</strong> ${escapeHtml(issue.excerpt)}</p>` : ""}<p><strong>判断</strong> ${escapeHtml(issue.message)}</p><p><strong>修改动作</strong> ${escapeHtml(issue.action)}</p></article>`;
    }).join("");
    const empty = diagnostics.metrics?.chars === 0 && !collection
      ? `<p class="muted-note">输入正文后自动逐段检查。</p>`
      : diagnostics.passed && !issueRows
        ? `<p class="muted-note">未发现高置信的解释性旁白、策划说明腔或伪文学收口。通过不等于文笔优秀，仍需人工朗读审查。</p>`
        : issueRows;
    return `<section class="assistant-guide prose-quality-gate ${diagnostics.passed ? "passed" : "blocked"}" data-prose-quality-result><b>${escapeHtml(title)} · ${state}</b><span>${escapeHtml(scope)} · 机械分 ${diagnostics.score}/100</span><div class="revision-list">${empty}</div></section>`;
  }

  function pipelinePreviewHtml(session) {
    const parts = [];
    const config = session.config;
    const theme = session.setting?.theme || config?.title || "";
    if (theme) parts.push(`<span>${escapeHtml(theme.slice(0, 24))}</span>`);
    if (config?.chapterKeys?.length) parts.push(`<span>${config.chapterKeys.length} 幕</span>`);
    if (session.truthBible?.summary) parts.push(`<span>${session.truthBible.playStructure === "mystery" ? "真相" : "世界合同"}已建</span>`);
    if (session.characterArchives?.roles?.length) parts.push(`<span>${session.characterArchives.roles.length} 角色</span>`);
    if (session.clueNetwork?.clues?.length) parts.push(`<span>${session.clueNetwork.clues.length} 条局部线索</span>`);
    const scriptCount = Object.values(session.scripts || {}).reduce((n, acts) => n + Object.keys(acts || {}).length, 0);
    if (scriptCount) parts.push(`<span>${scriptCount} 段剧本</span>`);
    if (session.proposal) parts.push(`<span>${session.proposal.scenes?.length || 0} 场景 · ${session.proposal.edges?.length || 0} 边</span>`);
    return parts.length ? `<div class="proposal-stats">${parts.join("")}</div>` : "";
  }

  function pipelineLadderHtml(session, activeLayer) {
    return PIPELINE_LAYER_ORDER.map((layer) => {
      const status = pipelineLayerStatus(session, layer);
      const statusLabel = { empty: layer === "setup" ? "待填写" : "待生成", stale: "局部过期", draft: "待确认", locked: "已锁定" }[status];
      return `<button type="button" class="pipeline-ladder-item ${layer === activeLayer ? "active" : ""} status-${status}" data-pipeline-layer="${layer}"><span class="pipeline-ladder-seq">${pipelineStepLabel(layer).slice(0, 2)}</span><span class="pipeline-ladder-text"><b>${escapeHtml(pipelineStepName(layer))}</b><small>${statusLabel}</small></span></button>`;
    }).join("");
  }

  function pipelineLayerHeadHtml(layer, session) {
    const status = pipelineLayerStatus(session, layer);
    const statusNote = {
      empty: layer === "setup" ? "请填写创作设定与剧情纲要，本层不用 AI。填好后点「确认并继续」。" : "请 AI 生成初稿，或直接编辑下方字段。",
      stale: `本层保留了原产物，但有 ${PS().pipelineLayerStalePaths?.(session, layer)?.length || 0} 个精确依赖已过期；只修复这些对象并重新确认。`,
      draft: "修改满意后点「确认本层」，再进入下一步。",
      locked: "本层已锁定，可继续编辑；保存后会清除下游内容。"
    }[status];
    const matrixNote = layer === "truth" && status !== "locked"
      ? `<p class="muted-note">② 按玩法结构生成世界与真相合同：推理案件锁定凶手与手法；阵营/机制结构锁定公共危机、不可逆期限、客观事实与结局轴。约 1～3 分钟。</p>`
      : layer === "clues" && status !== "locked"
        ? "<p class=\"muted-note\">④ 先把真相拆成私人、双人、局部与少量公共锚点；关键真相保留两条独立还原路径。</p>"
      : layer === "scripts" && status !== "locked"
        ? "<p class=\"muted-note\">⑦ 按「角色 × 幕」从公共流程与授权线索生成私人本；每次只写一格，约 30～90 秒。</p>"
        : layer === "sync" && status !== "locked"
          ? "<p class=\"muted-note\">⑨ 从公共流程与线索网机械生成编排图（非 NLP 反推），确认后上传。</p>"
          : "";
    const evaluateNote = layer === "evaluate" && status === "draft"
      ? "<p class=\"muted-note\">通过后可确认并进入 ⑨；未通过时用底部「前往最早返工层」按依赖范围修改，不再把所有意见写回立项。</p>"
      : layer === "evaluate" && status === "empty" && pipelineDepsLocked(session, layer)
        ? "<p class=\"muted-note\">基于信息矩阵与逐幕剧本给出质检与改稿方向，通常需 1～3 分钟。</p>"
        : "";
    const depNote = (PIPELINE_LAYER_DEPS[layer] || []).length && !pipelineDepsLocked(session, layer)
      ? `<p class="pipeline-dep-warn">请先在左侧完成并锁定：${(PIPELINE_LAYER_DEPS[layer] || []).map((item) => pipelineStepName(item)).join("、")}</p>` : "";
    return `<div class="pipeline-layer-head-inner"><div><p class="section-kicker">${pipelineStepLabel(layer)}</p><h3>${escapeHtml(PIPELINE_LAYER_LABEL[layer] || layer)}</h3><p class="wizard-intro">${statusNote || ""}</p>${matrixNote}${evaluateNote}${depNote}</div><span class="cloud-pill pipeline-status-pill status-${status}">${{ empty: layer === "setup" ? "待填写" : "待生成", stale: "局部过期", draft: "待确认", locked: "已锁定" }[status]}</span></div>`;
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
    const playStructure = normalizePlayStructure(setting.playStructure);
    const eraPreset = setting.eraPreset || "modern-cn";
    const playStructureOptions = Object.values(PLAY_STRUCTURE_PROFILES).map((profile) => `<option value="${profile.key}" ${playStructure === profile.key ? "selected" : ""}>${escapeHtml(profile.label)}</option>`).join("");
    return `<div class="pipeline-edit-grid pipeline-spec-simple"><h4>创作设定</h4>${studioField("主题", "aiTheme", "input", theme)}${studioField("玩家人数（4～8）", "aiPlayerCount", "input", String(setting.playerCount || 6))}${studioField("幕数（3～5）", "aiChapterCount", "input", String(setting.chapterCount || 5))}<label for="aiPlayStructure">玩法结构</label><select class="field" id="aiPlayStructure" name="aiPlayStructure" data-studio-field="aiPlayStructure">${playStructureOptions}</select><label for="aiMatrixMode">推理表现</label><select class="field" id="aiMatrixMode" name="aiMatrixMode" data-studio-field="aiMatrixMode"><option value="honkaku" ${matrixMode === "honkaku" ? "selected" : ""}>现实规则 / 本格</option><option value="henkaku" ${matrixMode === "henkaku" ? "selected" : ""}>特殊规则 / 变格</option></select><label for="aiEraPreset">时代背景</label><select class="field" id="aiEraPreset" name="aiEraPreset" data-studio-field="aiEraPreset"><option value="republic-cn" ${eraPreset === "republic-cn" ? "selected" : ""}>民国中国</option><option value="modern-cn" ${eraPreset === "modern-cn" ? "selected" : ""}>当代中国</option><option value="campus-2000s" ${eraPreset === "campus-2000s" ? "selected" : ""}>千禧校园</option><option value="victorian-uk" ${eraPreset === "victorian-uk" ? "selected" : ""}>维多利亚英国</option><option value="edo-jp" ${eraPreset === "edo-jp" ? "selected" : ""}>江户日本</option><option value="lighthouse-industrial" ${eraPreset === "lighthouse-industrial" ? "selected" : ""}>工业灯塔</option><option value="near-future" ${eraPreset === "near-future" ? "selected" : ""}>近未来</option><option value="rural-contemporary" ${eraPreset === "rural-contemporary" ? "selected" : ""}>当代乡村</option></select><label for="aiVolumeTier">体量档位</label><select class="field" id="aiVolumeTier" name="aiVolumeTier" data-studio-field="aiVolumeTier"><option value="demo" ${volumeTier === "demo" ? "selected" : ""}>示范档（短）</option><option value="standard" ${volumeTier === "standard" ? "selected" : ""}>标准档</option><option value="epic" ${volumeTier === "epic" ? "selected" : ""}>完整档（长）</option></select><label for="aiPov">玩家本视角</label><select class="field" id="aiPov" name="aiPov" data-studio-field="aiPov"><option value="second" ${pov === "second" ? "selected" : ""}>第二人称「你」</option><option value="first" ${pov === "first" ? "selected" : ""}>第一人称「我」</option></select>${studioField("额外的矛盾冲突", "aiConflicts", "textarea", setting.extraConflicts || "")}${studioField("场景基调（选填）", "aiTone", "input", setting.tone || "")}${studioField("文风锚点（2～3 段范例）", "aiStyleAnchor", "textarea", setting.styleAnchor || "")}${studioField("禁用词/套话（每行一条）", "aiForbiddenPhrases", "textarea", setting.forbiddenPhrases || "")}<h4>剧情纲要</h4>${studioField("纲要正文", "aiSynopsisBody", "textarea", body)}${studioField("人物关系（选填）", "aiCharactersSketch", "textarea", synopsis.charactersSketch || "")}${studioField("真相概要（选填）", "aiTruthSketch", "textarea", synopsis.truthSketch || "")}${studioField("误导线（选填）", "aiRedHerringsSketch", "textarea", synopsis.redHerringsSketch || "")}<p class="muted-note">① 玩法结构决定后端真相合同：推理案件要求凶手与手法；阵营、机制和混合结构要求公共危机、不可逆决定与结局轴，不再硬塞命案。</p></div>`;
  }

  function pipelineSpecEditorHtml(session) {
    return pipelineSetupEditorHtml(session);
  }

  function pipelineEmptyLayerHtml(layer, session) {
    const label = PIPELINE_LAYER_LABEL[layer] || layer;
    if (pipelineDepsLocked(session, layer)) {
      const hints = {
        truth: `<div class="empty-state"><p>② 世界与真相合同</p><p class="muted-note">先证明玩家体验，再把幕后因果拆成主线、支线、关系与背景真相节点。</p></div>`,
        characters: `<div class="empty-state"><p>③ 角色秘密档案</p><p class="muted-note">为每位玩家建立不同的欲望、关系债务、主动手段、完整认知与局部误读。</p></div>`,
        clues: `<div class="empty-state"><p>④ 稀疏线索网络</p><p class="muted-note">局部线索不强连全员；区分持有人、解释者与误读者，并为关键真相保留独立还原路径。</p></div>`,
        matrix: `<div class="empty-state"><p>⑤ 公共流程矩阵</p><p class="muted-note">只调度既有线索，安排探索、暂时合作、尖锐决定与玩家行为造成的幕间变化。</p></div>`,
        host: `<div class="empty-state"><p>⑥ 主持手册</p><p class="muted-note">按幕生成流程、线索取得与结算说明；可一次生成全部幕。</p></div>`,
        scripts: `<div class="empty-state"><p>⑦ 逐幕剧本</p><p class="muted-note">按「角色 × 幕」逐格生成私人本；每格只读取该角色有权知道的线索。</p></div>`,
        evaluate: `<div class="empty-state"><p>⑧ 矩阵评判</p><p class="muted-note">检查真人感、线索拓扑、抗卡死能力、合作节奏与戏剧张力。</p></div>`,
        sync: `<div class="empty-state"><p>⑨ 机械入库</p><p class="muted-note">从公共流程与线索网<strong>机械</strong>生成编排图，确认后上传。</p></div>`
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
    const audit = session.generationAudit;
    const originCounts = Object.values(audit?.artifacts || {}).reduce((counts, item) => {
      counts[item.originKind] = (counts[item.originKind] || 0) + 1;
      return counts;
    }, {});
    const auditHtml = audit
      ? `<div class="assistant-guide"><b>生成来源已装入入库包</b><span>${Object.keys(audit.artifacts || {}).length} 个字段级指纹 · AI 生成 ${originCounts.ai_generated || 0} · 人工改写 ${originCounts.human_edited || 0} · 未知来源 ${originCounts.unknown_import || 0}</span></div>`
      : "";
    const chapterOpen = (proposal.chapters?.length || 0) <= 4 ? " open" : "";
    const sceneOpen = sceneCount <= 4 ? " open" : "";
    return `<div class="pipeline-edit-grid">${auditHtml}${studioField("剧本标题", "pipeStructTitle", "input", proposal.title || "")}${studioField("logline", "pipeStructLogline", "textarea", proposal.logline || "")}<div class="proposal-stats"><span>${proposal.chapters?.length || 0} 章</span><span>${sceneCount} 场景</span><span>${proposal.investigationPoints?.length || 0} 调查点</span><span>${proposal.clues?.length || 0} 线索</span><span>${proposal.edges?.length || 0} 连线</span></div><details${chapterOpen}><summary>章节</summary><div class="pipeline-card-grid">${chapters}</div></details><details${sceneOpen}><summary>场景</summary><div class="pipeline-card-grid">${scenes}</div></details><details><summary>线索名称</summary><div class="pipeline-card-grid inline-grid">${clues}</div></details><p class="muted-note">调查点与连线由 AI 生成，细调请上传后在编排台修改。场景/章节较多时默认折叠以减轻卡顿。</p></div>`;
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

  function pipelineClueNetworkEditorHtml(session) {
    const network = session.clueNetwork;
    if (!network) return pipelineEmptyLayerHtml("clues", session);
    const clues = network.clues || [];
    const localScopes = new Set(["private", "pair", "group"]);
    const localCount = clues.filter((clue) => localScopes.has(clue.scope)).length;
    const publicCount = clues.filter((clue) => clue.scope === "public_anchor").length;
    const critical = (session.truthBible?.truthNodes || []).filter((node) => node.importance === "critical");
    const covered = critical.filter((node) => {
      const row = (network.truthCoverage || []).find((item) => item.truthNodeKey === node.key);
      return row?.paths?.length >= 2 && row?.fallback;
    }).length;
    const allRoleNonPublic = clues.filter((clue) =>
      clue.scope !== "public_anchor" && clue.involvedRoleKeys?.length >= (session.config?.playerCount || 0)
    );
    const warnings = [];
    if (clues.length && localCount / clues.length < 0.4) warnings.push("局部线索不足 40%，容易重新退化成全桌共享题库。");
    if (publicCount > (session.config?.chapterKeys?.length || 0)) warnings.push("公共锚点超过幕数，请确认它们是否真的改变全桌现实。");
    if (allRoleNonPublic.length) warnings.push(`有 ${allRoleNonPublic.length} 条非公共线索强行关联所有角色。`);
    const warningHtml = warnings.length
      ? `<div class="revision-list">${warnings.map((item) => `<p class="pipeline-dep-warn">${escapeHtml(item)}</p>`).join("")}</div>`
      : `<p class="muted-note">未发现明显的全员强连；仍需人工检查线索内容是否提供推断空间。</p>`;
    const stats = `<div class="proposal-stats"><span>${clues.length} 条线索</span><span>${localCount} 条私人/双人/局部</span><span>${publicCount} 条公共锚点</span><span>关键节点 ${covered}/${critical.length} 双路径覆盖</span><span>${network.links?.length || 0} 条真实关联</span></div>`;
    return `<div class="pipeline-edit-grid"><div class="assistant-guide"><b>线索网体检</b><span>冗余是同一关键真相有两条独立路径，不是每条线索都牵扯所有人。</span></div>${stats}${warningHtml}${pipelineLabeledTextarea("线索网络 JSON（玩家可见 description 与 HOST 含义分离）", "pipe-clues-json", JSON.stringify(network, null, 2), { rows: 26, className: "field manuscript-body", dataAttr: "data-pipe-clues-json" })}</div>`;
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
    const diagnostics = diagnosePlayerScript(script.body || "");
    return `<div class="pipeline-edit-grid"><p class="muted-note">进度 ${progress.done}/${progress.total} · 最低 ${min} 字/格</p>${pipelineLabeledSelect("当前角色", "pipe-role", roleOptions, "data-pipeline-role")}${pipelineLabeledSelect("当前幕", "pipe-chapter", actOptions, "data-pipeline-chapter")}${studioField("分幕标题", "pipeSectionTitle", "input", script.title || "")}${pipelineLabeledTextarea("私人正文", "pipe-section-body", script.body || "", { rows: 14, className: "field manuscript-body", dataAttr: "data-pipe-section-body" })}<div data-prose-quality-host>${proseDiagnosticsPreview(diagnostics)}</div>${studioField("本幕任务（每行一条）", "pipeScriptTasks", "textarea", (script.tasks || []).join("\n"))}${studioField("结尾钩子", "pipeScriptHook", "input", script.closingHook || "")}<div data-pipeline-section-list-host>${pipelineSectionListHtml(session)}</div></div>`;
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
    if (normalized === "clues") return pipelineClueNetworkEditorHtml(session);
    if (normalized === "matrix") return pipelineJsonEditorHtml("公共流程矩阵 JSON（只调度线索，不在这里发明线索）", "data-pipe-matrix-json", session.infoMatrix);
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
    return `<div class="pipeline-location-bar"><span class="pipeline-loc-muted">创作中心</span><span class="pipeline-loc-arrow">→</span><strong>AI 剧本创作</strong><span class="pipeline-loc-arrow">→</span><span data-pipeline-loc-step>${escapeHtml(stepLabel)}</span><span class="cloud-pill pipeline-loc-mode">九层创作</span></div>`;
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
          ? "平台 API"
          : "未配置";
    const nameSuffix = status.connectionName ? ` · ${escapeHtml(status.connectionName)}` : "";
    const statusTitle = status.configured ? `${sourceLabel} 已连接` : "AI 未就绪";
    const statusText = status.configured
      ? `${escapeHtml(status.model || "")}${nameSuffix} · 180s/步`
      : "请在账号设置添加并测试自己的 API 连接";
    return `<div class="pipeline-wizard-frame"><header class="pipeline-wizard-header"><div class="pipeline-wizard-title-row"><div><h2>AI 剧本创作</h2><p class="pipeline-wizard-hint">${escapeHtml(PS().PIPELINE_FLOW_SUMMARY || "九层创作流程：立项 → 真相节点 → 角色认知 → 线索网络 → 公共流程 → 主持手册 → 逐幕剧本 → 评判 → 入库")}</p><p class="pipeline-wizard-estimate">${escapeHtml(PS().PIPELINE_FLOW_ESTIMATE || "")}</p></div><div class="deepseek-status pipeline-status-chip ${statusClass}"><b>${statusTitle}</b><span>${statusText}</span></div></div>${pipelineLocationBarHtml(session)}</header><div class="pipeline-wizard-body"><aside class="pipeline-wizard-side"><p class="pipeline-side-kicker">创作步骤</p><nav class="pipeline-ladder" data-pipeline-ladder aria-label="创作层级"></nav>${pipelineBriefFieldsHtml()}</aside><main class="pipeline-wizard-main"><div class="pipeline-layer-head" data-pipeline-layer-head></div><div class="pipeline-layer-editor" data-pipeline-layer-editor></div><footer class="pipeline-layer-bar"><div class="pipeline-layer-actions row" data-pipeline-layer-actions></div><div class="pipeline-summary" data-pipeline-summary></div></footer></main></div><footer class="pipeline-wizard-footer"><div class="pipeline-wizard-footer-left">${aiLocalDraftActions()}</div><div class="pipeline-wizard-footer-right"><button class="secondary-btn" type="button" data-close>关闭</button><button class="secondary-btn" type="button" data-pipeline-apply-hints disabled>前往最早返工层</button><button class="secondary-btn" type="button" data-pipeline-import-structure disabled>仅上传编排</button><button class="primary-btn" type="button" data-pipeline-import-all disabled>上传全部到云端</button></div></footer></div>`;
  }

  window.zhimuPipelineHtml = {
    pipelineEvaluationPreview,
    proseDiagnosticsPreview,
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
