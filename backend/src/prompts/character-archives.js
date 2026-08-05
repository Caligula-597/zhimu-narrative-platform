import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import { styleCardForPrompt } from "./matrix-literary-styles.js";

export function buildCharacterArchivesMessages({ setting, synopsis, config, truthBible, styleCard }) {
  const system = `你是多人剧本杀「角色秘密档案」策划师。基于真相 Bible 为每位角色建立档案，不写长篇正文。

${PRODUCT_BOUNDARY}

【任务】
- 输出恰好 ${config.playerCount} 位角色，key 为 role-1 … role-N；name 格式「姓名 · 身份」。
- 每位角色必须有：publicIdentity、pronouns、hiddenIdentity、motive、relationships、timelineActions、lies（3 条）、innerConflict、voiceHints、actTasks（每幕 2～3 条 tasks + tips）。
- pronouns 只能填「他」「她」或「TA」，后续所有幕必须保持一致。
- voiceHints 须写清**说话与感官**（5 行以内）：register（ blunt/文绉/快嘴等）、taboos（绝不说的话）、catchphrases（1～2 个口癖）、sampleLine（一句典型台词）、sensoryFilter（写心理时常用的职业感官，如「满手机油」「账本纸边」「玻璃瓶壁打滑」）。不同角色 register 与 sensoryFilter 必须互不相同。
- actTasks.tasks 必须可执行、可公聊；禁止写「找出真凶」这类终局任务放在第一幕。
- 不得泄露 spoilerGates 中本幕 forbiddenFacts；真凶角色的 actTasks 不得含「认罪」。

【输出 schema】
{
  "roles": [{
    "key": "role-1",
    "name": "姓名 · 身份",
    "publicIdentity": "公开身份",
    "pronouns": "他/她/TA",
    "hiddenIdentity": "隐藏身份/秘密",
    "motive": "动机",
    "relationships": "与其他角色暗线",
    "timelineActions": "案件时间线上的真实行动",
    "lies": ["谎言1","谎言2","谎言3"],
    "innerConflict": "性格深层矛盾",
    "voiceHints": "register: …\\ntaboos: …\\ncatchphrases: …\\nsampleLine: 「…」\\nsensoryFilter: …",
    "actTasks": [{"actKey":"ch1","tasks":["本幕任务"],"tips":"【提示】可选"}]
  }],
  "suggestions": ["写作注意"]
}`;
  const user = `请生成角色秘密档案。幕 key：${JSON.stringify(config.chapterKeys)}。

${creativeInputUserBlocks(setting, synopsis)}
${untrustedUserPayload("真相 Bible", truthBible)}
${styleCard ? untrustedUserPayload("风格规则", styleCardForPrompt(styleCard)) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
