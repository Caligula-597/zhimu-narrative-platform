import { throwErr } from "./api-errors.js";
import { deepseekConfig } from "./deepseek-config.js";
import { requestDeepseekJson } from "./deepseek-client.js";
import { buildStorySpecMessages } from "./prompts/spec.js";
import {
  buildStoryOutlineAssemblyComponentMessages,
  buildStoryOutlineAssemblyMessages,
  buildStoryOutlineAssemblyMechanicalPatchPlan,
  buildStoryOutlineAssemblyPatchMessages,
  buildStoryOutlineBlueprintPatchMessages,
  buildStoryOutlineBlueprintMessages,
  buildStoryOutlineMessages
} from "./prompts/outline.js";
import { buildStructureMessages } from "./prompts/structure.js";
import { buildRoleMatrixMessages } from "./prompts/role-matrix.js";
import { buildRoleSectionMessages } from "./prompts/section.js";
import { buildManuscriptSynopsisMessages } from "./prompts/manuscript-synopsis.js";
import { buildStoryEvaluationMessages } from "./prompts/evaluate.js";
import { buildChapterNarrativeMessages, buildChapterNarrativeContinuationMessages } from "./prompts/chapter-narrative.js";
import { buildRolesFromNarrativeMessages } from "./prompts/roles-from-narrative.js";
import { buildExtractStructureFromNarrativeMessages } from "./prompts/extract-structure-from-narrative.js";
import { buildRolesMetaFromNarrativeMessages } from "./prompts/roles-meta-from-narrative.js";
import { buildRoleScriptFromNarrativeMessages } from "./prompts/role-script-from-narrative.js";
import { validateCreativeSetting, validateSynopsisInput } from "./prompts/creative-input.js";
import { cleanText } from "./prompts/shared.js";
import { pipelineWordTargets } from "./pipeline-matrix-model.js";
import {
  assemblyIssuesArePatchable,
  blueprintIssuesArePatchable
} from "./deepseek-outline-repair/issue-policy.js";
import { applyJsonPointerPatches } from "./deepseek-outline-repair/json-pointer-patch.js";
import { OUTLINE_ASSEMBLY_COMPONENT_KEYS } from "./story-outline-contract/structure.js";
import {
  normalizeStoryBrief,
  validateStorySpec,
  validateStoryOutline,
  validateStoryOutlineBlueprint,
  validateStoryOutlineAssemblyComponent,
  mergeStoryOutlineAssembly,
  validateOutlineBatchDiversity,
  validateDeepseekProposal,
  validateRoleMatrix,
  validateRoleSection,
  chapterNarrativeMinChars,
  validateChapterNarrative,
  validateRolesFromNarrative,
  validateRolesMeta,
  validateRoleScriptFromNarrative,
  validateManuscriptSynopsis,
  validateStoryEvaluation
} from "./deepseek-validators.js";

export { deepseekConfig, requestDeepseekJson };

function chapterNarrativeCallTimeoutMs() {
  const base = deepseekConfig().timeoutMs;
  return Math.min(240000, Math.max(base, 180000));
}

function logChapterNarrative(chapterKey, phase, extra = {}) {
  console.info(JSON.stringify({ event: "deepseek.chapter_narrative", chapterKey, phase, ...extra }));
}

function enrichDeepseekError(error, details) {
  if (!error || typeof error !== "object") return error;
  error.details = { ...(error.details || {}), ...details };
  return error;
}

function roleScriptMaxTokens(minWords, sectionCount) {
  const perSection = Math.max(minWords, 800);
  const targetChars = sectionCount * perSection * 1.25;
  return Math.min(32768, Math.max(4096, Math.ceil(targetChars * 2.5) + 800));
}

function roleScriptCallTimeoutMs() {
  const base = deepseekConfig().timeoutMs;
  return Math.min(240000, Math.max(base, 180000));
}

function logRoleScript(roleKey, phase, extra = {}) {
  console.info(JSON.stringify({ event: "deepseek.role_script", roleKey, phase, ...extra }));
}

function chapterNarrativeTargetChars(setting, config) {
  return setting?.wordsPerChapter || Math.floor((config?.targetWordCount || 8000) / Math.max(config?.chapterCount || 1, 1));
}

/** 中文 narrativeBody 约 2～2.5 token/字；JSON 结构额外预留。 */
function chapterNarrativeMaxTokens(wordsPerChapter) {
  const target = wordsPerChapter || 8000;
  return Math.min(32768, Math.max(8192, Math.ceil(target * 2.5) + 1500));
}

function mergeChapterNarrativeContinuation(chapter, contRaw) {
  const cont = contRaw && typeof contRaw === "object" ? contRaw : {};
  const append = cleanText(cont.narrativeBodyContinuation || cont.narrativeBody, 80000);
  if (!append) return chapter;
  const hostAppend = cleanText(cont.hostNotesAppend, 2000);
  return {
    ...chapter,
    summary: cleanText(cont.summary, 600) || chapter.summary,
    narrativeBody: `${chapter.narrativeBody.trim()}\n\n${append.trim()}`,
    hostNotes: hostAppend ? `${chapter.hostNotes}\n${hostAppend}`.trim() : chapter.hostNotes,
    openThreads: [...chapter.openThreads, ...(Array.isArray(cont.openThreads) ? cont.openThreads : [])].slice(0, 8).map((item) => cleanText(item, 300)),
    resolvedThreads: [...chapter.resolvedThreads, ...(Array.isArray(cont.resolvedThreads) ? cont.resolvedThreads : [])].slice(0, 8).map((item) => cleanText(item, 300)),
    suggestions: [...chapter.suggestions, ...(Array.isArray(cont.suggestions) ? cont.suggestions : [])].slice(0, 8).map((item) => cleanText(item, 500))
  };
}

