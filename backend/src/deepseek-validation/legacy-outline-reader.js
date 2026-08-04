import { throwErr } from "../api-errors.js";
import { cleanText } from "../prompts/shared.js";
import { validateStoryOutlineV2 } from "../outline-quality-validator.js";
import { assertArray } from "./primitives.js";

export function validateStoryOutline(raw, spec, { strict = false, brief = null } = {}) {
  const value = raw && typeof raw === "object" ? raw : {};
  const outlineRevision = cleanText(value.outlineRevision, 20);
  if (strict) return validateStoryOutlineV2(value, spec, { brief });
  if (["2.2", "2.3", "2.4"].includes(outlineRevision)) {
    const beats = assertArray(value.chapterBeats ?? [], "chapterBeats");
    if (!beats.length) throwErr("DEEPSEEK_OUTPUT_INVALID", "AI 大纲缺少 chapterBeats");
    const expectedChapterKeys = new Set(spec.chapterKeys);
    const receivedChapterKeys = new Set(beats.map((beat) => cleanText(beat?.chapterKey, 80)).filter(Boolean));
    if (receivedChapterKeys.size !== expectedChapterKeys.size
      || [...expectedChapterKeys].some((key) => !receivedChapterKeys.has(key))) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", "AI 大纲章节 key 与生成规格不一致");
    }
    return value;
  }
  const legacyVersion = Number(value.outlineVersion) >= 2 ? 2 : 1;
  const chapterKeys = new Set(spec.chapterKeys);
  const beats = assertArray(value.chapterBeats ?? [], "chapterBeats").slice(0, 12).map((beat, index) => ({
    chapterKey: chapterKeys.has(beat.chapterKey) ? beat.chapterKey : spec.chapterKeys[index] || `chapter-${index + 1}`,
    title: cleanText(beat.title, 120) || `第 ${index + 1} 章`,
    goal: cleanText(beat.goal, 600),
    turn: cleanText(beat.turn, 600),
    hostNotes: cleanText(beat.hostNotes, 800)
  }));
  if (!beats.length) throwErr("DEEPSEEK_OUTPUT_INVALID", "AI 大纲缺少 chapterBeats");
  return {
    outlineVersion: legacyVersion,
    outlineRevision: outlineRevision || (legacyVersion === 2 ? "2.0" : "1.0"),
    logline: cleanText(value.logline, 600),
    truthTimeline: cleanText(value.truthTimeline, 4000),
    redHerrings: assertArray(value.redHerrings ?? [], "redHerrings").slice(0, 10).map((item) => cleanText(
      typeof item === "string" ? item : item?.falseTheory || item?.description || item?.key,
      400
    )),
    chapterBeats: beats,
    suggestions: assertArray(value.suggestions ?? [], "suggestions").slice(0, 12).map((item) => cleanText(item, 500)),
    readiness: {
      strictValidated: false,
      readyForExpansion: false,
      protocol: legacyVersion === 2 ? `legacy-outline-v${outlineRevision || "2.0"}` : "legacy-outline-v1",
      issues: [
        legacyVersion === 2
          ? `${outlineRevision || "V2.0"} 大纲仅兼容读取；必须重新生成或人工迁移后，才能通过 V2.2 的题材贡献、实体资源、失败分支、因果路径与结局可达性门禁`
          : "旧版大纲仅保证可读取，未验证六人角色、证据图、玩家行动与累计结局"
      ]
    }
  };
}
