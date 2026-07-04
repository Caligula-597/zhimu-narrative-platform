import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { formatPromptBlock } from "./matrix-prompt-engine.js";

export function buildActionLogMessages({ publicActionBrief, roleKey, actKey, targetWords, spoilerContract, roleRoster }) {
  const system = `你是剧本杀「客观行动日志」记录员。只输出可被监控拍到的物理行为。

${PRODUCT_BOUNDARY}

【硬性禁止】
- 禁止心理描写（感到/想起/心里/害怕/犹豫/清楚/必须/不敢）
- 禁止动机解释、手法、认罪、推测
- 禁止 forbiddenFacts 中的任何语义
- 禁止情感形容词（震惊/解脱/紧张）— 情感由另一通道注入

【允许】
- 时间 + 位置 + 物理动作（走、站、开、关、拿、放）
- 第二人称「你」串联成短段落

输出 JSON：
{
  "entries": [{"time":"20:05","action":"进入通讯室"}],
  "narrative": "20:05 你进入通讯室……（仅物理行为，约 ${Math.round(targetWords * 0.45)} 字）"
}`;

  const user = `角色 ${roleKey} / ${actKey} 客观行动日志。

${formatPromptBlock("publicActionBrief", publicActionBrief)}
${formatPromptBlock("spoilerContract", spoilerContract)}
${formatPromptBlock("roleRoster", roleRoster)}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function buildDialogueLogMessages({
  publicActionBrief,
  roleKey,
  actKey,
  targetWords,
  spoilerContract,
  roleRoster,
  clueLedger,
  peerScriptDigest
}) {
  const system = `你是剧本杀「公聊与观察记录」记录员。只输出对话与可观察行为。

${PRODUCT_BOUNDARY}

【硬性禁止】
- 禁止内心解读、动机推断、flashback
- 禁止出现未在 clueLedger 公开的物证实体名（细线/暗格/走私记录/机关/钥匙胚/旋转开关 等）
- 观察只能用「（观察到）某人做了某可见动作」，禁止写物品专有线索名

【允许】
- 角色之间的公开对话（引号标注）
- （观察到）他人可见行为：语速、姿态、回避目光 — 不含物证名称

输出 JSON：
{
  "dialogues": [{"speaker":"姓名","line":"公开台词"}],
  "observations": [{"target":"姓名","note":"可见行为，不含物证专名"}],
  "narrative": "第二人称串联（约 ${Math.round(targetWords * 0.45)} 字）"
}`;

  const user = `角色 ${roleKey} / ${actKey} 公聊与观察记录。

${formatPromptBlock("publicActionBrief", publicActionBrief)}
${formatPromptBlock("spoilerContract", spoilerContract)}
${formatPromptBlock("roleRoster", roleRoster)}
${formatPromptBlock("clueLedger", clueLedger)}
${peerScriptDigest?.length ? formatPromptBlock("peerScriptDigest", peerScriptDigest) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