export async function createDeepseekChapterNarrative(input) {
  const started = Date.now();
  const { setting, synopsis, config, brief } = resolveCreativePipeline(input);
  const chapterKey = cleanText(input.chapterKey, 40);
  const chapterIndex = config.chapterKeys.indexOf(chapterKey);
  if (chapterIndex < 0) throwErr("VALIDATION_ERROR", "chapterKey must exist in config.chapterKeys");
  const previousChapters = Array.isArray(input.previousChapters) ? input.previousChapters : [];
  if (previousChapters.length !== chapterIndex) {
    throwErr("VALIDATION_ERROR", `previousChapters length must be ${chapterIndex} before chapter ${chapterKey}`);
  }
  const minChars = chapterNarrativeMinChars(setting, config);
  const targetChars = chapterNarrativeTargetChars(setting, config);
  const maxTokens = chapterNarrativeMaxTokens(targetChars);
  const callTimeoutMs = chapterNarrativeCallTimeoutMs();
  const ctx = { chapterKey, chapterIndex: chapterIndex + 1, priorCount: previousChapters.length, targetChars, minChars };

  logChapterNarrative(chapterKey, "start", { ...ctx, timeoutMs: callTimeoutMs });

  try {
    logChapterNarrative(chapterKey, "request_primary", { maxTokens });
    const result = await requestDeepseekJson(
      buildChapterNarrativeMessages({
        setting,
        synopsis,
        config,
        chapterKey,
        chapterIndex,
        chapterCount: config.chapterKeys.length,
        previousChapters
      }),
      { maxTokens, temperature: 0.5, timeoutMs: callTimeoutMs, phase: "primary", context: ctx }
    );
    let chapter = parseChapterNarrative(result.value, config, chapterKey);
    logChapterNarrative(chapterKey, "primary_done", { bodyChars: chapter.narrativeBody.length, elapsedMs: Date.now() - started });

    const needsContinuation = chapter.narrativeBody.length < targetChars * 0.85 && targetChars >= 5000;
    if (needsContinuation) {
      const remaining = Math.max(1500, targetChars - chapter.narrativeBody.length);
      logChapterNarrative(chapterKey, "request_continuation", { remaining, bodyChars: chapter.narrativeBody.length });
      const contResult = await requestDeepseekJson(
        buildChapterNarrativeContinuationMessages({
          setting,
          synopsis,
          config,
          chapterKey,
          chapterIndex,
          chapterCount: config.chapterKeys.length,
          previousChapters,
          partialChapter: chapter,
          remainingChars: remaining
        }),
        { maxTokens: chapterNarrativeMaxTokens(remaining), temperature: 0.5, timeoutMs: callTimeoutMs, phase: "continuation", context: ctx }
      );
      chapter = mergeChapterNarrativeContinuation(chapter, contResult.value);
      logChapterNarrative(chapterKey, "continuation_done", { bodyChars: chapter.narrativeBody.length, elapsedMs: Date.now() - started });
    }

    const validated = validateChapterNarrative(chapter, config, chapterKey, minChars);
    logChapterNarrative(chapterKey, "done", { bodyChars: validated.narrativeBody.length, elapsedMs: Date.now() - started, continued: needsContinuation });
    return {
      provider: "deepseek",
      model: result.model,
      setting,
      synopsis,
      config,
      brief,
      chapter: validated
    };
  } catch (error) {
    logChapterNarrative(chapterKey, "error", {
      code: error.code,
      message: error.message,
      elapsedMs: Date.now() - started,
      details: error.details
    });
    throw enrichDeepseekError(error, { chapterKey, chapterIndex: chapterIndex + 1, elapsedMs: Date.now() - started });
  }
}

export async function createDeepseekRolesMetaFromNarrative(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const chapters = Array.isArray(input.chapters) ? input.chapters.map((ch) => validateChapterNarrative(ch, config, ch.chapterKey, chapterNarrativeMinChars(setting, config))) : [];
  if (chapters.length !== config.chapterKeys.length) throwErr("VALIDATION_ERROR", "All chapter narratives required");
  const result = await requestDeepseekJson(
    buildRolesMetaFromNarrativeMessages({ setting, synopsis, chapters }),
    { maxTokens: 4000, temperature: 0.45 }
  );
  const rolesMeta = validateRolesMeta(result.value, setting.playerCount);
  return { provider: "deepseek", model: result.model, setting, synopsis, config, rolesMeta };
}

export async function createDeepseekRoleScriptFromNarrative(input) {
  const started = Date.now();
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const roleKey = cleanText(input.roleKey, 40);
  if (!roleKey) throwErr("VALIDATION_ERROR", "roleKey is required");
  const role = input.role;
  if (!role?.key || role.key !== roleKey) throwErr("VALIDATION_ERROR", "role metadata for roleKey is required");
  const chapterKey = cleanText(input.chapterKey, 40) || null;
  if (chapterKey && !config.chapterKeys.includes(chapterKey)) {
    throwErr("VALIDATION_ERROR", `chapterKey must be one of: ${config.chapterKeys.join(", ")}`);
  }
  const chapters = Array.isArray(input.chapters) ? input.chapters.map((ch) => validateChapterNarrative(ch, config, ch.chapterKey, chapterNarrativeMinChars(setting, config))) : [];
  if (chapters.length !== config.chapterKeys.length) throwErr("VALIDATION_ERROR", "All chapter narratives required");
  const minWords = config.wordsPerSectionMin || 400;
  const existingSections = Array.isArray(input.existingSections) ? input.existingSections : [];
  const requiredChapterKeys = chapterKey ? [chapterKey] : config.chapterKeys;
  const maxTokens = roleScriptMaxTokens(minWords, requiredChapterKeys.length);
  const callTimeoutMs = roleScriptCallTimeoutMs();
  const ctx = { roleKey, chapterKey, sectionCount: requiredChapterKeys.length, minWords, maxTokens };

  logRoleScript(roleKey, "start", { ...ctx, timeoutMs: callTimeoutMs });

  try {
    logRoleScript(roleKey, "request", ctx);
    const result = await requestDeepseekJson(
      buildRoleScriptFromNarrativeMessages({
        setting,
        synopsis,
        role,
        chapters,
        chapterKey,
        existingSections,
        revisionHint: input.revisionHint || ""
      }),
      { maxTokens, temperature: 0.55, timeoutMs: callTimeoutMs, phase: chapterKey ? "section" : "all_sections", context: ctx }
    );
    const parsed = validateRoleScriptFromNarrative(result.value, roleKey, config, minWords, requiredChapterKeys);
    logRoleScript(roleKey, "done", {
      chapterKey,
      sectionChars: Object.fromEntries(Object.entries(parsed.sections).map(([k, s]) => [k, s.body.length])),
      elapsedMs: Date.now() - started
    });
    return {
      provider: "deepseek",
      model: result.model,
      setting,
      synopsis,
      config,
      roleKey,
      chapterKey,
      sections: parsed.sections,
      suggestions: parsed.suggestions
    };
  } catch (error) {
    logRoleScript(roleKey, "error", {
      chapterKey,
      code: error.code,
      message: error.message,
      elapsedMs: Date.now() - started,
      details: error.details
    });
    throw enrichDeepseekError(error, { roleKey, chapterKey, elapsedMs: Date.now() - started });
  }
}

