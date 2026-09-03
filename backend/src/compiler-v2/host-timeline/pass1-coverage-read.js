/**
 * Pass 1 — Stateful Coverage Read → EventCandidates + memoryPatch + sourceDispositions.
 */

import { deepseekConfig } from "../../deepseek-config.js";
import {
  CONFIDENCE,
  EVENT_IMPORTANCE,
  SOURCE_DISPOSITION_TYPE
} from "./constants.js";
import { newCandidateId, normalizeSourceDisposition } from "./audit.js";
import {
  applyMemoryPatch,
  extractMentionsFromText,
  selectRelevantMemory
} from "./story-memory.js";
import { buildCoverageWindows } from "./windows.js";

const SYSTEM = [
  "你是剧本杀主持手册「高召回覆盖阅读」助手（Stage 3A Pass 1）。",
  "只根据当前 SourceSections 抽取 EventCandidate；禁止脑补角色本/线索/机制。",
  "高召回：CORE/SUPPORTING/DETAIL 都要保留，只要原文明确发生且有助于理解剧情。",
  "禁止因为 DETAIL 就删。禁止微动作流水账（走过去/抬手）。",
  "每个当前窗口内的 sourceSectionId 必须有 sourceDisposition（即使无时间线内容也要标 RULE/META/ATMOSPHERE/NO_TIMELINE_CONTENT）。",
  "只输出 JSON：",
  JSON.stringify({
    events: [
      {
        candidateId: "optional",
        title: "",
        summary: "",
        stageId: null,
        temporalHint: null,
        participantNames: [],
        locationHint: null,
        importance: "CORE|SUPPORTING|DETAIL",
        sourceSectionIds: [],
        confidence: "HIGH|MEDIUM|LOW",
        evidenceQuote: ""
      }
    ],
    memoryPatch: {
      addEvents: [],
      updateEvents: [],
      addCharacters: [],
      addLocations: [],
      addTemporalConstraints: [],
      resolveQuestions: [],
      addQuestions: []
    },
    sourceDispositions: [
      {
        sourceSectionId: "",
        type: "TIMELINE|BACKGROUND|RULE|META|ATMOSPHERE|SUMMARY|NO_TIMELINE_CONTENT",
        linkedCandidateIds: [],
        reason: null
      }
    ]
  })
].join("\n");

function clean(s, max = 400) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const IMPORTANCE = new Set(Object.values(EVENT_IMPORTANCE));
const CONF = new Set(Object.values(CONFIDENCE));

export function normalizeEventCandidates(rawEvents, validSectionIds) {
  const out = [];
  for (const raw of rawEvents || []) {
    if (!raw || typeof raw !== "object") continue;
    const title = clean(raw.title, 80);
    const summary = clean(raw.summary, 500);
    if (!title || !summary) continue;
    const sourceSectionIds = [
      ...new Set(
        (Array.isArray(raw.sourceSectionIds) ? raw.sourceSectionIds : [])
          .map((id) => String(id || "").trim())
          .filter((id) => id && validSectionIds.has(id))
      )
    ];
    if (!sourceSectionIds.length) continue;

    let importance = String(raw.importance || "").toUpperCase();
    if (!IMPORTANCE.has(importance)) importance = EVENT_IMPORTANCE.SUPPORTING;
    let confidence = String(raw.confidence || "").toUpperCase();
    if (!CONF.has(confidence)) confidence = CONFIDENCE.MEDIUM;

    out.push({
      candidateId: clean(raw.candidateId, 48) || newCandidateId(),
      title,
      summary,
      stageId: raw.stageId || null,
      temporalHint: clean(raw.temporalHint, 80) || null,
      participantNames: Array.isArray(raw.participantNames)
        ? raw.participantNames.map((n) => clean(n, 40)).filter(Boolean).slice(0, 12)
        : [],
      locationHint: clean(raw.locationHint, 40) || null,
      importance,
      sourceSectionIds,
      sourceRefs: sourceSectionIds.map((sid) => ({ sourceSectionId: sid })),
      confidence,
      evidenceQuote: clean(raw.evidenceQuote, 200) || null
    });
  }
  return out;
}

