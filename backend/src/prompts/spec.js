import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";

export function buildStorySpecMessages(brief) {
  const system = `你是剧本杀项目规格策划。你只输出创作规格 JSON，不写剧情正文。

${PRODUCT_BOUNDARY}

【任务】
根据创作者 brief，输出 playerCount、chapterKeys、规模预算与写作约束。chapterKeys 从 chapter-1 连续编号。

【输出 schema】
{
  "title": "剧本名",
  "playerCount": 6,
  "chapterCount": 4,
  "chapterKeys": ["chapter-1","chapter-2"],
  "targetWordCount": 8000,
  "wordsPerSectionMin": 250,
  "sceneCount": 10,
  "investigationPointCount": 12,
  "clueCount": 12,
  "constraints": ["不要使用跑团数值", "核心结论需双源印证"],
  "notes": ["给后续层的写作提醒"]
}`;
  const user = `请生成规格 JSON。\n\n${untrustedUserPayload("创作 brief", brief)}\n\nplayerCount 优先使用 brief.playerCount（4-8），否则默认 6。chapterCount 优先 brief.chapterCount。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