export async function createDeepseekRolesFromNarrative(input) {
  const brief = mergeBrief(input);
  const spec = validateStorySpec(input.spec, brief);
  const roleMatrix = validateRoleMatrix(input.roleMatrix, spec, input.proposal || { chapters: spec.chapterKeys.map((key, i) => ({ key, title: `第 ${i + 1} 章`, summary: "", sequence: i + 1 })) });
  const chapters = Array.isArray(input.chapters) ? input.chapters.map((ch) => validateChapterNarrative(ch, spec, ch.chapterKey)) : [];
  if (chapters.length !== spec.chapterKeys.length) throwErr("VALIDATION_ERROR", "All chapter narratives required before role split");
  const result = await requestDeepseekJson(
    buildRolesFromNarrativeMessages({ brief, spec, roleMatrix, chapters }),
    { maxTokens: 12000, temperature: 0.45 }
  );
  const parsed = validateRolesFromNarrative(result.value, spec, roleMatrix);
  return { provider: "deepseek", model: result.model, brief, spec, roleMatrix, sections: parsed.sections, suggestions: parsed.suggestions };
}

export async function createDeepseekStructureFromNarrative(input) {
  const { setting, synopsis, config, brief } = resolveCreativePipeline(input);
  const minChars = chapterNarrativeMinChars(setting, config);
  const chapters = Array.isArray(input.chapters) ? input.chapters.map((ch) => validateChapterNarrative(ch, config, ch.chapterKey, minChars)) : [];
  if (!chapters.length) throwErr("VALIDATION_ERROR", "chapters required for structure extraction");
  const sectionsSample = Array.isArray(input.sectionsSample) ? input.sectionsSample : [];
  const result = await requestDeepseekJson(
    buildExtractStructureFromNarrativeMessages({ setting, synopsis, config, chapters, sectionsSample }),
    { maxTokens: 8000, temperature: 0.35 }
  );
  return {
    provider: "deepseek",
    model: result.model,
    setting,
    synopsis,
    config,
    brief,
    proposal: validateDeepseekProposal(result.value)
  };
}

export { validateCreativeSetting, validateSynopsisInput };
export {
  normalizeStoryBrief,
  validateStorySpec,
  validateStoryOutline,
  validateStoryOutlineBlueprint,
  validateStoryOutlineAssemblyComponent,
  mergeStoryOutlineAssembly,
  validateOutlineBatchDiversity,
  validateDeepseekProposal,
  validateRoleMatrix,
  validateRoleSection,
  chapterNarrativeMinChars,
  validateChapterNarrative,
  validateRolesFromNarrative,
  validateRolesMeta,
  validateRoleScriptFromNarrative,
  validateManuscriptSynopsis,
  validateStoryEvaluation
};


function buildConfigFromSetting(setting) {
  const chapterKeys = Array.from({ length: setting.chapterCount }, (_, i) => `ch${i + 1}`);
  const targets = pipelineWordTargets(setting);
  return {
    title: setting.theme,
    playerCount: setting.playerCount,
    chapterCount: setting.chapterCount,
    chapterKeys,
    targetWordCount: setting.chapterCount * targets.perScript,
    wordsPerSectionMin: targets.minScript,
    sceneCount: Math.max(setting.chapterCount * 2, 6),
    investigationPointCount: Math.max(setting.chapterCount * 3, 8),
    clueCount: Math.max(setting.chapterCount * 3, 8),
    constraints: setting.extraConflicts
      ? setting.extraConflicts.split(/\n/).map((line) => line.trim()).filter(Boolean)
      : [],
    notes: [`矩阵流水线 · ${targets.label} · 每幕私人本约 ${targets.perScript} 字`]
  };
}

function briefFromCreative(setting, synopsis) {
  return normalizeStoryBrief({
    title: setting.theme,
    premise: synopsis.body,
    playerCount: setting.playerCount,
    chapterCount: setting.chapterCount,
    wordsPerChapter: setting.wordsPerChapter,
    conflicts: setting.extraConflicts,
    requirements: setting.extraConflicts
  });
}

export function resolveCreativePipeline(input = {}) {
  if (input.setting && input.synopsis) {
    const setting = validateCreativeSetting(input.setting);
    const synopsis = validateSynopsisInput(input.synopsis);
    const brief = briefFromCreative(setting, synopsis);
    const config = validateStorySpec(input.config || buildConfigFromSetting(setting), brief);
    return { setting, synopsis, config, brief };
  }
  const brief = mergeBrief(input);
  const config = validateStorySpec(input.spec || input.config, brief);
  const setting = validateCreativeSetting({
    theme: config.title || brief.title,
    playerCount: config.playerCount,
    chapterCount: config.chapterCount,
    wordsPerChapter: brief.wordsPerChapter || Math.max(800, Math.floor(config.targetWordCount / Math.max(config.chapterCount, 1))),
    extraConflicts: (config.constraints || []).join("\n") || brief.requirements,
    tone: ""
  });
  const synopsis = validateSynopsisInput({
    body: brief.premise,
    charactersSketch: "",
    truthSketch: "",
    redHerringsSketch: ""
  });
  return { setting, synopsis, config, brief };
}

function mergeBrief(input = {}) {
  const brief = normalizeStoryBrief(input);
  if (input.spec?.chapterCount) brief.chapterCount = input.spec.chapterCount;
  if (input.spec?.sceneCount) brief.sceneCount = input.spec.sceneCount;
  if (input.spec?.investigationPointCount) brief.investigationPointCount = input.spec.investigationPointCount;
  if (input.spec?.clueCount) brief.clueCount = input.spec.clueCount;
  if (input.spec?.targetWordCount) brief.targetWordCount = input.spec.targetWordCount;
  if (input.spec?.playerCount) brief.playerCount = input.spec.playerCount;
  return brief;
}

export async function createDeepseekStorySpec(input) {
  const brief = normalizeStoryBrief(input);
  const result = await requestDeepseekJson(buildStorySpecMessages(brief), { maxTokens: 2000, temperature: 0.3 });
  return { provider: "deepseek", model: result.model, brief, spec: validateStorySpec(result.value, brief) };
}

