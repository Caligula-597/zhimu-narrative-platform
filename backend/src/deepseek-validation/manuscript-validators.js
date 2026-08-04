import { throwErr } from "../api-errors.js";
import { cleanText } from "../prompts/shared.js";
import { assertArray } from "./primitives.js";

const MIN_CHAPTER_NARRATIVE_CHARS = 2000;

export function chapterNarrativeMinChars(setting, config) {
  const target = setting?.wordsPerChapter || Math.floor((config?.targetWordCount || 8000) / Math.max(config?.chapterCount || 1, 1));
  return Math.max(MIN_CHAPTER_NARRATIVE_CHARS, Math.floor(target * 0.45));
}

function parseChapterNarrative(raw, spec, chapterKey) {
  const value = raw && typeof raw === "object" ? raw : {};
  const key = cleanText(value.chapterKey || chapterKey, 40);
  if (!spec.chapterKeys.includes(key)) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `章节 key 必须是 ${spec.chapterKeys.join("、")} 之一，实际为 ${key}`, { chapterKey: key, expectedKeys: spec.chapterKeys });
  }
  const narrativeBody = cleanText(value.narrativeBody, 120000);
  if (!narrativeBody) throwErr("DEEPSEEK_OUTPUT_INVALID", "AI 返回的总剧情正文为空", { chapterKey: key });
  return {
    chapterKey: key,
    title: cleanText(value.title, 120) || key,
    summary: cleanText(value.summary, 600),
    narrativeBody,
    hostNotes: cleanText(value.hostNotes, 2000),
    openThreads: Array.isArray(value.openThreads) ? value.openThreads.slice(0, 8).map((item) => cleanText(item, 300)) : [],
    resolvedThreads: Array.isArray(value.resolvedThreads) ? value.resolvedThreads.slice(0, 8).map((item) => cleanText(item, 300)) : [],
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.slice(0, 8).map((item) => cleanText(item, 500)) : []
  };
}

export function validateChapterNarrative(raw, spec, chapterKey, minChars = MIN_CHAPTER_NARRATIVE_CHARS) {
  const chapter = raw?.narrativeBody && raw?.chapterKey ? raw : parseChapterNarrative(raw, spec, chapterKey);
  if (chapter.narrativeBody.length < minChars) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `本章总剧情仅 ${chapter.narrativeBody.length} 字，未达到最低 ${minChars} 字要求`, {
      chapterKey: chapter.chapterKey,
      actualChars: chapter.narrativeBody.length,
      minChars
    });
  }
  return chapter;
}

export function validateManuscriptSynopsis(raw, proposal) {
  const value = raw && typeof raw === "object" ? raw : {};
  const overallManuscript = cleanText(value.overallManuscript, 8000);
  if (overallManuscript.length < 400) throwErr("DEEPSEEK_OUTPUT_INVALID", "AI 生成的剧本梗概过短");
  return {
    title: cleanText(value.title, 160) || proposal.title,
    summary: cleanText(value.summary, 1200) || proposal.logline,
    overallManuscript,
    logicNotes: assertArray(value.logicNotes ?? [], "logicNotes").slice(0, 12).map((item) => cleanText(item, 800))
  };
}
