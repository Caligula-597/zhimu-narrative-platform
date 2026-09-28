/**
 * Stage 3A Pass 1 architecture variants — for probe / comparison only.
 */

import { deepseekConfig } from "../../../deepseek-config.js";
import {
  normalizeEventCandidates,
  runPass1CoverageRead
} from "../pass1-coverage-read.js";
import { normalizeSourceDisposition } from "../audit.js";
import {
  applyMemoryPatch,
  createEmptyStoryMemory,
  extractMentionsFromText,
  selectRelevantMemory
} from "../story-memory.js";
import { buildCoverageWindows } from "../windows.js";

const EVENTS_SYSTEM = [
  "你是剧本杀主持手册覆盖阅读助手。只输出本窗口 EventCandidate JSON。",
  "高召回：CORE/SUPPORTING/DETAIL 都保留；禁止脑补；每条必须有 sourceSectionIds。",
  "只输出 JSON：",
  '{"events":[{"title":"","summary":"","importance":"CORE|SUPPORTING|DETAIL","sourceSectionIds":[],"participantNames":[],"locationHint":null,"temporalHint":null,"confidence":"HIGH|MEDIUM|LOW","evidenceQuote":""}]}'
].join("\n");

const DISP_SYSTEM = [
  "你是剧本杀主持手册 section 分类助手。为每个 sourceSectionId 输出 disposition。",
  "只输出 JSON：",
  '{"sourceDispositions":[{"sourceSectionId":"","type":"TIMELINE|BACKGROUND|RULE|META|ATMOSPHERE|SUMMARY|NO_TIMELINE_CONTENT","linkedCandidateIds":[],"reason":null}]}'
].join("\n");

function memoryPatchFromCandidates(candidates) {
  return {
    addEvents: candidates.slice(-8).map((c) => ({
      candidateId: c.candidateId,
      title: c.title,
      summary: c.summary,
      stageId: c.stageId || null
    })),
    addCharacters: [
      ...new Set(candidates.flatMap((c) => c.participantNames || []))
    ].map((name) => ({ name })),
    addLocations: [
      ...new Set(candidates.map((c) => c.locationHint).filter(Boolean))
    ].map((name) => ({ name }))
  };
}

async function callPass1(requestJson, system, user, phase, maxTokens) {
  const started = Date.now();
  try {
    const result = await requestJson(
      [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) }
      ],
      {
        temperature: 0.15,
        maxTokens,
        timeoutMs: Math.min(deepseekConfig().timeoutMs, 120000),
        phase
      }
    );
    return {
      ok: true,
      value: result.value,
      usage: result.usage,
      elapsedMs: Date.now() - started,
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      usage: null,
      elapsedMs: Date.now() - started,
      error: error?.message || String(error),
      truncated: /截断|TRUNCATED|length/i.test(error?.message || "")
    };
  }
}

function buildWindowUser(input, win, globalStoryMap, relevantMemory, prevCandidates) {
  return {
    globalStoryMap,
    relevantStoryMemory: relevantMemory,
    previousLocalContext: (prevCandidates || []).slice(-5).map((c) => ({
      candidateId: c.candidateId,
      title: c.title,
      summary: c.summary
    })),
    currentSourceSections: win.sections.map((s) => ({
      id: s.id,
      headingPath: s.headingPath || [],
      text: String(s.originalText || "").slice(0, 3500)
    }))
  };
}

/** A — current monolith: events + memoryPatch + dispositions in one call */
export async function architectureMonolith(input, opts = {}) {
  const started = Date.now();
  try {
    const pass1 = await runPass1CoverageRead(input, {
      globalStoryMap: opts.globalStoryMap,
      storyMemory: createEmptyStoryMemory(),
      requestJson: opts.requestJson,
      windowSize: opts.windowSize ?? 3,
      overlap: opts.overlap ?? 1
    });
    return {
      id: "A_monolith",
      ok: true,
      candidates: pass1.candidates,
      sourceDispositions: pass1.sourceDispositions,
      calls: pass1.windows,
      usages: pass1.usages || [],
      elapsedMs: Date.now() - started,
      errors: [],
      truncatedWindows: 0
    };
  } catch (error) {
    return {
      id: "A_monolith",
      ok: false,
      candidates: [],
      sourceDispositions: [],
      calls: 0,
      usages: [],
      elapsedMs: Date.now() - started,
      errors: [error?.message || String(error)],
      truncatedWindows: 1
    };
  }
}