export async function createDeepseekStoryOutline(input) {
  const brief = mergeBrief(input);
  const spec = input.spec ? validateStorySpec(input.spec, brief) : (await createDeepseekStorySpec(brief)).spec;
  const onGenerationEvent = typeof input.onGenerationEvent === "function"
    ? input.onGenerationEvent
    : null;
  const emit = async (event) => {
    if (onGenerationEvent) await onGenerationEvent(event);
  };
  const stream = input.stream === true;
  const blueprintTemperature = 0.5;
  const assemblyTemperature = 0.35;
  const blueprintAttemptLimit = Math.max(1, Math.min(5, Number(input.blueprintAttempts) || 3));
  const assemblyAttemptLimit = Math.max(1, Math.min(5, Number(input.assemblyAttempts) || 3));
  const blueprintMaxTokens = brief.generationContract?.outlineRevision === "2.4"
    ? Math.min(16000, Math.max(12000, 8000 + (spec.chapterCount * 1200)))
    : Math.min(14000, Math.max(9000, 6000 + (spec.chapterCount * 1200)));
  const assemblyMaxTokens = brief.generationContract?.outlineRevision === "2.4"
    ? 20000
    : Math.min(20000, Math.max(12000, 8000 + (spec.chapterCount * 1600)));
  const stageMetrics = [];
  const requestStage = async ({
    stage,
    messages,
    maxTokens,
    temperature,
    stageAttempt
  }) => {
    await emit({
      type: "stage-start",
      stage,
      stageAttempt,
      mode: "two-stage-composition",
      temperature,
      maxTokens
    });
    const result = await requestDeepseekJson(messages, {
      maxTokens,
      temperature,
      timeoutMs: input.timeoutMs,
      phase: `outline-${stage}`,
      context: { title: brief.title, stage },
      retryOnJsonParse: false,
      transportRetries: 0,
      stream,
      maxResponseBytes: stream ? 8 * 1024 * 1024 : undefined,
      userId: input.userId ? `${input.userId}-${stage}-${stageAttempt}` : null,
      onStreamDelta: async (deltaEvent) => {
        await emit({
          type: "stage-delta",
          stage,
          stageAttempt,
          mode: "two-stage-composition",
          ...deltaEvent
        });
      }
    });
    await emit({
      type: "stage-response",
      stage,
      stageAttempt,
      mode: "two-stage-composition",
      finishReason: result.finishReason,
      usage: result.usage
    });
    stageMetrics.push({
      stage,
      stageAttempt,
      temperature,
      finishReason: result.finishReason,
      promptTokens: result.usage?.promptTokens || 0,
      completionTokens: result.usage?.completionTokens || 0,
      totalTokens: result.usage?.totalTokens || 0,
      completionBudget: maxTokens,
      nearCompletionLimit: (result.usage?.completionTokens || 0) >= Math.floor(maxTokens * 0.9)
    });
    return result;
  };

  let blueprint = input.blueprint
    ? validateStoryOutlineBlueprint(input.blueprint, spec, { brief })
    : null;
  let lastError = null;
  let previousBlueprintIssues = Array.isArray(input.blueprintIssues)
    ? input.blueprintIssues.slice(0, 20).map((issue) => String(issue || "")).filter(Boolean)
    : [];
  let lastBlueprintCandidate = input.blueprintCandidate && typeof input.blueprintCandidate === "object"
    ? structuredClone(input.blueprintCandidate)
    : null;
  const tryBlueprintPatch = async (candidate, issues, stageAttempt) => {
    if (!candidate || !blueprintIssuesArePatchable(issues)) return null;
    let workingCandidate = structuredClone(candidate);
    let workingIssues = issues;
    let lastPatchError = null;
    for (let patchRound = 1; patchRound <= 3; patchRound += 1) {
      const result = await requestStage({
        stage: "blueprint-patch",
        stageAttempt,
        messages: buildStoryOutlineBlueprintPatchMessages(brief, spec, workingCandidate, workingIssues),
        maxTokens: 3500,
        temperature: 0.2
      });
      try {
        workingCandidate = applyJsonPointerPatches(workingCandidate, result.value?.patches);
      } catch (error) {
        lastPatchError = error;
        workingIssues = [`补丁路径错误：${error?.message || String(error)}。只能使用候选蓝图中真实存在的数组下标和字段路径`];
        if (patchRound === 3) throw error;
        continue;
      }
      try {
        return validateStoryOutlineBlueprint(workingCandidate, spec, { brief });
      } catch (error) {
        lastPatchError = error;
        workingIssues = Array.isArray(error?.details?.issues)
          ? error.details.issues
          : [error?.message || String(error)];
        if (!blueprintIssuesArePatchable(workingIssues) || patchRound === 3) throw error;
      }
    }
    throw lastPatchError || new Error("Blueprint patch did not converge");
  };
  if (!blueprint && lastBlueprintCandidate && blueprintIssuesArePatchable(previousBlueprintIssues)) {
    try {
      blueprint = await tryBlueprintPatch(lastBlueprintCandidate, previousBlueprintIssues, 1);
      await emit({ type: "stage-accepted", stage: "blueprint-patch", stageAttempt: 1, mode: "targeted-blueprint-patch" });
      await emit({ type: "stage-composed", stage: "blueprint", stageAttempt: 1, mode: "targeted-blueprint-patch", value: blueprint });
    } catch (error) {
      lastError = error;
      previousBlueprintIssues = Array.isArray(error?.details?.issues)
        ? error.details.issues
        : [error?.message || String(error)];
      await emit({
        type: "stage-error",
        stage: "blueprint-patch",
        stageAttempt: 1,
        willRetry: true,
        mode: "targeted-blueprint-patch",
        code: error?.code || error?.name || "ERROR",
        message: error?.message || String(error),
        details: error?.details || null
      });
    }
  }
  if (blueprint) {
    await emit({
      type: "stage-reused",
      stage: "blueprint",
      stageAttempt: 0,
      mode: "two-stage-composition",
      value: blueprint
    });
  }
  for (let stageAttempt = 1; !blueprint && stageAttempt <= blueprintAttemptLimit; stageAttempt += 1) {
    try {
      const result = await requestStage({
        stage: "blueprint",
        stageAttempt,
        messages: buildStoryOutlineBlueprintMessages(brief, spec, previousBlueprintIssues),
        maxTokens: blueprintMaxTokens,
        temperature: blueprintTemperature
      });
      lastBlueprintCandidate = result.value;
      blueprint = validateStoryOutlineBlueprint(result.value, spec, { brief });
      await emit({
        type: "stage-accepted",
        stage: "blueprint",
        stageAttempt,
        mode: "two-stage-composition"
      });
      break;
    } catch (error) {
      lastError = error;
      previousBlueprintIssues = Array.isArray(error?.details?.issues)
        ? error.details.issues
        : [error?.message || String(error)];
      await emit({
        type: "stage-error",
        stage: "blueprint",
        stageAttempt,
        willRetry: stageAttempt < blueprintAttemptLimit,
        mode: "two-stage-composition",
        code: error?.code || error?.name || "ERROR",
        message: error?.message || String(error),
        details: error?.details || null
      });
      if (lastBlueprintCandidate && blueprintIssuesArePatchable(previousBlueprintIssues)) {
        try {
          blueprint = await tryBlueprintPatch(lastBlueprintCandidate, previousBlueprintIssues, stageAttempt);
          await emit({
            type: "stage-accepted",
            stage: "blueprint-patch",
            stageAttempt,
            mode: "targeted-blueprint-patch"
          });
          await emit({
            type: "stage-composed",
            stage: "blueprint",
            stageAttempt,
            mode: "targeted-blueprint-patch",
            value: blueprint
          });
          break;
        } catch (patchError) {
          lastError = patchError;
          previousBlueprintIssues = Array.isArray(patchError?.details?.issues)
            ? patchError.details.issues
            : [patchError?.message || String(patchError)];
          await emit({
            type: "stage-error",
            stage: "blueprint-patch",
            stageAttempt,
            willRetry: stageAttempt < blueprintAttemptLimit,
            mode: "targeted-blueprint-patch",
            code: patchError?.code || patchError?.name || "ERROR",
            message: patchError?.message || String(patchError),
            details: patchError?.details || null
          });
        }
      }
    }
  }
  if (!blueprint && lastBlueprintCandidate && blueprintIssuesArePatchable(previousBlueprintIssues)) {
    try {
      blueprint = await tryBlueprintPatch(lastBlueprintCandidate, previousBlueprintIssues, 2);
      await emit({ type: "stage-accepted", stage: "blueprint-patch", stageAttempt: 2, mode: "targeted-blueprint-patch" });
      await emit({ type: "stage-composed", stage: "blueprint", stageAttempt: 2, mode: "targeted-blueprint-patch", value: blueprint });
    } catch (error) {
      lastError = error;
      previousBlueprintIssues = Array.isArray(error?.details?.issues)
        ? error.details.issues
        : [error?.message || String(error)];
      await emit({
        type: "stage-error",
        stage: "blueprint-patch",
        stageAttempt: 2,
        willRetry: false,
        mode: "targeted-blueprint-patch",
        code: error?.code || error?.name || "ERROR",
        message: error?.message || String(error),
        details: error?.details || null
      });
    }
  }
  if (!blueprint) throw lastError;

  let acceptedAssemblyResult = null;
  let outline = null;
  let previousAssemblyIssues = Array.isArray(input.assemblyIssues)
    ? input.assemblyIssues.slice(0, 30).map((issue) => String(issue || "")).filter(Boolean)
    : [];
  const tryAssemblyPatch = async (candidate, issues, stageAttempt) => {
    if (!candidate || !assemblyIssuesArePatchable(issues)) return null;
    let workingCandidate = structuredClone(candidate);
    let workingIssues = issues;
    let lastPatchError = null;
    for (let patchRound = 1; patchRound <= 12; patchRound += 1) {
      const focusedIssues = workingIssues.slice(0, 1);
      let result;
      const mechanicalPatches = buildStoryOutlineAssemblyMechanicalPatchPlan(blueprint, workingCandidate, focusedIssues[0], spec);
      if (mechanicalPatches.length) {
        result = {
          value: { patches: mechanicalPatches },
          model: "deterministic-contract-repair",
          finishReason: "mechanical",
          usage: null
        };
      } else {
        try {
          result = await requestStage({
            stage: "assembly-patch",
            stageAttempt,
            messages: buildStoryOutlineAssemblyPatchMessages(brief, spec, blueprint, workingCandidate, focusedIssues),
            maxTokens: 2500,
            temperature: 0.2
          });
        } catch (error) {
          lastPatchError = error;
          workingIssues = [
            ...focusedIssues,
            `补丁响应无效：${error?.message || String(error)}。仍须修复上一项原问题，不得改写其他字段`
          ];
          if (patchRound === 12) throw error;
          continue;
        }
      }
      try {
        workingCandidate = applyJsonPointerPatches(workingCandidate, result.value?.patches);
      } catch (error) {
        lastPatchError = error;
        workingIssues = [
          ...focusedIssues,
          `补丁输出无效：${error?.message || String(error)}。仍须修复上一项原问题，只能使用当前装配中真实存在的数组下标和字段路径`
        ];
        if (patchRound === 12) throw error;
        continue;
      }
      try {
        const assembledOutline = mergeStoryOutlineAssembly(blueprint, workingCandidate, spec, {
          generationContract: brief.generationContract
        });
        return {
          assembly: workingCandidate,
          outline: validateStoryOutline(assembledOutline, spec, { strict: true, brief }),
          result
        };
      } catch (error) {
        lastPatchError = error;
        workingIssues = Array.isArray(error?.details?.issues)
          ? error.details.issues
          : [error?.message || String(error)];
        await emit({
          type: "stage-checkpoint",
          stage: "assembly",
          stageAttempt,
          mode: "targeted-assembly-patch",
          value: workingCandidate,
          issues: workingIssues
        });
        if (!assemblyIssuesArePatchable(workingIssues) || patchRound === 12) throw error;
      }
    }
    throw lastPatchError || new Error("Assembly patch did not converge");
  };
  if (input.assemblyCandidate && typeof input.assemblyCandidate === "object") {
    try {
      const assembledOutline = mergeStoryOutlineAssembly(blueprint, input.assemblyCandidate, spec, {
        generationContract: brief.generationContract
      });
      outline = validateStoryOutline(assembledOutline, spec, { strict: true, brief });
      acceptedAssemblyResult = { model: "revalidated-assembly-checkpoint" };
      await emit({
        type: "stage-reused",
        stage: "assembly",
        stageAttempt: 0,
        mode: "revalidated-assembly-checkpoint",
        value: input.assemblyCandidate
      });
    } catch (error) {
      lastError = error;
      previousAssemblyIssues = Array.isArray(error?.details?.issues)
        ? error.details.issues
        : [error?.message || String(error)];
      await emit({
        type: "stage-error",
        stage: "assembly-revalidate",
        stageAttempt: 0,
        willRetry: true,
        mode: "revalidated-assembly-checkpoint",
        code: error?.code || error?.name || "ERROR",
        message: error?.message || String(error),
        details: error?.details || null
      });
      if (assemblyIssuesArePatchable(previousAssemblyIssues)) {
        try {
          const patched = await tryAssemblyPatch(input.assemblyCandidate, previousAssemblyIssues, 1);
          outline = patched.outline;
          acceptedAssemblyResult = patched.result;
          await emit({ type: "stage-accepted", stage: "assembly-patch", stageAttempt: 1, mode: "targeted-assembly-patch" });
          await emit({ type: "stage-composed", stage: "assembly", stageAttempt: 1, mode: "targeted-assembly-patch", value: patched.assembly });
        } catch (patchError) {
          lastError = patchError;
          previousAssemblyIssues = Array.isArray(patchError?.details?.issues)
            ? patchError.details.issues
            : [patchError?.message || String(patchError)];
          await emit({
            type: "stage-error",
            stage: "assembly-patch",
            stageAttempt: 1,
            willRetry: true,
            mode: "targeted-assembly-patch",
            code: patchError?.code || patchError?.name || "ERROR",
            message: patchError?.message || String(patchError),
            details: patchError?.details || null
          });
        }
      }
    }
  }
  const usesParallelAssembly = brief.generationContract?.outlineRevision === "2.3";
  const usesSemanticAssembly = brief.generationContract?.outlineRevision === "2.4";
  if (!outline && usesParallelAssembly) {
    const componentPlans = {
      playerActions: { stage: "assembly-player-actions", maxTokens: Math.min(10000, assemblyMaxTokens) },
      chapterBeats: { stage: "assembly-chapter-beats", maxTokens: assemblyMaxTokens },
      styleExpressions: { stage: "assembly-style-expressions", maxTokens: Math.min(6000, assemblyMaxTokens) }
    };
    const components = OUTLINE_ASSEMBLY_COMPONENT_KEYS.map((key) => ({ key, ...componentPlans[key] }));
    const acceptedComponentValues = new Map();
    const acceptedComponentResults = new Map();
    const componentAttemptCounts = new Map(components.map((component) => [component.key, 0]));
    const reusableComponents = input.assemblyComponents && typeof input.assemblyComponents === "object"
      ? input.assemblyComponents
      : {};
    for (const component of components) {
      const rawReusable = reusableComponents[component.key];
      if (!rawReusable) continue;
      try {
        const validated = validateStoryOutlineAssemblyComponent(
          rawReusable,
          component.key,
          blueprint,
          spec,
          { generationContract: brief.generationContract }
        );
        acceptedComponentValues.set(component.key, validated);
        await emit({
          type: "stage-reused",
          stage: component.stage,
          stageAttempt: 0,
          mode: "parallel-assembly-components",
          value: validated
        });
      } catch {
        // A checkpoint accepted by an older contract is regenerated under the current validator.
      }
    }
    let retryComponentKeys = new Set(components
      .filter((component) => !acceptedComponentValues.has(component.key))
      .map((component) => component.key));
    const playerIssuePrefixes = (Array.isArray(blueprint?.players) ? blueprint.players : [])
      .flatMap((player) => [
        `${player?.name || ""}.chapter-`,
        `${player?.key || ""}.chapterActions`
      ])
      .filter((prefix) => !prefix.startsWith("."));
    const classifyRetryComponents = (issues) => {
      const keys = new Set();
      for (const issue of issues) {
        if (/styleChapterExpressions|styleContract|文风/u.test(issue)) keys.add("styleExpressions");
        else if (/chapterBeats/u.test(issue)) keys.add("chapterBeats");
        else if (
          /chapterActions|必须在 chapter-\d+ 通过行动|虽有行动|行动结果没有形成|行动从未改变/u.test(issue)
          || playerIssuePrefixes.some((prefix) => issue.startsWith(prefix))
        ) keys.add("playerActions");
        else keys.add("chapterBeats");
      }
      return keys.size ? keys : new Set(["chapterBeats"]);
    };
    for (let stageAttempt = 1; stageAttempt <= assemblyAttemptLimit * components.length; stageAttempt += 1) {
      const componentsToRun = components.filter(
        (component) => (
          (retryComponentKeys.has(component.key) || !acceptedComponentValues.has(component.key))
          && (componentAttemptCounts.get(component.key) || 0) < assemblyAttemptLimit
        )
      );
      if (!componentsToRun.length && acceptedComponentValues.size !== components.length) break;
      try {
        for (const component of componentsToRun) {
          componentAttemptCounts.set(component.key, (componentAttemptCounts.get(component.key) || 0) + 1);
        }
        const results = await Promise.allSettled(componentsToRun.map((component) => requestStage({
          stage: component.stage,
          stageAttempt,
          messages: buildStoryOutlineAssemblyComponentMessages(
            brief,
            spec,
            blueprint,
            component.key,
            previousAssemblyIssues
          ),
          maxTokens: component.maxTokens,
          temperature: assemblyTemperature
        })));
        const rejectedComponentKeys = new Set();
        const rejectedIssues = [];
        let firstComponentError = null;
        for (const [index, settledResult] of results.entries()) {
          const component = componentsToRun[index];
          try {
            if (settledResult.status === "rejected") throw settledResult.reason;
            const result = settledResult.value;
            const validated = validateStoryOutlineAssemblyComponent(
              result.value,
              component.key,
              blueprint,
              spec,
              { generationContract: brief.generationContract }
            );
            acceptedComponentValues.set(component.key, validated);
            acceptedComponentResults.set(component.key, result);
            await emit({
              type: "stage-accepted",
              stage: component.stage,
              stageAttempt,
              mode: "parallel-assembly-components"
            });
          } catch (componentError) {
            componentError.assemblyComponentKey = component.key;
            if (!firstComponentError) firstComponentError = componentError;
            const componentIssues = Array.isArray(componentError?.details?.issues)
              ? componentError.details.issues
              : [componentError?.message || String(componentError)];
            rejectedIssues.push(...componentIssues);
            rejectedComponentKeys.add(component.key);
            acceptedComponentValues.delete(component.key);
            acceptedComponentResults.delete(component.key);
            await emit({
              type: "stage-error",
              stage: component.stage,
              stageAttempt,
              willRetry: (componentAttemptCounts.get(component.key) || 0) < assemblyAttemptLimit,
              mode: "parallel-assembly-components",
              code: componentError?.code || componentError?.name || "ERROR",
              message: componentError?.message || String(componentError),
              details: componentError?.details || null
            });
          }
        }
        if (rejectedComponentKeys.size) {
          lastError = firstComponentError;
          previousAssemblyIssues = rejectedIssues;
          retryComponentKeys = rejectedComponentKeys;
          continue;
        }
        retryComponentKeys = new Set();
        const assembly = Object.assign(
          {},
          ...components.map((component) => acceptedComponentValues.get(component.key)).filter(Boolean)
        );
        const assembledOutline = mergeStoryOutlineAssembly(blueprint, assembly, spec, {
          generationContract: brief.generationContract
        });
        outline = validateStoryOutline(assembledOutline, spec, { strict: true, brief });
        acceptedAssemblyResult = acceptedComponentResults.get("chapterBeats")
          || acceptedComponentResults.values().next().value
          || { model: "reused-accepted-components" };
        await emit({
          type: "stage-composed",
          stage: "assembly",
          stageAttempt,
          mode: "parallel-assembly-components",
          value: assembly
        });
        break;
      } catch (error) {
        lastError = error;
        previousAssemblyIssues = Array.isArray(error?.details?.issues)
          ? error.details.issues
          : [error?.message || String(error)];
        retryComponentKeys = error?.assemblyComponentKey
          ? new Set([error.assemblyComponentKey])
          : classifyRetryComponents(previousAssemblyIssues);
        for (const key of retryComponentKeys) {
          acceptedComponentValues.delete(key);
          acceptedComponentResults.delete(key);
        }
        for (const component of components.filter((entry) => retryComponentKeys.has(entry.key))) {
          await emit({
            type: "stage-error",
            stage: component.stage,
            stageAttempt,
            willRetry: (componentAttemptCounts.get(component.key) || 0) < assemblyAttemptLimit,
            mode: "parallel-assembly-components",
            code: error?.code || error?.name || "ERROR",
            message: error?.message || String(error),
            details: error?.details || null
          });
        }
      }
    }
  } else if (!outline) {
    let lastAssemblyCandidate = null;
    for (let stageAttempt = 1; stageAttempt <= assemblyAttemptLimit; stageAttempt += 1) {
      try {
        const result = await requestStage({
          stage: "assembly",
          stageAttempt,
          messages: buildStoryOutlineAssemblyMessages(brief, spec, blueprint, previousAssemblyIssues),
          maxTokens: assemblyMaxTokens,
          temperature: assemblyTemperature
        });
        lastAssemblyCandidate = result.value;
        const assembledOutline = mergeStoryOutlineAssembly(blueprint, result.value, spec, {
          generationContract: brief.generationContract
        });
        outline = validateStoryOutline(assembledOutline, spec, { strict: true, brief });
        acceptedAssemblyResult = result;
        await emit({
          type: "stage-accepted",
          stage: "assembly",
          stageAttempt,
          mode: "two-stage-composition"
        });
        break;
      } catch (error) {
        lastError = error;
        previousAssemblyIssues = Array.isArray(error?.details?.issues)
          ? error.details.issues
          : [error?.message || String(error)];
        await emit({
          type: "stage-error",
          stage: "assembly",
          stageAttempt,
          willRetry: stageAttempt < assemblyAttemptLimit,
          mode: "two-stage-composition",
          code: error?.code || error?.name || "ERROR",
          message: error?.message || String(error),
          details: error?.details || null
        });
        if (lastAssemblyCandidate && assemblyIssuesArePatchable(previousAssemblyIssues)) {
          try {
            const patched = await tryAssemblyPatch(lastAssemblyCandidate, previousAssemblyIssues, stageAttempt);
            outline = patched.outline;
            acceptedAssemblyResult = patched.result;
            await emit({ type: "stage-accepted", stage: "assembly-patch", stageAttempt, mode: "targeted-assembly-patch" });
            await emit({ type: "stage-composed", stage: "assembly", stageAttempt, mode: "targeted-assembly-patch", value: patched.assembly });
            break;
          } catch (patchError) {
            lastError = patchError;
            previousAssemblyIssues = Array.isArray(patchError?.details?.issues)
              ? patchError.details.issues
              : [patchError?.message || String(patchError)];
            await emit({
              type: "stage-error",
              stage: "assembly-patch",
              stageAttempt,
              willRetry: stageAttempt < assemblyAttemptLimit,
              mode: "targeted-assembly-patch",
              code: patchError?.code || patchError?.name || "ERROR",
              message: patchError?.message || String(patchError),
              details: patchError?.details || null
            });
          }
        }
      }
    }
  }
  if (!outline || !acceptedAssemblyResult) throw lastError;

  const totalPromptTokens = stageMetrics.reduce((sum, row) => sum + row.promptTokens, 0);
  const totalCompletionTokens = stageMetrics.reduce((sum, row) => sum + row.completionTokens, 0);
  return {
    provider: "deepseek",
    model: deepseekConfig().model,
    brief,
    spec,
    generationAttempts: stageMetrics.length,
    generationMode: usesParallelAssembly
      ? "blueprint-then-parallel-assembly-components"
      : usesSemanticAssembly
        ? "semantic-blueprint-then-branch-aware-assembly"
        : "blueprint-then-assembly",
    generationMetrics: {
      attempts: stageMetrics,
      totalPromptTokens,
      totalCompletionTokens,
      nearCompletionLimit: stageMetrics.some((row) => row.nearCompletionLimit)
    },
    outline
  };
}

