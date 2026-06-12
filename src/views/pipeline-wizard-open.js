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
  const closeModal = M.closeModal || (() => {});
  const studioValues = M.studioValues || (() => ({}));
  const go = window.zhimuGo;
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }

  const AiDraft = () => window.zhimuAiDraft;
  const PS = () => window.zhimuPipelineSession || {};
  const PIPELINE_LAYER_ORDER = PS().PIPELINE_LAYER_ORDER || ["spec", "outline", "structure", "matrix", "section", "synopsis", "evaluate"];
  const defaultPipelineSession = (...args) => PS().defaultPipelineSession?.(...args) ?? { spec: null, outline: null, narrativeChapters: {}, proposal: null, roleMatrix: null, sections: {}, synopsis: null, evaluation: null, locks: {}, activeLayer: "spec", _editorRev: {} };
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
  const pipelineValidateSpec = (...args) => PB().pipelineValidateSpec?.(...args) ?? false;
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
      aiTitle: v.aiTitle,
      aiPremise: v.aiPremise,
      aiChapterCount: v.aiChapterCount,
      aiWordsPerChapter: v.aiWordsPerChapter,
      aiConflicts: v.aiConflicts
    };
  }
  function migrateAiFormFields(form) {
    if (!form) return form;
    const next = { ...form };
    if (!next.aiWordsPerChapter && next.aiTargetWordCount && next.aiChapterCount) {
      next.aiWordsPerChapter = String(Math.round(Number(next.aiTargetWordCount) / Number(next.aiChapterCount)) || 800);
    }
    if (!next.aiConflicts && next.aiRequirements) next.aiConflicts = next.aiRequirements;
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
        session.locks.structure = false;
        session.activeLayer = "structure";
        if (structureDraft.payload.form && !existingDraft?.payload?.form) restoreAiFormFields(migrateAiFormFields(structureDraft.payload.form));
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
        if (fullDraft.payload.form && !existingDraft?.payload?.form) restoreAiFormFields(migrateAiFormFields(fullDraft.payload.form));
      }
    }
  }

  async function openDeepseekPipeline(options = {}) {
    try {
      if (!zhimuApi.context?.worldId) {
        showToast("请先选择一个世界后再打开 AI 悬疑创作");
        return;
      }
      const [status, manuscript] = await Promise.all([zhimuApi.getDeepseekStatus(), zhimuApi.getStoryManuscript()]);
      const draftKind = AiDraft()?.KIND?.PIPELINE;
      const existingDraft = loadLocalAiDraft(draftKind);
      const session = normalizePipelineSession(existingDraft?.payload?.session);
      let draftSavedAt = existingDraft?.savedAt || null;
      let pipelineMode = options.mode === "auto" ? "auto" : (existingDraft?.payload?.mode || "interactive");
      const ctx = {
        roleKey: session.roleMatrix?.roles?.[0]?.key || "",
        chapterKey: session.spec?.chapterKeys?.[0] || session.proposal?.chapters?.[0]?.key || "",
        narrativeChapterKey: session.spec?.chapterKeys?.[0] || ""
      };
      if (options.focusLayer && PIPELINE_LAYER_ORDER.includes(options.focusLayer)) session.activeLayer = options.focusLayer;
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
      const autoPanel = modal.querySelector("[data-pipeline-auto-panel]");
      const autoProgress = modal.querySelector("[data-pipeline-auto-progress]");
      const autoRunBtn = modal.querySelector("[data-pipeline-auto-run]");

      const pipelinePayload = () => {
        const brief = pipelineBriefFromForm();
        return {
          ...brief,
          spec: session.spec,
          outline: session.outline,
          narrativeChapters: narrativeChaptersArray(),
          proposal: session.proposal,
          roleMatrix: session.roleMatrix,
          sections: session.sections,
          synopsis: session.synopsis,
          sampleSection: Object.entries(session.sections).flatMap(([roleKey, chapters]) =>
            Object.entries(chapters || {}).map(([chapterKey, section]) => ({ ...section, roleKey, chapterKey }))
          )[0]
        };
      };

      const narrativeChaptersArray = () => (session.spec?.chapterKeys || []).map((key) => session.narrativeChapters?.[key]).filter(Boolean);
      const stubProposal = () => pipelineStubProposal(session, pipelineBriefFromForm().title);

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
            if (next) {
              session.activeLayer = next;
              forceEditorRefresh(next);
            }
            afterSessionChange({ saveNow: true, editor: true });
            showToast(layer === "section" ? "私人分幕已确认" : layer === "narrative" ? "全部章节已确认" : layer === "spec" ? "创作设定已确认，请生成总纲" : "本层已锁定，可生成下一层");
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
        const lockBtn = interactiveActions && hasData && layer !== "evaluate" ? `<button class="primary-btn" type="button" data-pipeline-lock>${layer === "section" ? "确认全部分幕" : layer === "narrative" ? "确认全部章节" : layer === "spec" ? "确认并继续" : "确认本层并继续"}</button>` : "";
        layerActions.innerHTML = interactiveActions ? `${generateBtn}${saveBtn}${lockBtn}` : `<p class="muted-note">一键模式下请用上方「开始一键串行生成」；生成后可在左侧选层编辑。</p>`;
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

      const setAutoProgress = (text) => { if (autoProgress) autoProgress.textContent = text; };

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

      const runAutoPipeline = async () => {
        if (!status.configured) return showToast("DeepSeek 未配置");
        pipelinePersistActiveEditor(session, ctx);
        const spec = pipelineReadSpecFromDom();
        if (!pipelineValidateSpec(spec)) return showToast("请先在① 创作设定填写并确认");
        session.spec = spec;
        if (!session.locks?.spec) return showToast("请先在① 创作设定点「确认并继续」后再一键串行");
        const brief = pipelineBriefFromForm();
        try {
          autoRunBtn.disabled = true;

          setAutoProgress("② 生成总纲…");
          session.activeLayer = "outline";
          session.outline = (await callDeepseekStep("② 总纲", () => zhimuApi.deepseekPipelineOutline({ ...brief, spec: session.spec }))).outline;
          session.locks.outline = true;
          forceEditorRefresh("outline");
          afterSessionChange({ editor: true, saveNow: false });

          session.narrativeChapters = session.narrativeChapters || {};
          const chapterKeys = session.spec.chapterKeys || [];
          session.activeLayer = "narrative";
          for (let i = 0; i < chapterKeys.length; i++) {
            const chapterKey = chapterKeys[i];
            const previousChapters = chapterKeys.slice(0, i).map((key) => session.narrativeChapters[key]);
            setAutoProgress(`③ 章节总剧情 ${i + 1}/${chapterKeys.length}：${chapterKey}…`);
            session.narrativeChapters[chapterKey] = (await callDeepseekStep(`③ 总剧情 ${i + 1}/${chapterKeys.length}`, () =>
              zhimuApi.deepseekPipelineNarrativeChapter({ ...brief, spec: session.spec, chapterKey, previousChapters })
            )).chapter;
            ctx.narrativeChapterKey = chapterKey;
            forceEditorRefresh("narrative");
            afterSessionChange({ editor: true, saveNow: false });
            if (i < chapterKeys.length - 1) await sleep(400);
          }
          session.locks.narrative = true;

          const proposalDraft = stubProposal();
          setAutoProgress("④ 生成角色矩阵…");
          session.activeLayer = "matrix";
          session.roleMatrix = (await callDeepseekStep("④ 角色矩阵", () => zhimuApi.deepseekPipelineRoleMatrix({ ...brief, spec: session.spec, outline: session.outline, proposal: proposalDraft }))).roleMatrix;
          session.locks.matrix = true;
          ctx.roleKey = session.roleMatrix.roles?.[0]?.key || "";
          forceEditorRefresh("matrix");
          afterSessionChange({ editor: true, saveNow: false });

          setAutoProgress("⑤ 从总剧情拆分私人分幕…");
          session.activeLayer = "section";
          const rolesResult = await callDeepseekStep("⑤ 私人分幕", () =>
            zhimuApi.deepseekPipelineNarrativeRoles({
              ...brief,
              spec: session.spec,
              roleMatrix: session.roleMatrix,
              chapters: narrativeChaptersArray(),
              proposal: proposalDraft
            })
          );
          session.sections = rolesResult.sections || {};
          session.locks.section = true;
          ctx.roleKey = session.roleMatrix.roles?.[0]?.key || "";
          ctx.chapterKey = chapterKeys[0] || "";
          forceEditorRefresh("section");
          afterSessionChange({ editor: true, saveNow: false });

          setAutoProgress("⑥ 从剧情反推场景/线索…");
          session.activeLayer = "structure";
          session.proposal = (await callDeepseekStep("⑥ 编排结构", () =>
            zhimuApi.deepseekPipelineNarrativeExtractStructure({
              ...brief,
              spec: session.spec,
              chapters: narrativeChaptersArray(),
              sectionsSample: Object.entries(session.sections).flatMap(([roleKey, chapters]) =>
                Object.entries(chapters || {}).slice(0, 1).map(([chapterKey, section]) => ({ ...section, roleKey, chapterKey }))
              ).slice(0, 4)
            })
          )).proposal;
          session.locks.structure = true;
          forceEditorRefresh("structure");
          afterSessionChange({ editor: true, saveNow: false });

          setAutoProgress("⑦ 生成短母稿…");
          session.activeLayer = "synopsis";
          session.synopsis = (await callDeepseekStep("⑦ 短母稿", () =>
            zhimuApi.deepseekPipelineManuscriptSynopsis({ ...brief, spec: session.spec, outline: session.outline, proposal: session.proposal, roleMatrix: session.roleMatrix })
          )).synopsis;
          session.locks.synopsis = true;
          forceEditorRefresh("synopsis");
          afterSessionChange({ editor: true, saveNow: true });

          clearLocalAiDraft(AiDraft()?.KIND?.FULL_MYSTERY);
          clearLocalAiDraft(AiDraft()?.KIND?.STRUCTURE);
          const sectionCount = Object.values(session.sections).reduce((n, chapters) => n + Object.keys(chapters || {}).length, 0);
          setAutoProgress(`完成 · 共 ${2 + chapterKeys.length + 4} 次 API（${chapterKeys.length} 章逐章 + 分幕 + 反推编排 + 母稿）。请在左侧逐层检查，满意后点「上传全部到云端」。`);
          showToast("一键串行生成完成 · 请复核后上传");
        } catch (error) {
          setAutoProgress(`中断：${error.message}`);
          showToast(error.message);
          forceEditorRefresh();
          renderPipelineUi({ editor: true });
        } finally {
          autoRunBtn.disabled = !status.configured;
          renderPipelineUi({ editor: true });
        }
      };

      autoRunBtn.onclick = runAutoPipeline;

      modal.querySelectorAll("[data-pipeline-mode]").forEach((tab) => {
        tab.onclick = () => {
          pipelineMode = tab.dataset.pipelineMode;
          autoPanel?.classList.toggle("hidden", pipelineMode !== "auto");
          modal.querySelector(".pipeline-wizard-main")?.classList.toggle("pipeline-auto-layout", pipelineMode === "auto");
          modal.querySelectorAll(".pipeline-mode-tab").forEach((el) => el.classList.toggle("active", el.dataset.pipelineMode === pipelineMode));
          afterSessionChange({ editor: true });
        };
      });

      const runPipelineGenerate = async () => {
        const layer = session.activeLayer;
        const btn = layerActions.querySelector("[data-pipeline-generate]");
        const brief = () => pipelineBriefFromForm();
        try {
          if (btn) { btn.disabled = true; btn.textContent = "请求中…"; }
          if (layer === "spec") return showToast("创作设定请手动填写并确认，本层不用 AI");
          else if (layer === "outline") {
            if (!session.locks?.spec) return showToast("请先生成并确认规格");
            session.outline = (await callDeepseekStep("② 总纲", () => zhimuApi.deepseekPipelineOutline({ ...brief(), spec: session.spec }))).outline;
          } else if (layer === "narrative") {
            if (!session.locks?.spec || !session.locks?.outline) return showToast("请先确认规格与总纲");
            const chapterKey = modal.querySelector("[data-pipeline-narrative-chapter]")?.value || ctx.narrativeChapterKey || session.spec?.chapterKeys?.[0];
            if (!chapterKey) return showToast("请先在规格中设置章节");
            const chapterIndex = (session.spec.chapterKeys || []).indexOf(chapterKey);
            const previousChapters = (session.spec.chapterKeys || []).slice(0, chapterIndex).map((key) => session.narrativeChapters?.[key]).filter(Boolean);
            if (previousChapters.length !== chapterIndex) return showToast(`请先生成第 ${chapterIndex} 章总剧情`);
            session.narrativeChapters = session.narrativeChapters || {};
            session.narrativeChapters[chapterKey] = (await callDeepseekStep("③ 章节总剧情", () =>
              zhimuApi.deepseekPipelineNarrativeChapter({ ...brief(), spec: session.spec, chapterKey, previousChapters })
            )).chapter;
            ctx.narrativeChapterKey = chapterKey;
          } else if (layer === "structure") {
            if (!session.locks?.section) return showToast("请先确认私人分幕");
            session.proposal = (await callDeepseekStep("⑥ 编排结构", () =>
              zhimuApi.deepseekPipelineNarrativeExtractStructure({
                ...brief(),
                spec: session.spec,
                chapters: narrativeChaptersArray(),
                sectionsSample: Object.entries(session.sections).flatMap(([roleKey, chapters]) =>
                  Object.entries(chapters || {}).slice(0, 1).map(([ck, section]) => ({ ...section, roleKey, chapterKey: ck }))
                ).slice(0, 4)
              })
            )).proposal;
          } else if (layer === "matrix") {
            if (!session.locks?.narrative) return showToast("请先确认全部章节总剧情");
            session.roleMatrix = (await callDeepseekStep("④ 角色矩阵", () => zhimuApi.deepseekPipelineRoleMatrix({ ...brief(), spec: session.spec, outline: session.outline, proposal: stubProposal() }))).roleMatrix;
            if (!ctx.roleKey) ctx.roleKey = session.roleMatrix.roles?.[0]?.key || "";
          } else if (layer === "section") {
            if (!session.locks?.matrix) return showToast("请先确认角色矩阵");
            const rolesResult = await callDeepseekStep("⑤ 私人分幕", () =>
              zhimuApi.deepseekPipelineNarrativeRoles({
                ...brief(),
                spec: session.spec,
                roleMatrix: session.roleMatrix,
                chapters: narrativeChaptersArray(),
                proposal: stubProposal()
              })
            );
            session.sections = rolesResult.sections || {};
            ctx.roleKey = session.roleMatrix?.roles?.[0]?.key || ctx.roleKey;
            ctx.chapterKey = session.spec?.chapterKeys?.[0] || ctx.chapterKey;
          } else if (layer === "synopsis") {
            if (!session.locks?.structure) return showToast("请先确认编排结构");
            session.synopsis = (await callDeepseekStep("⑥ 短母稿", () =>
              zhimuApi.deepseekPipelineManuscriptSynopsis({ ...brief(), spec: session.spec, outline: session.outline, proposal: session.proposal, roleMatrix: session.roleMatrix })
            )).synopsis;
          } else if (layer === "evaluate") {
            if (!session.proposal) return showToast("请至少完成编排结构");
            session.evaluation = (await callDeepseekStep("⑧ 评判", () => zhimuApi.deepseekPipelineEvaluate(pipelinePayload()))).evaluation;
          }
          session.locks[layer] = false;
          if (layer !== "evaluate") pipelineClearDownstream(session, layer);
          forceEditorRefresh(layer);
          afterSessionChange({ saveNow: true, editor: true });
          showToast(`${pipelineStepLabel(layer)} 已生成 · 请修改后确认`);
        } catch (error) { showToast(error.message); }
        finally { renderPipelineUi({ editor: true }); }
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


  window.zhimuPipelineOpen = { openDeepseekPipeline };
})(window);
export {};
