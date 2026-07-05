import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import { resolveKillerAwareness } from "./matrix-killer-awareness.js";
import { buildMatrixModeProfile, formatMatrixCreativePromptBlock } from "./matrix-2-mode.js";

export const NOVEL_LAYER_VERSION = "matrix-2.0";

/**
 * After truth bible: write a complete god-view mystery novel (source manuscript).
 * This is NOT player-facing — scripts are extracted from it with POV limits.
 */
export function buildReasoningNovelMessages({
  setting,
  synopsis,
  config,
  truthBible,
  styleCard,
  characterArchives
}) {
  const killerAwareness = resolveKillerAwareness(setting);
  const modeProfile = buildMatrixModeProfile(setting);
  const creativeBlock = formatMatrixCreativePromptBlock(setting, styleCard);
  const awarenessNote =
    killerAwareness === "self-aware"
      ? "凶手位**自知**是真凶：长篇中写清其隐瞒/误导行为，供后续摘取「隐瞒任务」剧本；非凶角色须有可观察矛盾指向真凶行为。"
      : "凶手位**不自知**：长篇中真凶心理与无辜者一样可被误导；不得写任何角色内心确证「我是凶手」。";
  const system = `你是剧本杀「推理长篇主笔 · Matrix 2.0」。根据 L1 真相 Bible 写**完整推理小说**（HOST 视角源稿，供分幕摘取）。

${PRODUCT_BOUNDARY}

${creativeBlock}

【模式 · ${modeProfile.label}】
${modeProfile.key === "henkaku" ? "- 可写超自然现象，但须与 L1 supernaturalRules 一致，且 L2 须留可观察锚点。" : "- 本格：禁止超自然；所有现象物理可解释。"}

【凶手自知 · ${killerAwareness === "self-aware" ? "自知" : "不自知"}】
${awarenessNote}
- 长篇须清晰区分 L2 公共事件 vs 各角色 L3 主观（标注在 characterNotes 供摘取）。
- 误导线须可解释；L5 表层/深层目标行为可追溯。

【写作任务】
- 覆盖全部 ${config.chapterKeys?.length || 3} 幕；文风遵循预设；禁止跑团规则说明。

【输出 schema】
{
  "title": "小说标题",
  "synopsis": "200～400 字梗概",
  "acts": [{"actKey":"ch1","title":"幕标题","body":"该幕正文（800～2000 字）","publicEnvironment":"L2 公共环境摘要"}],
  "characterArcs": [{"roleKey":"role-1","arc":"行为弧（100～200 字）"}],
  "suggestions": ["复核建议"]
}`;

  const user = `请撰写推理长篇。幕 keys：${JSON.stringify(config.chapterKeys)}。

${creativeInputUserBlocks(setting, synopsis)}
${untrustedUserPayload("真相 Bible", truthBible)}
${characterArchives?.roles?.length ? untrustedUserPayload("角色名单（key 对齐）", (characterArchives.roles || []).map((r) => ({ key: r.key, name: r.name }))) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function validateReasoningNovel(raw, config) {
  const value = raw && typeof raw === "object" ? raw : {};
  const acts = Array.isArray(value.acts) ? value.acts : [];
  const keys = config?.chapterKeys || [];
  return {
    title: cleanText(value.title, 120),
    synopsis: cleanText(value.synopsis, 800),
    acts: keys.map((actKey, i) => {
      const found = acts.find((a) => a.actKey === actKey) || acts[i] || {};
      return {
        actKey,
        title: cleanText(found.title, 120),
        body: cleanText(found.body, 12000)
      };
    }),
    characterArcs: Array.isArray(value.characterArcs)
      ? value.characterArcs.map((a) => ({
          roleKey: cleanText(a.roleKey, 32),
          arc: cleanText(a.arc, 600)
        }))
      : [],
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.map((s) => cleanText(s, 200)) : []
  };
}