export function buildDeepseekStoryMessages(input) {
  const brief = mergeBrief(input);
  const spec = input.spec || {
    playerCount: brief.playerCount,
    chapterCount: brief.chapterCount,
    chapterKeys: Array.from({ length: brief.chapterCount }, (_, index) => `chapter-${index + 1}`),
    sceneCount: brief.sceneCount,
    investigationPointCount: brief.investigationPointCount,
    clueCount: brief.clueCount,
    targetWordCount: brief.targetWordCount
  };
  return {
    brief,
    messages: buildStructureMessages(brief, spec, input.outline || null)
  };
}

export async function createDeepseekStoryProposal(input) {
  const brief = mergeBrief(input);
  const resolvedSpec = input.spec ? validateStorySpec(input.spec, brief) : (await createDeepseekStorySpec(brief)).spec;
  const outline = input.outline ? validateStoryOutline(input.outline, resolvedSpec, { brief }) : null;
  const resolvedOutline = outline || (input.skipOutline ? null : null);
  const { messages } = buildDeepseekStoryMessages({ ...input, brief, spec: resolvedSpec, outline: resolvedOutline });
  const result = await requestDeepseekJson(messages, { maxTokens: 10000, temperature: 0.55 });
  return {
    provider: "deepseek",
    model: result.model,
    brief,
    spec: resolvedSpec,
    outline: resolvedOutline,
    proposal: validateDeepseekProposal(result.value)
  };
}

