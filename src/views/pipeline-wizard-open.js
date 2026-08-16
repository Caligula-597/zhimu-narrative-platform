/** AI pipeline wizard modal controller (open + render loop). */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { modal, modalBackdrop } from "../dom.js";
import { go, loadCloudData } from "../runtime/runtime-facade.js";
import * as F from "../utils/format.js";
import * as M from "../components/modal.js";
import { normalizeError } from "../components/status-ui.js";
import { setHtml } from "../../shared/safe-dom.js";
import { createAdaptivePoller } from "../../shared/adaptive-poller.js";
import {
  diagnosePlayerScript,
  diagnoseScriptCollection,
  fingerprintScriptCollection
} from "../../shared/prose-quality-gate.js";
(function (window) {
  const formatRelativeTime = F.formatRelativeTime || (() => "");
  const formatTime = F.formatTime || (() => "");
  const showError = (error, fallback = "操作失败，请稍后重试") => showToast(normalizeError(error, fallback));
  const closeModal = M.closeModal || (() => {});
  const studioValues = M.studioValues || (() => ({}));

  const AiDraft = () => window.zhimuAiDraft;
  const PS = () => window.zhimuPipelineSession || {};
  const PIPELINE_LAYER_ORDER = PS().PIPELINE_LAYER_ORDER || ["setup", "truth", "characters", "clues", "matrix", "host", "scripts", "evaluate", "sync"];
  const defaultPipelineSession = (...args) => PS().defaultPipelineSession?.(...args) ?? {
    setting: null,
    synopsis: null,
    config: null,
    truthBible: null,
    characterArchives: null,
    clueNetwork: null,
    infoMatrix: null,
    hostRunbooks: null,
    scripts: {},
    evaluation: null,
    proposal: null,
    generationProvenance: { version: "1.0", records: {} },
    staleArtifacts: {},
    pendingRepairPlan: null,
    generationAudit: null,
    locks: {},
    activeLayer: "setup",
    _editorRev: {}
  };
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
      aiPlayStructure: v.aiPlayStructure,
      aiWordsPerChapter: v.aiWordsPerChapter,
      aiConflicts: v.aiConflicts,
      aiTone: v.aiTone,
      aiVolumeTier: v.aiVolumeTier,
      aiPov: v.aiPov,
      aiStyleAnchor: v.aiStyleAnchor,
      aiForbiddenPhrases: v.aiForbiddenPhrases,
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
    if (!next.aiPlayStructure) next.aiPlayStructure = "mystery";
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
        roleKey: session.characterArchives?.roles?.[0]?.key || "",
        chapterKey: session.config?.chapterKeys?.[0] || session.proposal?.chapters?.[0]?.key || ""
      };
      if (options.focusLayer) {
        const focus = options.focusLayer === "spec" ? "setup" : options.focusLayer === "structure" ? "sync" : options.focusLayer;
        if (PIPELINE_LAYER_ORDER.includes(focus)) session.activeLayer = focus;
      }
      migrateLegacyDrafts(session, existingDraft, restoreAiFormFields);

      modal.className = "modal deepseek-modal pipeline-modal pipeline-wizard-modal";
      modal.dataset.referenceManuscript = manuscript.body || "";
      setHtml(modal, pipelineWizardFrameHtml(status, session, pipelineMode));
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
        return omitNullishFields({
          ...creative,
          truthBible: session.truthBible,
          characterArchives: session.characterArchives,
          clueNetwork: session.clueNetwork,
          infoMatrix: session.infoMatrix,
          hostRunbooks: session.hostRunbooks,
          scripts: session.scripts,
          proposal: session.proposal,
          evaluation: session.evaluation,
          generationProvenance: session.generationProvenance,
          scriptGenerationMode: "structured"
        });
      };

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

      let proseScanTimer = null;
      const updateActiveProseDiagnostics = () => {
        const body = layerEditor.querySelector("[data-pipe-section-body]")?.value || "";
        const host = layerEditor.querySelector("[data-prose-quality-host]");
        if (!host) return;
        setHtml(host, PH().proseDiagnosticsPreview?.(diagnosePlayerScript(body)) || "");
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
        const sectionCtx = session.activeLayer === "scripts" ? `${ctx.roleKey}|${ctx.chapterKey}` : "";
        return `${session.activeLayer}:${rev}:${sectionCtx}`;
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
        return `${layer}:${hasData}:${canGenerate}:${canEvaluate}:${Boolean(session.proposal)}:${Boolean(session.evaluation?.revisions?.length)}:${Boolean(session.characterArchives?.roles?.length)}`;
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
        setHtml(ladder, pipelineLadderHtml(session, session.activeLayer));
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
          const pickBtn = event.target.closest("[data-pipeline-pick-section]");
          if (pickBtn) {
            pipelinePersistActiveEditor(session, ctx);
            const [roleKey, chapterKey] = pickBtn.dataset.pipelinePickSection.split("|");
            ctx.roleKey = roleKey;
            ctx.chapterKey = chapterKey;
            forceEditorRefresh("scripts");
            renderPipelineUi();
            return;
          }
          if (event.target.closest("[data-pipeline-generate-all-scripts]")) runPipelineGenerateAllScripts();
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
              setup: "创作立项已确认，请生成真相 Bible",
              truth: "世界与真相合同已确认，请生成角色档案",
              characters: "角色档案已确认，请生成稀疏线索网络",
              clues: "线索网络已确认，请编排公共流程",
              matrix: "公共流程矩阵已确认，请生成主持手册",
              host: "主持手册已确认，请生成逐幕剧本",
              scripts: "全部逐幕剧本已确认，可进行矩阵评判",
              evaluate: "评判结果已确认，请进入机械入库",
              sync: "编排预览已确认，可上传云端"
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
          }
        }, { signal });
        frame.addEventListener("input", (event) => {
          if (!event.target.matches("[data-pipe-section-body]")) return;
          clearTimeout(proseScanTimer);
          proseScanTimer = setTimeout(updateActiveProseDiagnostics, 220);
        }, { signal });
      };

      const renderLayerActions = () => {
        if (pipelineGenerating) return;
        const fp = actionsFingerprint();
        if (fp === lastActionsFp && layerActions.children.length) return;
        lastActionsFp = fp;
        const layer = PS().normalizeLayerName?.(session.activeLayer) || session.activeLayer;
        const hasData = layer === "setup" ? true : pipelineLayerHasData(session, layer);
        const canGenerate = status.configured && layer !== "setup" && pipelineDepsLocked(session, layer);
        const generateLabels = {
          truth: hasData ? "重新生成世界合同" : "AI 生成世界与真相合同",
          characters: hasData ? "重新生成角色档案" : "AI 生成角色档案",
          clues: hasData ? "重新生成线索网络" : "AI 生成稀疏线索网络",
          matrix: hasData ? "重新生成公共流程" : "AI 生成公共流程矩阵",
          host: hasData ? "重新生成主持手册" : "AI 生成全部主持手册",
          scripts: hasData ? "重新生成本格剧本" : "AI 生成本格剧本",
          sync: hasData ? "重新生成编排预览" : "机械生成编排预览"
        };
        const generateLabel = generateLabels[layer] || (hasData ? "重新 AI 生成" : "AI 生成初稿");
        const generateBtn = !["evaluate", "setup"].includes(layer)
          ? `<button class="secondary-btn" type="button" data-pipeline-generate ${canGenerate ? "" : "disabled"}>${generateLabel}</button>`
          : layer === "evaluate"
            ? `<button class="secondary-btn" type="button" data-pipeline-generate ${status.configured && pipelineDepsLocked(session, "evaluate") ? "" : "disabled"}>${session.evaluation ? "重新矩阵评判" : "AI 矩阵评判"}</button>`
            : "";
        const scriptProgress = layer === "scripts" ? PS().countMatrixScripts?.(session) : null;
        const generateAllScriptsBtn = layer === "scripts" && canGenerate && scriptProgress && scriptProgress.done < scriptProgress.total
          ? `<button class="text-btn" type="button" data-pipeline-generate-all-scripts>批量生成全部剧本（${scriptProgress.done}/${scriptProgress.total}）</button>`
          : "";
        const saveBtn = hasData && layer !== "evaluate" ? `<button class="text-btn" type="button" data-pipeline-save>保存修改</button>` : "";
        const lockLabel = {
          setup: "确认并继续",
          truth: "确认世界与真相合同",
          characters: "确认角色档案",
          clues: "确认线索网络",
          matrix: "确认公共流程矩阵",
          host: "确认主持手册",
          scripts: "确认全部剧本",
          evaluate: "确认评判并继续",
          sync: "确认并准备上传"
        }[layer] || "确认本层并继续";
        const lockBtn = hasData ? `<button class="primary-btn" type="button" data-pipeline-lock>${lockLabel}</button>` : "";
        setHtml(layerActions, `${generateBtn}${generateAllScriptsBtn}${saveBtn}${lockBtn}`);
      };

      const patchSectionEditor = () => {
        const roleSelect = layerEditor.querySelector("[data-pipeline-role]");
        const chapterSelect = layerEditor.querySelector("[data-pipeline-chapter]");
        if (!roleSelect || !chapterSelect) return false;
        roleSelect.value = ctx.roleKey;
        chapterSelect.value = ctx.chapterKey;
        const section = session.scripts?.[ctx.roleKey]?.[ctx.chapterKey];
        const titleEl = layerEditor.querySelector('[data-studio-field="pipeSectionTitle"]');
        const bodyEl = layerEditor.querySelector("[data-pipe-section-body]");
        const tasksEl = layerEditor.querySelector('[data-studio-field="pipeScriptTasks"]');
        const hookEl = layerEditor.querySelector('[data-studio-field="pipeScriptHook"]');
        if (titleEl) titleEl.value = section?.title || "";
        if (bodyEl) bodyEl.value = section?.body || "";
        if (tasksEl) tasksEl.value = (section?.tasks || []).join("\n");
        if (hookEl) hookEl.value = section?.closingHook || "";
        const listHost = layerEditor.querySelector("[data-pipeline-section-list-host]");
        if (listHost) setHtml(listHost, PH().pipelineSectionListHtml?.(session) || "");
        updateActiveProseDiagnostics();
        return true;
      };

      const doRenderPipelineUi = ({ editor = true } = {}) => {
        updateLocationBar();
        renderLadder();
        const headFp = `${session.activeLayer}:${pipelineLayerStatus(session, session.activeLayer)}`;
        if (headFp !== lastHeadFp) {
          lastHeadFp = headFp;
          setHtml(layerHead, pipelineLayerHeadHtml(session.activeLayer, session));
        }
        if (editor) {
          const editorKey = editorRenderKey();
          if (editorKey !== lastEditorKey) {
            const prevLayer = lastEditorKey.split(":")[0];
            const canPatchSection = session.activeLayer === "scripts" && prevLayer === "scripts" && patchSectionEditor();
            if (!canPatchSection) {
              setHtml(layerEditor, pipelineLayerEditorHtml(session.activeLayer, session, ctx));
            }
            lastEditorKey = editorKey;
          }
        }
        setHtml(summaryEl, (draftSavedAt ? aiLocalDraftNote(draftSavedAt) : "") + pipelinePreviewHtml(session));
        importStructure.disabled = !session.proposal;
        const proseReady = diagnoseScriptCollection(session.scripts, { expectedPov: session.setting?.pov }).passed;
        const evaluationCurrent = session.evaluation?.scriptFingerprint === fingerprintScriptCollection(session.scripts);
        importAll.disabled = !session.proposal || !session.locks?.sync || !session.evaluation?.readyForSync || !proseReady || !evaluationCurrent;
        applyHints.disabled = !session.evaluation?.repairPlan?.earliestStage && !(session.evaluation?.revisions || []).length;
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

      let pipelineProgressPoller = null;
      const setPipelineProgress = (btn, label) => {
        clearPipelineProgress();
        if (!btn) return;
        pipelineProgressBtn = btn;
        const start = Date.now();
        let progressPoller = null;
        progressPoller = createAdaptivePoller({
          run: () => {
            if (btn.isConnected === false) {
              progressPoller?.stop();
              return;
            }
            const sec = Math.floor((Date.now() - start) / 1000);
            btn.textContent = `${label}（${sec}s）`;
          },
          intervalMs: 1000,
          maxIntervalMs: 1000,
          jitterRatio: 0
        });
        pipelineProgressPoller = progressPoller;
        pipelineProgressPoller.start();
      };
      const clearPipelineProgress = () => {
        pipelineProgressPoller?.stop();
        pipelineProgressPoller = null;
        pipelineProgressBtn = null;
      };

      async function generateMatrixPlayerScript(roleKey, actKey, payload, progressBtn, progressLabel) {
        if (PS().isMatrixScriptComplete?.(session, roleKey, actKey)) return;
        const role = session.characterArchives?.roles?.find((r) => r.key === roleKey);
        const label = progressLabel || `生成 ${role?.name || roleKey} · ${actKey}`;
        setPipelineProgress(progressBtn, label);
        const result = await callDeepseekStep(label, () =>
          zhimuApi.deepseekPipelineMatrixPlayerScript({ ...payload, roleKey, actKey })
        );
        session.scripts[roleKey] = { ...(session.scripts[roleKey] || {}), [actKey]: result.script };
        PS().recordPipelineGeneration?.(session, `scripts.cells.${roleKey}.${actKey}`, result);
        ctx.roleKey = roleKey;
        ctx.chapterKey = actKey;
        forceEditorRefresh("scripts");
        afterSessionChange({ editor: true, saveNow: false });
      }

      const runPipelineGenerateAllScripts = async () => {
        if (!session.locks?.matrix || !session.locks?.host) return showToast("请先确认公共流程矩阵与主持手册");
        const payload = pipelinePayload();
        const btn = layerActions.querySelector("[data-pipeline-generate-all-scripts]") || layerActions.querySelector("[data-pipeline-generate]");
        pipelineGenerating = true;
        try {
          if (btn) btn.disabled = true;
          disableLayerActions();
          const roles = session.characterArchives?.roles || [];
          const keys = session.config?.chapterKeys || [];
          let generated = 0;
          const { total, done: initialDone } = PS().countMatrixScripts?.(session) || { total: roles.length * keys.length, done: 0 };
          for (const role of roles) {
            for (const actKey of keys) {
              if (PS().isMatrixScriptComplete?.(session, role.key, actKey)) continue;
              generated += 1;
              await generateMatrixPlayerScript(role.key, actKey, payload, btn, `批量 ${initialDone + generated}/${total}`);
            }
          }
          session.locks.scripts = false;
          pipelineClearDownstream(session, "scripts");
          afterSessionChange({ saveNow: true, editor: true });
          showToast("全部逐幕剧本已生成 · 请修改后确认");
        } catch (error) { showError(error); }
        finally {
          pipelineGenerating = false;
          clearPipelineProgress();
          renderPipelineUi({ editor: true });
        }
      };

      const runPipelineGenerate = async () => {
        const layer = PS().normalizeLayerName?.(session.activeLayer) || session.activeLayer;
        const btn = layerActions.querySelector("[data-pipeline-generate]");
        const payload = pipelinePayload();
        pipelineGenerating = true;
        try {
          if (btn) btn.disabled = true;
          disableLayerActions();
          if (layer === "setup") return showToast("创作立项请手动填写并确认");
          if (layer === "truth") {
            setPipelineProgress(btn, "生成世界与真相合同");
            const generated = await callDeepseekStep("② 世界与真相合同", () => zhimuApi.deepseekPipelineMatrixTruth(payload));
            session.truthBible = generated.truthBible;
            PS().recordPipelineGeneration?.(session, "truth", generated);
          } else if (layer === "characters") {
            setPipelineProgress(btn, "生成角色档案");
            const generated = await callDeepseekStep("③ 角色档案", () =>
              zhimuApi.deepseekPipelineMatrixCharacters({ ...payload, truthBible: session.truthBible })
            );
            session.characterArchives = generated.characterArchives;
            PS().recordPipelineGeneration?.(session, "characters", generated);
          } else if (layer === "clues") {
            setPipelineProgress(btn, "生成稀疏线索网络");
            const generated = await callDeepseekStep("④ 稀疏线索网络", () =>
              zhimuApi.deepseekPipelineMatrixClueNetwork({
                ...payload,
                truthBible: session.truthBible,
                characterArchives: session.characterArchives
              })
            );
            session.clueNetwork = generated.clueNetwork;
            PS().recordPipelineGeneration?.(session, "clues", generated);
          } else if (layer === "matrix") {
            setPipelineProgress(btn, "生成公共流程矩阵");
            const generated = await callDeepseekStep("⑤ 公共流程矩阵", () =>
              zhimuApi.deepseekPipelineMatrixInfoMatrix({
                ...payload,
                truthBible: session.truthBible,
                characterArchives: session.characterArchives,
                clueNetwork: session.clueNetwork
              })
            );
            session.infoMatrix = generated.infoMatrix;
            PS().recordPipelineGeneration?.(session, "matrix", generated);
          } else if (layer === "host") {
            setPipelineProgress(btn, "生成主持手册");
            const hostResult = await callDeepseekStep("⑥ 主持手册", () =>
              zhimuApi.deepseekPipelineMatrixHostRunbook({ ...payload, allActs: true })
            );
            session.hostRunbooks = hostResult.runbooks;
            PS().recordPipelineGeneration?.(session, "host", hostResult);
          } else if (layer === "scripts") {
            const roleKey = modal.querySelector("[data-pipeline-role]")?.value || ctx.roleKey || session.characterArchives?.roles?.[0]?.key;
            const actKey = modal.querySelector("[data-pipeline-chapter]")?.value || ctx.chapterKey || session.config?.chapterKeys?.[0];
            if (!roleKey || !actKey) return showToast("请选择角色与幕");
            await generateMatrixPlayerScript(roleKey, actKey, payload, btn);
          } else if (layer === "sync") {
            setPipelineProgress(btn, "机械生成编排");
            const pkg = await callDeepseekStep("⑨ 机械入库预览", () => zhimuApi.deepseekPipelineMatrixSyncPreview(payload));
            session.proposal = pkg.proposal;
            session.generationAudit = pkg.generationAudit || null;
            PS().recordPipelineGeneration?.(session, "proposal", pkg);
          } else if (layer === "evaluate") {
            setPipelineProgress(btn, "矩阵评判中");
            const generated = await callDeepseekStep("⑧ 矩阵评判", () => zhimuApi.deepseekPipelineMatrixEvaluate(payload));
            session.evaluation = generated.evaluation;
            session.staleArtifacts = {};
            session.pendingRepairPlan = null;
            PS().recordPipelineGeneration?.(session, "evaluation", generated);
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
        if (!session.evaluation) return;
        pipelinePersistActiveEditor(session, ctx);
        const { targetLayer } = PS().applyPipelineRepairPlan?.(session) || { targetLayer: "evaluate" };
        afterSessionChange({ saveNow: true, editor: true });
        const staleCount = Object.keys(session.staleArtifacts || {}).length;
        showToast(`已定位到「${pipelineStepLabel(targetLayer)}」；已标记 ${staleCount} 个精确依赖，未清空其余成稿`);
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
          if (!session.scripts || !Object.keys(session.scripts).length) {
            clearLocalAiDraft(draftKind); closeModal(); go("studio");
          } else importStructure.disabled = false;
        } catch (error) { importStructure.disabled = false; showError(error); }
        finally { importStructure.textContent = "仅上传编排"; }
      };
      importAll.onclick = async () => {
        if (!session.proposal) return;
        pipelinePersistActiveEditor(session, ctx);
        const proseDiagnostics = diagnoseScriptCollection(session.scripts, { expectedPov: session.setting?.pov });
        const evaluationCurrent = session.evaluation?.scriptFingerprint === fingerprintScriptCollection(session.scripts);
        if (!session.locks?.sync || !session.evaluation?.readyForSync || !proseDiagnostics.passed || !evaluationCurrent) {
          showToast("尚未通过评判与场景化正文门禁，不能上传全部内容");
          return;
        }
        try {
          importAll.disabled = true;
          importAll.textContent = "上传中…";
          const pkg = await zhimuApi.deepseekPipelineMatrixSyncPreview(pipelinePayload());
          const result = await zhimuApi.importDeepseekPipeline({
            ...pkg,
            proposal: session.proposal || pkg.proposal,
            roleMatrix: pkg.rolesMeta,
            rolesMeta: pkg.rolesMeta,
            sections: pkg.sections,
            synopsis: pkg.synopsis,
            setting: session.setting,
            characterArchives: session.characterArchives,
            truthBible: session.truthBible,
            clueNetwork: session.clueNetwork,
            infoMatrix: session.infoMatrix,
            hostRunbooks: session.hostRunbooks
          });
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
      else if (options.focusLayer === "structure" || options.focusLayer === "sync") showToast("已打开 · 当前步骤：机械入库");
      renderPipelineUi();
    } catch (error) { showError(error); }
  }


  window.zhimuPipelineOpen = { openDeepseekPipeline };
})(window);
export {};
