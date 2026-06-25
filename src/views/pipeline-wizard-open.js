/** AI pipeline wizard modal controller (open + render loop). */
(function (window) {
  const zhimuApi = window.zhimuApi;
  const { modal, modalBackdrop } = window.zhimuDom;
  const F = window.zhimuFormat || {};
  const M = window.zhimuModal || {};
  const T = window.zhimuToast || {};
  const formatRelativeTime = F.formatRelativeTime || (() => "");
  const formatTime = F.formatTime || (() => "");
  const showToast = T.showToast || (() => {});
  const showError = (error, fallback = "操作失败，请稍后重试") => showToast(window.zhimuStatus?.normalizeError?.(error, fallback) || error?.message || fallback);
  const closeModal = M.closeModal || (() => {});
  const studioValues = M.studioValues || (() => ({}));
  const go = window.zhimuGo;
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }

  const AiDraft = () => window.zhimuAiDraft;
  const PS = () => window.zhimuPipelineSession || {};
  const PIPELINE_LAYER_ORDER = PS().PIPELINE_LAYER_ORDER || ["setup", "narrative", "roles", "evaluate", "sync"];
  const defaultPipelineSession = (...args) => PS().defaultPipelineSession?.(...args) ?? { setting: null, synopsis: null, config: null, narrativeChapters: {}, rolesMeta: null, sections: {}, evaluation: null, proposal: null, locks: {}, activeLayer: "setup", _editorRev: {} };
  const normalizePipelineSession = (...args) => PS().normalizePipelineSession?.(...args) ?? defaultPipelineSession();
  const pipelineLayerHasData = (...args) => PS().pipelineLayerHasData?.(...args) ?? false;
  const pipelineLayerStatus = (...args) => PS().pipelineLayerStatus?.(...args) ?? "empty";
  const pipelineDepsLocked = (...args) => PS().pipelineDepsLocked?.(...args) ?? false;
  const pipelineClearDownstream = (...args) => PS().pipelineClearDownstream?.(...args);
  const pipelineStepLabel = (...args) => PS().pipelineStepLabel?.(...args) ?? "";
  const pipelineStepName = (...args) => PS().pipelineStepName?.(...args) ?? "";
  const pipelineChaptersForSession = (...args) => PS().pipelineChaptersForSession?.(...args) ?? [];
  const pipelineNarrativeChapterList = (...args) => PS().pipelineNarrativeChapterList?.(...args) ?? [];
  const pipelineStubProposal = (...args) => PS().pipelineStubProposal?.(...args) ?? null;

  const PB = () => window.zhimuPipelineBrief || {};
  const PH = () => window.zhimuPipelineHtml || {};
  const PD = () => window.zhimuPipelineDom || {};
  const pipelineBriefFromForm = (...args) => PB().pipelineBriefFromForm?.(...args) ?? {};
  const pipelineCreativeFromForm = (...args) => PB().pipelineCreativeFromForm?.(...args) ?? {};
  const pipelineValidateSetup = (...args) => PB().pipelineValidateSetup?.(...args) ?? false;
  const pipelineReadSetupFromDom = (...args) => PD().pipelineReadSetupFromDom?.(...args) ?? {};
  const pipelinePreviewHtml = (...args) => PH().pipelinePreviewHtml?.(...args) ?? "";
  const pipelineLadderHtml = (...args) => PH().pipelineLadderHtml?.(...args) ?? "";
  const pipelineLayerHeadHtml = (...args) => PH().pipelineLayerHeadHtml?.(...args) ?? "";
  const pipelineLayerEditorHtml = (...args) => PH().pipelineLayerEditorHtml?.(...args) ?? "";
  const pipelineWizardFrameHtml = (...args) => PH().pipelineWizardFrameHtml?.(...args) ?? "";
  const pipelineSectionListHtml = (...args) => PH().pipelineSectionListHtml?.(...args) ?? "";
  const pipelinePersistActiveEditor = (...args) => PD().pipelinePersistActiveEditor?.(...args);
  const pipelineApplyLayerSave = (...args) => PD().pipelineApplyLayerSave?.(...args);
  const pipelineReadSpecFromDom = (...args) => PD().pipelineReadSpecFromDom?.(...args);

  function aiDraftWorldId() { return zhimuApi.context?.worldId || ""; }
  function collectAiFormFields() {
    const v = studioValues();
    return {
      aiTheme: v.aiTheme || v.aiTitle,
      aiPlayerCount: v.aiPlayerCount,
      aiChapterCount: v.aiChapterCount,
      aiWordsPerChapter: v.aiWordsPerChapter,
      aiConflicts: v.aiConflicts,
      aiTone: v.aiTone,
      aiSynopsisBody: v.aiSynopsisBody || v.aiPremise,
      aiCharactersSketch: v.aiCharactersSketch,
      aiTruthSketch: v.aiTruthSketch,
      aiRedHerringsSketch: v.aiRedHerringsSketch
    };
  }
  function migrateAiFormFields(form) {
    if (!form) return form;
    const next = { ...form };
    if (!next.aiTheme && next.aiTitle) next.aiTheme = next.aiTitle;
    if (!next.aiSynopsisBody && next.aiPremise) next.aiSynopsisBody = next.aiPremise;
    if (!next.aiWordsPerChapter && next.aiTargetWordCount && next.aiChapterCount) {
      next.aiWordsPerChapter = String(Math.round(Number(next.aiTargetWordCount) / Number(next.aiChapterCount)) || 8000);
    }
    if (!next.aiConflicts && next.aiRequirements) next.aiConflicts = next.aiRequirements;
    if (!next.aiPlayerCount) next.aiPlayerCount = "6";
    return next;
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

  function migrateLegacyDrafts(session, existingDraft, restoreForm) {
    if (!session.proposal) {
      const structureDraft = loadLocalAiDraft(AiDraft()?.KIND?.STRUCTURE);
      if (structureDraft?.payload?.proposal) {
        session.proposal = structureDraft.payload.proposal;
        session.locks.sync = false;
        session.activeLayer = "sync";
        if (structureDraft.payload.form && !existingDraft?.payload?.form) restoreAiFormFields(migrateAiFormFields(structureDraft.payload.form));
      }
    }
    if (!session.config && !session.setting) {
      const fullDraft = loadLocalAiDraft(AiDraft()?.KIND?.FULL_MYSTERY);
      const mystery = fullDraft?.payload?.mystery;
      if (mystery) {
        if (mystery.spec) session.config = mystery.spec;
        if (mystery.roleMatrix) session.rolesMeta = mystery.roleMatrix;
        if (mystery.proposal) session.proposal = mystery.proposal;
        if (fullDraft.payload.form && !existingDraft?.payload?.form) restoreAiFormFields(migrateAiFormFields(fullDraft.payload.form));
      }
    }
  }

  async function openDeepseekPipeline(options = {}) {
    try {
      if (!zhimuApi.context?.worldId) {
        showToast("请先选择一个世界后再打开 AI 剧本创作");
        return;
      }
      const [status, manuscript] = await Promise.all([zhimuApi.getDeepseekStatus(), zhimuApi.getStoryManuscript()]);
      const draftKind = AiDraft()?.KIND?.PIPELINE;
      const existingDraft = loadLocalAiDraft(draftKind);
      const session = normalizePipelineSession(existingDraft?.payload?.session);
      let draftSavedAt = existingDraft?.savedAt || null;
      let pipelineMode = "interactive";
      const ctx = {
        roleKey: session.rolesMeta?.roles?.[0]?.key || "",
        chapterKey: session.config?.chapterKeys?.[0] || session.proposal?.chapters?.[0]?.key || "",
        narrativeChapterKey: session.config?.chapterKeys?.[0] || ""
      };
      if (options.focusLayer) {
        const focus = options.focusLayer === "spec" ? "setup" : options.focusLayer === "structure" ? "sync" : options.focusLayer;
        if (PIPELINE_LAYER_ORDER.includes(focus)) session.activeLayer = focus;
      }
      migrateLegacyDrafts(session, existingDraft, restoreAiFormFields);

      modal.className = "modal deepseek-modal pipeline-modal pipeline-wizard-modal";
      modal.dataset.referenceManuscript = manuscript.body || "";
      modal.innerHTML = pipelineWizardFrameHtml(status, session, pipelineMode);
      modalBackdrop.classList.add("show");
      modal.querySelectorAll("[data-close]").forEach((btn) => { btn.onclick = () => { flushDraftSave(); uiAbort.abort(); closeModal(); }; });
      if (existingDraft?.payload?.form) restoreAiFormFields(migrateAiFormFields(existingDraft.payload.form));

      const ladder = modal.querySelector("[data-pipeline-ladder]");
      const layerHead = modal.querySelector("[data-pipeline-layer-head]");
      const layerEditor = modal.querySelector("[data-pipeline-layer-editor]");
      const layerActions = modal.querySelector("[data-pipeline-layer-actions]");
      const summaryEl = modal.querySelector("[data-pipeline-summary]");
      const importStructure = modal.querySelector("[data-pipeline-import-structure]");
      const importAll = modal.querySelector("[data-pipeline-import-all]");
      const applyHints = modal.querySelector("[data-pipeline-apply-hints]");
      const autoPanel = null;
      const autoProgress = null;
      const autoRunBtn = null;

      const ensureCreative = () => {
        if (session.setting && session.synopsis && session.config) {
          return { setting: session.setting, synopsis: session.synopsis, config: session.config };
        }
        const creative = pipelineReadSetupFromDom();
        session.setting = creative.setting;
        session.synopsis = creative.synopsis;
        session.config = creative.config;
        return creative;
      };

      const omitNullishFields = (obj) =>
        Object.fromEntries(Object.entries(obj).filter(([, value]) => value != null));

      const pipelinePayload = () => {
        const creative = ensureCreative();
        const sampleSection = Object.entries(session.sections || {}).flatMap(([roleKey, chapters]) =>
          Object.entries(chapters || {}).map(([chapterKey, section]) => ({ ...section, roleKey, chapterKey }))
        )[0];
        return omitNullishFields({
          ...creative,
          narrativeChapters: narrativeChaptersArray(),
          proposal: session.proposal,
          rolesMeta: session.rolesMeta,
          roleMatrix: session.rolesMeta,
          sections: session.sections,
          sampleSection
        });
      };

      const narrativeChaptersArray = () => (session.config?.chapterKeys || []).map((key) => session.narrativeChapters?.[key]).filter(Boolean);
      const stubProposal = () => pipelineStubProposal(session, session.setting?.theme || session.config?.title);

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
        const sectionCtx = session.activeLayer === "roles" ? `${ctx.roleKey}|${ctx.chapterKey}` : "";
        const narrativeCtx = session.activeLayer === "narrative" ? ctx.narrativeChapterKey : "";
        return `${session.activeLayer}:${rev}:${sectionCtx}:${narrativeCtx}`;
      };
      const bumpEditorRevision = (layer) => {
        session._editorRev = session._editorRev || {};
        session._editorRev[layer] = (session._editorRev[layer] || 0) + 1;
      };
      const forceEditorRefresh = (layer = session.activeLayer) => {
        lastEditorKey = "";
        bumpEditorRevision(layer);
      };
      const actionsFingerprint = () => {
        const layer = session.activeLayer;
        const hasData = layer === "setup" ? true : pipelineLayerHasData(session, layer);
        const canGenerate = status.configured && layer !== "setup" && pipelineDepsLocked(session, layer);
        const canEvaluate = status.configured && layer === "evaluate" && pipelineDepsLocked(session, "evaluate");
        return `${layer}:${hasData}:${canGenerate}:${canEvaluate}:${Boolean(session.proposal)}:${Boolean(session.evaluation?.revisions?.length)}:${Boolean(session.rolesMeta?.roles?.length)}`;
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
        if (stepEl) stepEl.textContent = pipelineStepName(session.activeLayer);
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
            forceEditorRefresh(session.activeLayer);
            renderPipelineUi({ editor: true });
            return;
          }
          const pickNarrativeBtn = event.target.closest("[data-pipeline-pick-narrative]");
          if (pickNarrativeBtn) {
            pipelinePersistActiveEditor(session, ctx);
            ctx.narrativeChapterKey = pickNarrativeBtn.dataset.pipelinePickNarrative;
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
          if (event.target.closest("[data-pipeline-download-narrative]")) {
            const keys = session.config?.chapterKeys || [];
            const lines = keys.map((key) => {
              const ch = session.narrativeChapters?.[key];
              if (!ch?.narrativeBody) return "";
              return `# ${ch.title || key}\n\n${ch.summary ? `> ${ch.summary}\n\n` : ""}${ch.narrativeBody}`;
            }).filter(Boolean);
            if (!lines.length) return showToast("尚无总剧情可下载");
            const blob = new Blob([lines.join("\n\n---\n\n")], { type: "text/markdown;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${session.setting?.theme || "总剧情"}.md`;
            a.click();
            URL.revokeObjectURL(url);
            return;
          }
          if (event.target.closest("[data-pipeline-generate-all-roles]")) runPipelineGenerateAllRoleScripts();
          else if (event.target.closest("[data-pipeline-generate-all]")) runPipelineGenerateAllNarrative();
          else if (event.target.closest("[data-pipeline-generate]")) runPipelineGenerate();
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
            if (next) {
              session.activeLayer = next;
              forceEditorRefresh(next);
            }
            afterSessionChange({ saveNow: true, editor: true });
            showToast({
              setup: "创作立项已确认，请生成逐章总剧情",
              narrative: "全部章节已确认",
              roles: "全部角色私人本已确认",
              evaluate: "评判结果已确认，请进入汇总同步",
              sync: "编排结构已确认"
            }[layer] || "本层已锁定，可生成下一层");
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
          } else if (event.target.matches("[data-pipeline-narrative-chapter]")) {
            pipelinePersistActiveEditor(session, ctx);
            ctx.narrativeChapterKey = event.target.value;
            renderPipelineUi();
          }
        }, { signal });
      };

      const renderLayerActions = () => {
        if (pipelineGenerating) return;
        const fp = actionsFingerprint();
        if (fp === lastActionsFp && layerActions.children.length) return;
        lastActionsFp = fp;
        const layer = session.activeLayer;
        const hasData = layer === "setup" ? true : pipelineLayerHasData(session, layer);
        const canGenerate = status.configured && layer !== "setup" && pipelineDepsLocked(session, layer);
        const rolesMetaReady = Boolean(session.rolesMeta?.roles?.length);
        let generateLabel = hasData ? "重新 AI 生成" : "AI 生成初稿";
        if (layer === "narrative") generateLabel = hasData ? "重新生成本章" : "AI 生成本章";
        else if (layer === "roles" && !rolesMetaReady) generateLabel = "识别角色";
        else if (layer === "roles") generateLabel = hasData ? "重新生成本章私人本" : "AI 生成本章私人本";
        else if (layer === "sync") generateLabel = hasData ? "重新抽取结构" : "AI 抽取编排结构";
        const generateBtn = layer !== "evaluate" && layer !== "setup"
          ? `<button class="secondary-btn" type="button" data-pipeline-generate ${canGenerate ? "" : "disabled"}>${generateLabel}</button>`
          : layer === "evaluate"
            ? `<button class="secondary-btn" type="button" data-pipeline-generate ${status.configured && pipelineDepsLocked(session, "evaluate") ? "" : "disabled"}>${session.evaluation ? "重新 AI 评判" : "AI 评判"}（约 1～3 分钟）</button>`
            : "";
        const chapterKeys = session.config?.chapterKeys || [];
        const narrativeDone = chapterKeys.filter((key) => (session.narrativeChapters?.[key]?.narrativeBody || "").length > 0).length;
        const generateAllBtn = layer === "narrative" && canGenerate && narrativeDone < chapterKeys.length
          ? `<button class="text-btn" type="button" data-pipeline-generate-all>逐章生成全部（${narrativeDone}/${chapterKeys.length}，每章约 1～2 分钟）</button>`
          : "";
        const roleScriptProgress = layer === "roles" && rolesMetaReady ? PS().countRoleScriptSections?.(session) : null;
        const generateAllRolesBtn = layer === "roles" && canGenerate && rolesMetaReady && roleScriptProgress && roleScriptProgress.done < roleScriptProgress.total
          ? `<button class="text-btn" type="button" data-pipeline-generate-all-roles>批量生成全部私人本（${roleScriptProgress.done}/${roleScriptProgress.total}，每段约 30～90 秒）</button>`
          : "";
        const saveBtn = hasData && layer !== "evaluate" ? `<button class="text-btn" type="button" data-pipeline-save>保存修改</button>` : "";
        const lockLabel = {
          setup: "确认并继续",
          narrative: "确认全部章节",
          roles: "确认全部私人本",
          evaluate: "确认评判结果并继续",
          sync: "确认本层并继续"
        }[layer] || "确认本层并继续";
        const lockBtn = hasData ? `<button class="primary-btn" type="button" data-pipeline-lock>${lockLabel}</button>` : "";
        layerActions.innerHTML = `${generateBtn}${generateAllBtn}${generateAllRolesBtn}${saveBtn}${lockBtn}`;
      };

      const patchNarrativeEditor = () => {
        const chapterSelect = layerEditor.querySelector("[data-pipeline-narrative-chapter]");
        if (!chapterSelect) return false;
        chapterSelect.value = ctx.narrativeChapterKey;
        const chapter = session.narrativeChapters?.[ctx.narrativeChapterKey];
        const titleEl = layerEditor.querySelector('[data-studio-field="pipeNarrativeTitle"]');
        const summaryEl = layerEditor.querySelector('[data-studio-field="pipeNarrativeSummary"]');
        const bodyEl = layerEditor.querySelector("[data-pipe-narrative-body]");
        const hostEl = layerEditor.querySelector('[data-studio-field="pipeNarrativeHost"]');
        if (titleEl) titleEl.value = chapter?.title || "";
        if (summaryEl) summaryEl.value = chapter?.summary || "";
        if (bodyEl) bodyEl.value = chapter?.narrativeBody || "";
        if (hostEl) hostEl.value = chapter?.hostNotes || "";
        const listHost = layerEditor.querySelector("[data-pipeline-narrative-list-host]");
        if (listHost) listHost.innerHTML = PH().pipelineNarrativeListHtml?.(session) || "";
        return true;
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
            const canPatchNarrative = session.activeLayer === "narrative" && prevLayer === "narrative" && patchNarrativeEditor();
            const canPatchSection = !canPatchNarrative && session.activeLayer === "section" && prevLayer === "section" && patchSectionEditor();
            if (!canPatchNarrative && !canPatchSection) {
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
        if (opts.editor !== false) pendingRender.editor = true;
        if (renderFrame) return;
        renderFrame = requestAnimationFrame(() => {
          renderFrame = null;
          const editor = pendingRender.editor;
          pendingRender = { editor: true };
          doRenderPipelineUi({ editor });
        });
      }

      let pipelineProgressBtn = null;
      let pipelineGenerating = false;
      const disableLayerActions = () => {
        layerActions.querySelectorAll("button").forEach((el) => { el.disabled = true; });
      };

      const setAutoProgress = (label) => {
        if (pipelineProgressBtn) setPipelineProgress(pipelineProgressBtn, label);
      };

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const isRetryableDeepseekError = (error) => /无法连接|超时|UPSTREAM|API_UNAVAILABLE|RATE_LIMITED|过于频繁|503|502|504/i.test(error?.message || "");
      async function callDeepseekStep(label, fn, { retries = 1 } = {}) {
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            return await fn();
          } catch (error) {
            lastError = error;
            if (attempt < retries && isRetryableDeepseekError(error)) {
              const waitSec = 3 * (attempt + 1);
              setAutoProgress(`${label} 失败，${waitSec} 秒后重试…（${error.message}）`);
              await sleep(waitSec * 1000);
              continue;
            }
            throw error;
          }
        }
        throw lastError;
      }

      let pipelineProgressTimer = null;
      const setPipelineProgress = (btn, label) => {
        clearPipelineProgress();
        if (!btn) return;
        pipelineProgressBtn = btn;
        const start = Date.now();
        pipelineProgressTimer = setInterval(() => {
          const sec = Math.floor((Date.now() - start) / 1000);
          btn.textContent = `${label}（${sec}s）`;
        }, 1000);
        btn.textContent = `${label}（0s）`;
      };
      const clearPipelineProgress = () => {
        if (pipelineProgressTimer) clearInterval(pipelineProgressTimer);
        pipelineProgressTimer = null;
        pipelineProgressBtn = null;
      };

      async function generateNarrativeChapter(chapterKey, creative, progressBtn, progressLabel) {
        const chapterIndex = (session.config.chapterKeys || []).indexOf(chapterKey);
        const previousChapters = (session.config.chapterKeys || []).slice(0, chapterIndex).map((key) => session.narrativeChapters?.[key]).filter(Boolean);
        if (previousChapters.length !== chapterIndex) {
          throw new Error(`请先生成第 ${chapterIndex} 章总剧情`);
        }
        const chapterNum = chapterIndex + 1;
        const label = progressLabel || `正在生成第 ${chapterNum} 章`;
        setPipelineProgress(progressBtn, label);
        session.narrativeChapters = session.narrativeChapters || {};
        session.narrativeChapters[chapterKey] = (await callDeepseekStep(`② 第 ${chapterNum} 章总剧情`, () =>
          zhimuApi.deepseekPipelineNarrativeChapter({ ...creative, chapterKey, previousChapters })
        )).chapter;
        ctx.narrativeChapterKey = chapterKey;
        forceEditorRefresh("narrative");
        afterSessionChange({ editor: true, saveNow: false });
      }

      async function ensureRolesMeta(creative, progressBtn) {
        if (session.rolesMeta?.roles?.length) return;
        setPipelineProgress(progressBtn, "正在识别角色");
        const metaResult = await callDeepseekStep("③ 识别角色", () =>
          zhimuApi.deepseekPipelineNarrativeRolesMeta({ ...creative, chapters: narrativeChaptersArray() })
        );
        session.rolesMeta = metaResult.rolesMeta;
        session.sections = session.sections || {};
        ctx.roleKey = session.rolesMeta.roles?.[0]?.key || "";
        ctx.chapterKey = session.config?.chapterKeys?.[0] || "";
      }

      async function generateRoleScriptChapter(roleKey, chapterKey, creative, progressBtn, progressLabel) {
        const role = session.rolesMeta?.roles?.find((r) => r.key === roleKey);
        if (!role) throw new Error("请选择有效角色");
        if (PS().isRoleScriptSectionComplete?.(session, roleKey, chapterKey)) return;
        const chapterIndex = (session.config?.chapterKeys || []).indexOf(chapterKey);
        const chapterNum = chapterIndex + 1;
        const label = progressLabel || `正在生成 ${role.name} · 第 ${chapterNum} 章私人本`;
        setPipelineProgress(progressBtn, label);
        session.sections = session.sections || {};
        const revisionHint = modal.querySelector('[data-studio-field="pipeRoleRevisionHint"]')?.value || "";
        const existingSections = Object.entries(session.sections?.[roleKey] || {}).map(([ck, section]) => ({ ...section, roleKey, chapterKey: ck }));
        const scriptResult = await callDeepseekStep(`③ ${role.name} · 第 ${chapterNum} 章`, () =>
          zhimuApi.deepseekPipelineNarrativeRoleScript({
            ...creative,
            roleKey,
            role,
            chapterKey,
            chapters: narrativeChaptersArray(),
            existingSections,
            revisionHint
          })
        );
        session.sections[roleKey] = { ...(session.sections[roleKey] || {}), ...(scriptResult.sections || {}) };
        ctx.roleKey = roleKey;
        ctx.chapterKey = chapterKey;
        forceEditorRefresh("roles");
        afterSessionChange({ editor: true, saveNow: false });
      }

      const runPipelineGenerateAllRoleScripts = async () => {
        if (!session.locks?.narrative) return showToast("请先确认全部章节总剧情");
        const creative = ensureCreative();
        const btn = layerActions.querySelector("[data-pipeline-generate-all-roles]") || layerActions.querySelector("[data-pipeline-generate]");
        pipelineGenerating = true;
        try {
          if (btn) btn.disabled = true;
          disableLayerActions();
          await ensureRolesMeta(creative, btn);
          const roles = session.rolesMeta?.roles || [];
          const keys = session.config?.chapterKeys || [];
          let generated = 0;
          const { total, done: initialDone } = PS().countRoleScriptSections?.(session) || { total: roles.length * keys.length, done: 0 };
          for (const role of roles) {
            for (let i = 0; i < keys.length; i++) {
              const chapterKey = keys[i];
              if (PS().isRoleScriptSectionComplete?.(session, role.key, chapterKey)) continue;
              generated += 1;
              await generateRoleScriptChapter(role.key, chapterKey, creative, btn, `批量生成 ${initialDone + generated}/${total} · ${role.name} 第 ${i + 1} 章`);
            }
          }
          session.locks.roles = false;
          pipelineClearDownstream(session, "roles");
          afterSessionChange({ saveNow: true, editor: true });
          showToast("全部私人本已批量生成 · 请修改后确认");
        } catch (error) { showError(error); }
        finally {
          pipelineGenerating = false;
          clearPipelineProgress();
          renderPipelineUi({ editor: true });
        }
      };

      const runPipelineGenerateAllNarrative = async () => {
        if (!session.locks?.setup) return showToast("请先确认创作立项");
        const keys = session.config?.chapterKeys || [];
        if (!keys.length) return showToast("请先设置章节");
        const creative = ensureCreative();
        const btn = layerActions.querySelector("[data-pipeline-generate-all]") || layerActions.querySelector("[data-pipeline-generate]");
        pipelineGenerating = true;
        try {
          if (btn) btn.disabled = true;
          disableLayerActions();
          for (let i = 0; i < keys.length; i++) {
            const chapterKey = keys[i];
            const body = session.narrativeChapters?.[chapterKey]?.narrativeBody || "";
            const min = PS().narrativeMinChars?.(session) || 2000;
            if (body.length >= min) continue;
            await generateNarrativeChapter(chapterKey, creative, btn, `逐章生成 ${i + 1}/${keys.length}`);
          }
          session.locks.narrative = false;
          pipelineClearDownstream(session, "narrative");
          afterSessionChange({ saveNow: true, editor: true });
          showToast("全部章节已逐章生成 · 请修改后确认");
        } catch (error) { showError(error); }
        finally {
          pipelineGenerating = false;
          clearPipelineProgress();
          renderPipelineUi({ editor: true });
        }
      };

      const runPipelineGenerate = async () => {
        const layer = session.activeLayer;
        const btn = layerActions.querySelector("[data-pipeline-generate]");
        const creative = ensureCreative();
        pipelineGenerating = true;
        try {
          if (btn) btn.disabled = true;
          disableLayerActions();
          if (layer === "setup") return showToast("创作立项请手动填写并确认，本层不用 AI");
          if (layer === "narrative") {
            if (!session.locks?.setup) return showToast("请先确认创作立项");
            const chapterKey = modal.querySelector("[data-pipeline-narrative-chapter]")?.value || ctx.narrativeChapterKey || session.config?.chapterKeys?.[0];
            if (!chapterKey) return showToast("请先设置章节");
            const chapterIndex = (session.config.chapterKeys || []).indexOf(chapterKey);
            await generateNarrativeChapter(chapterKey, creative, btn, `正在生成第 ${chapterIndex + 1} 章`);
          } else if (layer === "roles") {
            if (!session.locks?.narrative) return showToast("请先确认全部章节总剧情");
            if (!session.rolesMeta?.roles?.length) {
              if (btn) setPipelineProgress(btn, "正在识别角色");
              await ensureRolesMeta(creative, btn);
              forceEditorRefresh("roles");
              afterSessionChange({ saveNow: true, editor: true });
              showToast("角色已识别 · 请选择角色与章节后生成本章私人本");
              return;
            }
            const roleKey = modal.querySelector("[data-pipeline-role]")?.value || ctx.roleKey || session.rolesMeta.roles[0]?.key;
            const role = session.rolesMeta.roles.find((r) => r.key === roleKey);
            if (!role) return showToast("请选择角色");
            const chapterKey = modal.querySelector("[data-pipeline-chapter]")?.value || ctx.chapterKey || session.config?.chapterKeys?.[0];
            if (!chapterKey) return showToast("请先设置章节");
            await generateRoleScriptChapter(roleKey, chapterKey, creative, btn);
          } else if (layer === "sync") {
            if (!session.locks?.roles) return showToast("请先确认全部角色私人本");
            setPipelineProgress(btn, "正在抽取编排结构");
            session.proposal = (await callDeepseekStep("⑤ 抽取编排结构", () =>
              zhimuApi.deepseekPipelineNarrativeExtractStructure({
                ...creative,
                chapters: narrativeChaptersArray(),
                sectionsSample: Object.entries(session.sections).flatMap(([roleKey, chapters]) =>
                  Object.entries(chapters || {}).slice(0, 1).map(([chapterKey, section]) => ({ ...section, roleKey, chapterKey }))
                ).slice(0, 4)
              })
            )).proposal;
          } else if (layer === "evaluate") {
            if (!session.locks?.roles) return showToast("请先确认角色私人本");
            setPipelineProgress(btn, "AI 评判中");
            session.evaluation = (await callDeepseekStep("④ AI 评判", () => zhimuApi.deepseekPipelineEvaluate(pipelinePayload()))).evaluation;
          }
          session.locks[layer] = false;
          if (layer !== "evaluate") pipelineClearDownstream(session, layer);
          forceEditorRefresh(layer);
          afterSessionChange({ saveNow: true, editor: true });
          showToast(`${pipelineStepLabel(layer)} 已生成 · 请修改后确认`);
        } catch (error) { showError(error); }
        finally {
          pipelineGenerating = false;
          clearPipelineProgress();
          renderPipelineUi({ editor: true });
        }
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
        const field = modal.querySelector('[data-studio-field="aiConflicts"]');
        if (!field || !session.evaluation) return;
        const hints = (session.evaluation.revisions || []).filter((rev) => rev.promptHint).map((rev) => rev.promptHint);
        if (!hints.length) return showToast("无可应用的提示语");
        field.value = [field.value.trim(), ...hints].filter(Boolean).join("\n");
        scheduleDraftSave();
        showToast(`已追加 ${hints.length} 条提示到「额外的矛盾冲突」`);
      };
      importStructure.onclick = async () => {
        if (!session.proposal) return;
        try {
          importStructure.disabled = true;
          importStructure.textContent = "上传编排中…";
          pipelinePersistActiveEditor(session, ctx);
          const result = await zhimuApi.importDeepseekProposal(session.proposal);
          session.structureImported = true;
          showToast(`编排已上传：${result.chapters} 章 · ${result.scenes} 场景`);
          await loadCloudData();
          if (!session.rolesMeta && !Object.keys(session.sections).length) {
            clearLocalAiDraft(draftKind); closeModal(); go("studio");
          } else importStructure.disabled = false;
        } catch (error) { importStructure.disabled = false; showError(error); }
        finally { importStructure.textContent = "仅上传编排"; }
      };
      importAll.onclick = async () => {
        if (!session.proposal) return;
        try {
          importAll.disabled = true;
          importAll.textContent = "上传中…";
          pipelinePersistActiveEditor(session, ctx);
          const result = await zhimuApi.importDeepseekPipeline({ proposal: session.proposal, roleMatrix: session.rolesMeta, sections: session.sections });
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
        } catch (error) { importAll.disabled = false; showError(error); }
        finally { importAll.textContent = "上传全部到云端"; }
      };

      if (existingDraft) showToast("已恢复本机 AI 剧本草稿");
      else if (options.focusLayer === "structure" || options.focusLayer === "sync") showToast("已打开 · 当前步骤：汇总同步");
      renderPipelineUi();
    } catch (error) { showError(error); }
  }


  window.zhimuPipelineOpen = { openDeepseekPipeline };
})(window);
export {};