export async function createDeepseekRoleMatrix(input) {
  const brief = mergeBrief(input);
  const spec = validateStorySpec(input.spec, brief);
  const outline = input.outline ? validateStoryOutline(input.outline, spec) : null;
  const proposal = validateDeepseekProposal(input.proposal);
  const result = await requestDeepseekJson(buildRoleMatrixMessages(brief, spec, outline, proposal), { maxTokens: 6000, temperature: 0.5 });
  return {
    provider: "deepseek",
    model: result.model,
    brief,
    spec,
    outline,
    proposal,
    roleMatrix: validateRoleMatrix(result.value, spec, proposal)
  };
}

export async function createDeepseekRoleSection(input) {
  const brief = mergeBrief(input);
  const spec = validateStorySpec(input.spec, brief);
  const outline = input.outline ? validateStoryOutline(input.outline, spec) : null;
  const proposal = validateDeepseekProposal(input.proposal);
  const roleMatrix = validateRoleMatrix(input.roleMatrix, spec, proposal);
  const roleKey = cleanText(input.roleKey, 40);
  const chapterKey = cleanText(input.chapterKey, 40);
  if (!roleKey || !chapterKey) throwErr("VALIDATION_ERROR", "roleKey and chapterKey are required");
  const minWords = spec.wordsPerSectionMin || 250;
  const result = await requestDeepseekJson(
    buildRoleSectionMessages({ brief, spec, outline, proposal, roleMatrix, roleKey, chapterKey, sectionMinWords: minWords }),
    { maxTokens: 3500, temperature: 0.65 }
  );
  return {
    provider: "deepseek",
    model: result.model,
    section: validateRoleSection(result.value, roleKey, chapterKey, minWords)
  };
}

