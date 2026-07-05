import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { formatPromptBlock } from "./matrix-prompt-engine.js";
import { buildWritingStyleBlock } from "./matrix-writing-style.js";
import { formatLiteraryStyleBlock } from "./matrix-literary-styles.js";

export function buildActionLogMessages({
  publicActionBrief,
  roleKey,
  actKey,
  targetWords,
  spoilerContract,
  roleRoster,
  entityUnlockContract,
  isKiller = false,
  actIndex = 0,
  finalActIndex = 0,
  styleCard = null,
  killerAwareness = "self-aware"
}) {
  const styleBlock = buildWritingStyleBlock({
    channel: "action",
    isKiller,
    actIndex,
    finalActIndex,
    killerAwareness
  });
  const literaryBlock = styleCard ? formatLiteraryStyleBlock(styleCard) : "";
  const system = `你是剧本杀「私人本 · 经历段」主笔。写本幕**你经历了什么**（第二人称「你」），像可读的玩家剧本，不是监控日志。

${PRODUCT_BOUNDARY}

${literaryBlock}

${styleBlock}

【硬性禁止 — 仅剧透/公平】
- 禁止 forbiddenFacts、作案手法自白、公开认罪
- **非凶手（isKiller=false）终幕禁止完整杀人供述**：不可写「我注射/投毒/通过机关杀害/密室是我所设」；仅可承认与己相关的隐瞒或蠢事（偷物、私会、非致死安眠药等），并明确否认杀人
- 禁止未授权物证专名 — 严格遵循 entityUnlockContract（未解锁用指代）

${entityUnlockContract?.promptBlock || ""}

【时间 — 不要写死】
- 用先后：随后 / 这时 / 回大厅后 / 入夜后 — **不要**每句一个 HH:MM 钟点
- 全幕至多 1～2 个模糊时间锚点；entries.time 可填「入夜后」等相对词，勿填 21:05 流水账

【任务-行为咬合 — 必填】
- matrixRow.tasks 中每个任务（「解释是否去过…」「是否公开…」）须在 entries/narrative 有对应物理动作或对白，禁止任务写仓库/书房而正文无相关行动。

【允许】
- 场景、动作、环境、他人可见行为
- 短句文学性叙述；心理细节主要放在公聊段

输出 JSON：
{
  "entries": [{"time":"入夜后","action":"随众人退回大厅"}],
  "narrative": "你随众人退回大厅……（约 ${Math.round(targetWords * 0.4)} 字，相对顺序，少钟点）"
}`;

  const user = `角色 ${roleKey} / ${actKey} 经历段。

${formatPromptBlock("publicActionBrief", publicActionBrief)}
${formatPromptBlock("spoilerContract", spoilerContract)}
${entityUnlockContract ? formatPromptBlock("entityUnlockContract", { promptBlock: entityUnlockContract.promptBlock }) : ""}
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
  entityUnlockContract,
  peerScriptDigest,
  isKiller = false,
  actIndex = 0,
  finalActIndex = 0,
  styleCard = null,
  killerAwareness = "self-aware"
}) {
  const styleBlock = buildWritingStyleBlock({
    channel: "dialogue",
    isKiller,
    actIndex,
    finalActIndex,
    killerAwareness
  });
  const literaryBlock = styleCard ? formatLiteraryStyleBlock(styleCard) : "";
  const system = `你是剧本杀「私人本 · 公聊与心理段」主笔。写公开对话 + **你的心思** — 多人向私人本有心理描写很正常。

${PRODUCT_BOUNDARY}

${literaryBlock}

${styleBlock}

【硬性禁止 — 仅剧透/公平】
- 禁止 forbiddenFacts、独家关键事实（「只有我看见…」）
- 禁止未在 clueLedger 公开的物证专名 — 遵循 entityUnlockContract

${entityUnlockContract?.promptBlock || ""}
- 禁止写死「X 就是凶手」的定论（第三幕前）

【允许 — 私人本常态】
- 对话（引号）+ 你听见后的想法、怀疑、不安、误判
- 对他人的观察与推理疑问；相对时间（「刚才」「回大厅后」）

输出 JSON：
{
  "dialogues": [{"speaker":"姓名","line":"公开台词"}],
  "observations": [{"target":"姓名","note":"可见行为或你的疑问"}],
  "narrative": "串联公聊与心理（约 ${Math.round(targetWords * 0.55)} 字；可写心想、怀疑，相对时间）"
}`;

  const user = `角色 ${roleKey} / ${actKey} 公聊与心理段。

${formatPromptBlock("publicActionBrief", publicActionBrief)}
${formatPromptBlock("spoilerContract", spoilerContract)}
${formatPromptBlock("roleRoster", roleRoster)}
${formatPromptBlock("clueLedger", clueLedger)}
${entityUnlockContract ? formatPromptBlock("entityUnlockContract", { actKey: entityUnlockContract.actKey, schedule: entityUnlockContract.schedule?.slice(0, 12) }) : ""}
${peerScriptDigest?.length ? formatPromptBlock("peerScriptDigest", peerScriptDigest) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
