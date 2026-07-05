import { cleanText } from "./shared.js";
import { resolveLiteraryStyleKey, resolveMysteryStyleKey, LITERARY_STYLE_PRESETS, MYSTERY_STYLE_PRESETS } from "./matrix-literary-styles.js";
import { resolveKillerAwareness } from "./matrix-killer-awareness.js";
import { resolveMatrixMode, buildMatrixModeProfile } from "./matrix-2-mode.js";
import { resolveEraPreset, buildEraSettingCard } from "./matrix-era-setting.js";

export function validateCreativeSetting(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const chapterCount = Math.max(3, Math.min(5, Number(value.chapterCount) || 5));
  const wordsPerChapter = Math.max(2000, Math.min(12000, Number(value.wordsPerChapter) || 8000));
  const volumeTier = ["demo", "standard", "epic"].includes(value.volumeTier) ? value.volumeTier : "standard";
  const literaryStyle = resolveLiteraryStyleKey(value.literaryStyle || value.stylePreset || "cinematic");
  const mysteryStyle = resolveMysteryStyleKey(value.mysteryStyle || "christie-holmes");
  const killerAwareness = resolveKillerAwareness(value);
  const matrixMode = resolveMatrixMode(value.matrixMode || value);
  const eraPreset = resolveEraPreset(value.eraPreset || value);
  const modeProfile = buildMatrixModeProfile({ matrixMode });
  const eraCard = buildEraSettingCard({ eraPreset, eraNotes: value.eraNotes });
  return {
    theme: cleanText(value.theme, 120),
    playerCount: Math.max(4, Math.min(8, Number(value.playerCount) || 6)),
    chapterCount,
    wordsPerChapter,
    extraConflicts: cleanText(value.extraConflicts, 3000),
    volumeTier,
    pov: value.pov === "first" ? "first" : "second",
    literaryStyle,
    mysteryStyle,
    killerAwareness,
    matrixMode,
    eraPreset,
    eraNotes: cleanText(value.eraNotes, 800),
    matrixModeLabel: modeProfile.matrixModeLabel,
    eraLabel: eraCard.eraLabel,
    killerAwarenessLabel: killerAwareness === "self-aware" ? "凶手自知（隐瞒任务）" : "凶手不自知",
    literaryStyleLabel: LITERARY_STYLE_PRESETS[literaryStyle]?.label || literaryStyle,
    mysteryStyleLabel: MYSTERY_STYLE_PRESETS[mysteryStyle]?.label || mysteryStyle,
    forbiddenPhrases: cleanText(value.forbiddenPhrases, 1000),
    /** @deprecated use literaryStyle — ignored when literaryStyle set */
    tone: cleanText(value.tone, 800),
    /** @deprecated use literaryStyle presets */
    styleAnchor: cleanText(value.styleAnchor, 2000)
  };
}

export function validateSynopsisInput(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    body: cleanText(value.body, 12000),
    charactersSketch: cleanText(value.charactersSketch, 4000),
    truthSketch: cleanText(value.truthSketch, 4000),
    redHerringsSketch: cleanText(value.redHerringsSketch, 2000)
  };
}

export function formatCreativeSettingBlock(setting) {
  const lines = [
    `主题：${setting.theme || "（未填）"}`,
    `玩家人数：${setting.playerCount}`,
    `章节数量：${setting.chapterCount}`,
    `每章节目标字数：${setting.wordsPerChapter}`,
    setting.literaryStyleLabel ? `文风预设：${setting.literaryStyleLabel}（${setting.literaryStyle || ""}）` : null,
    setting.mysteryStyleLabel ? `悬疑参照：${setting.mysteryStyleLabel}` : null,
    setting.matrixModeLabel ? `Matrix 模式：${setting.matrixModeLabel}` : null,
    setting.eraLabel ? `时代背景：${setting.eraLabel}（${setting.eraPreset || ""}）` : null,
    setting.killerAwarenessLabel ? `凶手自知：${setting.killerAwarenessLabel}` : null,
    setting.volumeTier ? `体量档位：${setting.volumeTier}` : null,
    setting.pov ? `叙述视角：${setting.pov === "first" ? "第一人称" : "第二人称"}` : null,
    setting.forbiddenPhrases ? `禁用词：\n${setting.forbiddenPhrases}` : null,
    setting.extraConflicts ? `额外的矛盾冲突：\n${setting.extraConflicts}` : null
  ].filter(Boolean);
  return lines.join("\n");
}

export function formatSynopsisBlock(synopsis) {
  const parts = [];
  if (synopsis.body) parts.push(`【纲要正文】\n${synopsis.body}`);
  if (synopsis.charactersSketch) parts.push(`【人物关系（选填）】\n${synopsis.charactersSketch}`);
  if (synopsis.truthSketch) parts.push(`【真相概要（选填）】\n${synopsis.truthSketch}`);
  if (synopsis.redHerringsSketch) parts.push(`【误导线（选填）】\n${synopsis.redHerringsSketch}`);
  return parts.join("\n\n") || "（未填写剧情纲要）";
}

export function creativeInputUserBlocks(setting, synopsis) {
  return `【创作设定】（作者原始输入，必须尊重）\n${formatCreativeSettingBlock(setting)}\n\n【剧情纲要】（作者原始输入，不得偏离核心意图）\n${formatSynopsisBlock(synopsis)}`;
}
