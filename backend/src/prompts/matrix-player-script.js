import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";

export function buildMatrixPlayerScriptMessages({
  setting,
  synopsis,
  config,
  styleCard,
  truthBible,
  characterArchive,
  matrixRow,
  actKey,
  roleKey,
  targetWords,
  pov = "second"
}) {
  const povRule = pov === "first"
    ? "使用第一人称「我」，沉浸式。"
    : "使用第二人称「你」，沉浸式（剧本杀玩家本风格）。";
  const forbidden = [
    ...(matrixRow?.forbidden ? [matrixRow.forbidden] : []),
    ...((truthBible?.spoilerGates || []).find((g) => g.actKey === actKey)?.forbiddenFacts || [])
  ].filter(Boolean);
  const system = `你是线上剧本杀私人本主笔。你只写**一位角色、一个幕**的玩家阅读正文。

${PRODUCT_BOUNDARY}

【硬性规则】
- ${povRule}
- 目标约 ${targetWords} 字（可 ±15%）。
- 严格基于角色档案与本幕信息矩阵行；禁止泄露 forbidden 列表中的真相。
- 埋入 2 处指向其他角色的误导；1 处与自身 secret 相关的心理挣扎。
- 结尾落在本幕 tasks 与对他人的具体怀疑（closingHook）。
- 禁止 Markdown；输出 JSON。

【输出 schema】
{
  "roleKey": "${roleKey}",
  "actKey": "${actKey}",
  "title": "分幕标题",
  "body": "正文",
  "tasks": ["本幕任务1","本幕任务2"],
  "closingHook": "结尾怀疑/悬念",
  "suggestions": ["作者复核"]
}`;
  const user = `请撰写 ${roleKey} 在 ${actKey} 的私人本。

${creativeInputUserBlocks(setting, synopsis)}
${untrustedUserPayload("角色档案", characterArchive)}
${untrustedUserPayload("本幕信息矩阵", matrixRow)}
${forbidden.length ? untrustedUserPayload("本幕禁止泄露", forbidden) : ""}
${styleCard ? untrustedUserPayload("风格卡", styleCard) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function buildMatrixDeAiPassMessages({ body, styleCard, targetWords }) {
  const system = `你是中文剧本杀文字编辑。对 AI 腔进行改写，不改变情节事实。

${PRODUCT_BOUNDARY}

- 保持长度约 ${targetWords} 字。
- 缩短句长；减少「然而、不禁、内心深处、这一刻」等套话。
- 输出 JSON：{"body":"改写后正文","suggestions":[]}`;
  const user = `请去 AI 腔改写以下正文：

${untrustedUserPayload("正文", { body: cleanText(body, 12000) })}
${styleCard ? untrustedUserPayload("风格卡", styleCard) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