/** B — split IO: events call + dispositions call; memoryPatch deterministic */
export async function architectureSplitIo(input, opts = {}) {
  const { requestDeepseekJson } = opts.requestJson
    ? { requestDeepseekJson: opts.requestJson }
    : await import("../../../deepseek-client.js");

  const requestJson = opts.requestJson || requestDeepseekJson;
  const sections = input.hostSourceSections || [];
  const windows = buildCoverageWindows(sections, {
    windowSize: opts.windowSize ?? 3,
    overlap: opts.overlap ?? 1
  });

  let memory = createEmptyStoryMemory();
  const allCandidates = [];
  const allDispositions = [];
  const usages = [];
  const errors = [];
  let truncatedWindows = 0;
  const started = Date.now();

  for (const win of windows) {
    const validIds = new Set(win.sectionIds);
    const windowText = win.sections.map((s) => s.originalText || "").join("\n");
    const mentions = extractMentionsFromText(
      windowText,
      (input.projectMeta?.characters || []).map((c) => c.name)
    );
    const relevantMemory = selectRelevantMemory(memory, {
      mentionedCharacters: mentions.mentionedCharacters,
      recentEventLimit: 6
    });
    const user = buildWindowUser(
      input,
      win,
      opts.globalStoryMap,
      relevantMemory,
      allCandidates
    );

    const evRes = await callPass1(
      requestJson,
      EVENTS_SYSTEM,
      { ...user, instruction: "抽取 events，最多 12 条" },
      "probe-arch-B-events",
      3500
    );
    if (evRes.usage) usages.push(evRes.usage);
    if (!evRes.ok) {
      errors.push(`win${win.index} events: ${evRes.error}`);
      if (evRes.truncated) truncatedWindows += 1;
      continue;
    }

    const candidates = normalizeEventCandidates(evRes.value?.events, validIds);
    allCandidates.push(...candidates);

    const dispRes = await callPass1(
      requestJson,
      DISP_SYSTEM,
      {
        ...user,
        extractedEvents: candidates.map((c) => ({
          candidateId: c.candidateId,
          title: c.title,
          sourceSectionIds: c.sourceSectionIds
        })),
        instruction: "为每个 currentSourceSections.id 输出 disposition"
      },
      "probe-arch-B-dispositions",
      2000
    );
    if (dispRes.usage) usages.push(dispRes.usage);
    if (!dispRes.ok) {
      errors.push(`win${win.index} disp: ${dispRes.error}`);
      if (dispRes.truncated) truncatedWindows += 1;
    } else {
      for (const raw of dispRes.value?.sourceDispositions || []) {
        const d = normalizeSourceDisposition(raw, validIds);
        if (d) allDispositions.push(d);
      }
    }

    memory = applyMemoryPatch(memory, {
      ...memoryPatchFromCandidates(candidates),
      lastProcessedSourceIds: win.sectionIds
    });
  }

  return {
    id: "B_split_io",
    ok: errors.length === 0 && allCandidates.length > 0,
    candidates: allCandidates,
    sourceDispositions: allDispositions,
    calls: windows.length * 2,
    usages,
    elapsedMs: Date.now() - started,
    errors,
    truncatedWindows
  };
}

/** C — micro window: 1 section per call, slim combined schema (no memoryPatch in LLM) */
export async function architectureMicroSection(input, opts = {}) {
  const { requestDeepseekJson } = opts.requestJson
    ? { requestDeepseekJson: opts.requestJson }
    : await import("../../../deepseek-client.js");

  const requestJson = opts.requestJson || requestDeepseekJson;
  const sections = input.hostSourceSections || [];
  const windows = buildCoverageWindows(sections, { windowSize: 1, overlap: 0 });

  let memory = createEmptyStoryMemory();
  const allCandidates = [];
  const allDispositions = [];
  const usages = [];
  const errors = [];
  let truncatedWindows = 0;
  const started = Date.now();

  const SLIM_SYSTEM = [
    "单 section 覆盖阅读。输出 events（高召回）+ 该 section 的 sourceDisposition。",
    "只输出 JSON：",
    '{"events":[{"title":"","summary":"","importance":"CORE|SUPPORTING|DETAIL","sourceSectionIds":[],"evidenceQuote":""}],"sourceDispositions":[{"sourceSectionId":"","type":"TIMELINE|BACKGROUND|RULE|META|ATMOSPHERE|SUMMARY|NO_TIMELINE_CONTENT","linkedCandidateIds":[]}]}'
  ].join("\n");

  for (const win of windows) {
    const validIds = new Set(win.sectionIds);
    const sec = win.sections[0];
    const relevantMemory = selectRelevantMemory(memory, { recentEventLimit: 5 });
    const user = {
      globalStoryMap: opts.globalStoryMap,
      relevantStoryMemory: relevantMemory,
      currentSourceSection: {
        id: sec.id,
        headingPath: sec.headingPath || [],
        text: String(sec.originalText || "").slice(0, 4000)
      }
    };

    const res = await callPass1(
      requestJson,
      SLIM_SYSTEM,
      user,
      "probe-arch-C-micro",
      2500
    );
    if (res.usage) usages.push(res.usage);
    if (!res.ok) {
      errors.push(`sec ${sec.id}: ${res.error}`);
      if (res.truncated) truncatedWindows += 1;
      continue;
    }

    const candidates = normalizeEventCandidates(res.value?.events, validIds);
    allCandidates.push(...candidates);
    for (const raw of res.value?.sourceDispositions || []) {
      const d = normalizeSourceDisposition(raw, validIds);
      if (d) allDispositions.push(d);
    }
    memory = applyMemoryPatch(memory, memoryPatchFromCandidates(candidates));
  }

  return {
    id: "C_micro_section",
    ok: errors.length === 0 && allCandidates.length > 0,
    candidates: allCandidates,
    sourceDispositions: allDispositions,
    calls: windows.length,
    usages,
    elapsedMs: Date.now() - started,
    errors,
    truncatedWindows
  };
}

export const ARCHITECTURES = {
  A_monolith: architectureMonolith,
  B_split_io: architectureSplitIo,
  C_micro_section: architectureMicroSection
};
