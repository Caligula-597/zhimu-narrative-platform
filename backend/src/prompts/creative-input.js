import { cleanText } from "./shared.js";

export function validateCreativeSetting(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const chapterCount = Math.max(3, Math.min(5, Number(value.chapterCount) || 5));
  const wordsPerChapter = Math.max(2000, Math.min(12000, Number(value.wordsPerChapter) || 8000));
  return {
    theme: cleanText(value.theme, 120),
    playerCount: Math.max(4, Math.min(8, Number(value.playerCount) || 6)),
    chapterCount,
    wordsPerChapter,
    extraConflicts: cleanText(value.extraConflicts, 3000),
    tone: cleanText(value.tone, 800)
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
    setting.tone ? `场景基调：${setting.tone}` : null,
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