function previousLocalContext(prevCandidates, limit = 5) {
  return (prevCandidates || []).slice(-limit).map((c) => ({
    candidateId: c.candidateId,
    title: c.title,
    summary: clean(c.summary, 120),
    temporalHint: c.temporalHint
  }));
}

export async function runPass1CoverageRead(input, {
  globalStoryMap,
  storyMemory,
  requestJson,
  windowSize = 6,
  overlap = 2,
  onWindow
} = {}) {
  const sections = input.hostSourceSections || [];
  const windows = buildCoverageWindows(sections, { windowSize, overlap });
  let memory = storyMemory;
  const allCandidates = [];
  const allDispositions = [];
  const usages = [];
  const seenCandKeys = new Set();

  if (!windows.length) {
    return {
      candidates: [],
      sourceDispositions: [],
      storyMemory: memory,
      windows: 0,
      usages
    };
  }

  if (!requestJson) {
    if (!deepseekConfig().configured) throw new Error("DEEPSEEK_NOT_CONFIGURED");
    const { requestDeepseekJson } = await import("../../deepseek-client.js");
    requestJson = requestDeepseekJson;
  }

  for (const win of windows) {
    const validIds = new Set(win.sectionIds);
    const windowText = win.sections.map((s) => s.originalText || "").join("\n");
    const mentions = extractMentionsFromText(
      windowText,
      (input.projectMeta?.characters || []).map((c) => c.name)
    );
    const stageId =
      win.sections.find((s) => s.stageId)?.stageId ||
      input.confirmedStageSchema?.items?.[0]?.id ||
      null;

    const relevantMemory = selectRelevantMemory(memory, {
      stageId,
      mentionedCharacters: mentions.mentionedCharacters,
      mentionedLocations: mentions.mentionedLocations,
      recentEventLimit: 8
    });

    const user = {
      instruction:
        "高召回抽取本窗口事件；每个当前 SourceSection 必须有 disposition；可引用 GlobalStoryMap 与 Memory，但事件必须有本窗口 sourceRefs。",
      globalStoryMap,
      relevantStoryMemory: relevantMemory,
      previousLocalContext: previousLocalContext(allCandidates),
      confirmedStageSchema: input.confirmedStageSchema
        ? { items: input.confirmedStageSchema.items }
        : null,
      currentSourceSections: win.sections.map((s) => ({
        id: s.id,
        stageId: s.stageId || null,
        headingPath: s.headingPath || [],
        text: String(s.originalText || "").slice(0, 3500)
      }))
    };

    const result = await requestJson(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(user) }
      ],
      {
        temperature: 0.15,
        maxTokens: 7000,
        timeoutMs: Math.min(deepseekConfig().timeoutMs, 180000),
        phase: "compiler-v2-stage3a-v2-pass1-coverage",
        context: { window: win.index, sections: win.sections.length }
      }
    );
    if (result.usage) usages.push(result.usage);

    const candidates = normalizeEventCandidates(result.value?.events, validIds);
    for (const c of candidates) {
      const key = `${c.title}|${c.sourceSectionIds.join(",")}`;
      if (seenCandKeys.has(key)) continue;
      seenCandKeys.add(key);
      allCandidates.push(c);
    }

    for (const raw of result.value?.sourceDispositions || []) {
      const d = normalizeSourceDisposition(raw, validIds);
      if (d) allDispositions.push(d);
    }

    memory = applyMemoryPatch(memory, {
      ...(result.value?.memoryPatch || {}),
      lastProcessedSourceIds: win.sectionIds
    });

    if (typeof onWindow === "function") {
      onWindow({
        window: win.index,
        total: windows.length,
        candidates: candidates.length,
        usage: result.usage
      });
    }
  }

  // Merge dispositions by section (last write wins, prefer TIMELINE)
  const dispById = new Map();
  for (const d of allDispositions) {
    const prev = dispById.get(d.sourceSectionId);
    if (!prev || d.type === SOURCE_DISPOSITION_TYPE.TIMELINE) {
      dispById.set(d.sourceSectionId, d);
    }
  }

  return {
    candidates: allCandidates,
    sourceDispositions: [...dispById.values()],
    storyMemory: memory,
    windows: windows.length,
    usages
  };
}
