/**
 * Killer self-awareness mode — whether the killer player knows they are the murderer.
 * self-aware: killer conceals; innocents get contradiction/suspicion hooks.
 * self-unaware: killer like innocent; misleading clues OK but must be traceable.
 */
import { cleanText } from "./shared.js";

export const KILLER_AWARENESS_KEYS = ["self-aware", "self-unaware"];

export function resolveKillerAwareness(setting = {}) {
  const raw = cleanText(setting.killerAwareness || setting.killerKnowsTruth, 40);
  if (raw === "self-unaware" || raw === "false" || raw === "0" || raw === "不知") return "self-unaware";
  if (raw === "self-aware" || raw === "true" || raw === "1" || raw === "自知") return "self-aware";
  return "self-aware";
}

export function isKillerSelfAware(setting = {}) {
  return resolveKillerAwareness(setting) === "self-aware";
}

export function buildKillerAwarenessContract({
  killerAwareness,
  roleKey,
  killerRoleKey,
  actIndex = 0,
  finalActIndex = 0
}) {
  const isKiller = killerRoleKey && roleKey === killerRoleKey;
  const isInnocent = killerRoleKey && roleKey !== killerRoleKey;
  const early = actIndex < finalActIndex;
  const mode = killerAwareness === "self-unaware" ? "self-unaware" : "self-aware";

  const rules = [];

  if (mode === "self-aware") {
    rules.push(
      "【全局】凶手位玩家**自知**是真凶：全剧任务核心是隐瞒身份、误导他人、消除指向自己的证据。",
      "【全局】误导性线索允许，但每条须可追溯到动机、时间线或物证来源（fairness 有迹可循）。",
      "【全局】第三幕前任何角色正文/公聊不得写「X 就是凶手」的定论。"
    );
    if (isKiller && early) {
      rules.push(
        "【真凶自知 · 私人本】只有本人阅读：可以**很直白**地写「我是凶手 / 必须瞒住 / 我做了什么」— 不作为剧透扣分项。",
        "【真凶自知 · 私人本】任务=隐瞒；内心、规定情绪可直写作案者视角。",
        "【真凶自知 · 对外】公聊/对话仍是撒谎、辩解、观察他人 — 不在公开场合自白。",
        "【真凶自知 · 禁】forbiddenFacts 中尚未解锁的手法专名仍禁出现在可被公开讨论复述的段落。"
      );
    }
    if (isInnocent && early) {
      rules.push(
        "【非凶 · 本幕】须埋入至少 1 处**可观察矛盾**或**怀疑引导**（时间对不上、说法与行为不符、过度防御），指向真凶的**行为**而非直接点名。",
        "【非凶 · 本幕】不得全知真凶身份；怀疑必须来自本幕已知线索或亲眼观察。"
      );
    }
  } else {
    rules.push(
      "【全局】凶手位玩家**不自知**是真凶：凶手剧本与无辜者同等——不得出现「我是凶手」「我做了什么」的内心确证。",
      "【全局】禁止任何角色剧本直接描述「某人是凶手」；只允许怀疑方向、矛盾、动机讨论。",
      "【全局】误导性线索**必须**有迹可循：每条须附带可解释的动机、时间锚点或来源（亲眼/转述/线索卡）。",
      "【全局】真凶位也可以有错误理解（misbeliefs），与其他人一样被红鲱鱼误导。"
    );
    if (isKiller) {
      rules.push(
        "【真凶不自知 · 本幕】按无辜者标准写：只写你能合理解释来源的信息；禁止作案回忆、碰凶器、担心杀人败露。",
        "【真凶不自知 · 本幕】若感到不安，只能归因于「与死者有过节怕被怀疑」等，不得归因于作案本身。"
      );
    }
    if (isInnocent) {
      rules.push(
        "【非凶 · 本幕】可记录指向各嫌疑人的**表象矛盾**；不得写死真凶，不得全知。"
      );
    }
  }

  return {
    mode,
    modeLabel: mode === "self-aware" ? "凶手自知（隐瞒任务）" : "凶手不自知（同 innocent）",
    isKiller,
    isInnocent,
    rules
  };
}

export function killerFeelingEmotionForAct({ killerAwareness, actKey, actIndex, finalActIndex, isKiller }) {
  if (!isKiller || actIndex >= finalActIndex) return null;
  if (killerAwareness === "self-unaware") return null;
  const byAct = {
    ch1: "你是凶手。本幕只有你能看到这句话——保持低调，别让人盯上你。",
    ch2: "你是凶手，必须瞒住。引导怀疑到别人身上，别让他们抓到把柄。",
    ch3: "终幕前仍须控场，留意谁握有你最怕被人知道的事。"
  };
  return byAct[actKey] || byAct.ch2;
}