export async function createDeepseekManuscriptSynopsis(input) {
  const brief = mergeBrief(input);
  const proposal = validateDeepseekProposal(input.proposal);
  const roleMatrix = input.roleMatrix ? validateRoleMatrix(input.roleMatrix, validateStorySpec(input.spec, brief), proposal) : null;
  const outline = input.outline ? validateStoryOutline(input.outline, validateStorySpec(input.spec, brief)) : null;
  const result = await requestDeepseekJson(
    buildManuscriptSynopsisMessages(brief, outline, proposal, roleMatrix),
    { maxTokens: 3000, temperature: 0.5 }
  );
  return {
    provider: "deepseek",
    model: result.model,
    synopsis: validateManuscriptSynopsis(result.value, proposal)
  };
}

/** @deprecated Prefer staged pipeline; runs sequential API calls without parallel long outputs */
export async function createDeepseekMysteryPackage(input) {
  const brief = mergeBrief(input);
  const specResult = await createDeepseekStorySpec(brief);
  const outlineResult = await createDeepseekStoryOutline({ ...input, spec: specResult.spec });
  const structureResult = await createDeepseekStoryProposal({
    ...input,
    spec: specResult.spec,
    outline: outlineResult.outline,
    skipOutline: true
  });
  const matrixResult = await createDeepseekRoleMatrix({
    ...input,
    spec: specResult.spec,
    outline: outlineResult.outline,
    proposal: structureResult.proposal
  });
  const sections = {};
  for (const role of matrixResult.roleMatrix.roles) {
    sections[role.key] = {};
    for (const chapter of structureResult.proposal.chapters) {
      const sectionResult = await createDeepseekRoleSection({
        ...input,
        spec: specResult.spec,
        outline: outlineResult.outline,
        proposal: structureResult.proposal,
        roleMatrix: matrixResult.roleMatrix,
        roleKey: role.key,
        chapterKey: chapter.key
      });
      sections[role.key][chapter.key] = sectionResult.section;
    }
  }
  const synopsisResult = await createDeepseekManuscriptSynopsis({
    ...input,
    spec: specResult.spec,
    outline: outlineResult.outline,
    proposal: structureResult.proposal,
    roleMatrix: matrixResult.roleMatrix
  });
  const packageRoles = matrixResult.roleMatrix.roles.map((role) => ({
    key: role.key,
    name: role.name,
    publicProfile: role.publicProfile,
    privateProfile: role.privateProfile,
    sections: structureResult.proposal.chapters.map((chapter) => {
      const section = sections[role.key][chapter.key];
      return { chapterKey: chapter.key, title: section.title, body: section.body };
    })
  }));
  return {
    provider: "deepseek",
    model: structureResult.model,
    brief,
    spec: specResult.spec,
    outline: outlineResult.outline,
    proposal: structureResult.proposal,
    roleMatrix: matrixResult.roleMatrix,
    package: {
      title: synopsisResult.synopsis.title,
      summary: synopsisResult.synopsis.summary,
      overallManuscript: synopsisResult.synopsis.overallManuscript,
      logicNotes: synopsisResult.synopsis.logicNotes,
      roles: packageRoles
    },
    pipelineMeta: {
      apiCalls: 4 + matrixResult.roleMatrix.roles.length * structureResult.proposal.chapters.length + 1,
      staged: true
    }
  };
}

export async function createDeepseekStoryEvaluation(pipeline) {
  const result = await requestDeepseekJson(buildStoryEvaluationMessages(pipeline), { maxTokens: 4500, temperature: 0.35 });
  return { provider: "deepseek", model: result.model, evaluation: validateStoryEvaluation(result.value) };
}
