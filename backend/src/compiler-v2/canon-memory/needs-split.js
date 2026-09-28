/**
 * Event granularity adapter + event-level reclassify (Promotion V1.2).
 * Boundary logic stays in EventBoundaryDetector — Promotion must not own it.
 */
export { detectNeedsSplitViaBoundary as detectNeedsSplit } from "./event-boundary-detector.js";
export { detectEventBoundary } from "./event-boundary-detector.js";

import { detectEventBoundary } from "./event-boundary-detector.js";

/**
 * Reclassify capsule events that are not world events into knowledge types.
 * V1.2: FACT | REVEAL | BRANCH(strict) | skip(META) | EVENT(+boundary)
 */
export function classifyCapsuleEvent(event = {}) {
  const title = String(event.title || "");
  const summary = String(event.summary || "");
  const text = `${title} ${summary}`;

  // META / INTRO / OUTRO → NONE
  if (
    /剧本.{0,8}简介|说明类型|人数.{0,6}时长|续作预告|宣告游戏结束|开本前|作者说明|版权所有|无实际剧情|无剧情推进|彩蛋段|结束语|主持人介绍规则和背景/.test(
      text
    )
  ) {
    return { type: null, skip: true, reason: "meta_intro_outro_none" };
  }

  // BRANCH — mutually exclusive endings only
  if (
    ((/结局|小剧场/.test(text) && /主持人|发放|存活|牺牲/.test(text)) ||
      (/生.*死|死.*生/.test(title) && /结局|小剧场|发放/.test(text)) ||
      (/死亡，.*存活|存活，.*死亡/.test(title) && /小剧场|主持人/.test(text))) &&
    !/简介|预告|续作|开本前|彩蛋/.test(text)
  ) {
    return {
      type: "BRANCH",
      title: title || "结局分支结果",
      summary,
      reason: "ending_branch_outcome"
    };
  }

  // CLUE_REVEAL → REVEAL (player/host obtains a fact at a moment)
  if (
    (/身份确认|确认.{0,12}身份|确认.{0,8}为|根据.{0,10}线索.{0,20}确认/.test(text) ||
      /揭示凶手|凶手是|明确.*凶手|杀死陶老板的凶手/.test(text) ||
      (/确认/.test(title) && /尸体|身份|凶手/.test(text))) &&
    !/吊灯|砸/.test(text) &&
    !/下毒|追杀|潜入|杀害后/.test(text)
  ) {
    return {
      type: "REVEAL",
      title: title.includes("揭示") || title.includes("确认") ? title : `揭示：${title}`,
      summary,
      reason: "clue_reveal"
    };
  }

  // STATIC_FACT → FACT (ongoing attribute, not a discrete world event)
  if (isStaticFact(title, summary, text)) {
    return {
      type: "FACT",
      title,
      summary,
      reason: "static_fact"
    };
  }

  if (/余生|终身未娶|不知所踪|后日谈|遁入空门/.test(text) && !/\d{1,2}\s*[:：]\s*\d{2}/.test(text)) {
    return {
      type: null,
      skip: true,
      reason: "epilogue_state"
    };
  }

  if (/砸死陶老板尸体/.test(title) && /尸体/.test(summary)) {
    const fixedTitle = title.includes("吊灯")
      ? title.replace("砸死陶老板尸体", "砸向陶老板的尸体")
      : "吊灯砸向陶老板的尸体";
    const boundary = detectEventBoundary({ title: fixedTitle, summary });
    return {
      type: "EVENT",
      title: fixedTitle,
      summary,
      needsSplit: boundary.needsSplit,
      splitReasons: boundary.signals.map((s) => s.kind),
      reason: "title_sanitized"
    };
  }

  const boundary = detectEventBoundary(event);
  return {
    type: "EVENT",
    title,
    summary,
    needsSplit: boundary.needsSplit,
    splitReasons: boundary.signals.map((s) => s.kind),
    reason: "world_event"
  };
}

/**
 * Sustained attribute / resemblance / standing relation — not a dated action beat.
 * Keep generic: no script-specific names required.
 */
function isStaticFact(title, summary, text) {
  const actionHeavy =
    /杀死|杀害|下毒|潜入|追|逃|砸|刺|葬|收养|抓捕|劫狱|传送|苏醒|被困|开战|到达|离开/.test(
      text
    );
  if (actionHeavy) return false;
  if (/\d{4}\s*年|\d{1,2}\s*[:：]\s*\d{2}/.test(text)) return false;

  const staticCue =
    /几乎无法分辨|无法分辨|素颜|长相.{0,6}相似|容貌.{0,6}相似|一模一样|本是|实为|乃是|身份是|本名|真名|血缘|亲兄|亲姐|亲妹|青梅竹马/.test(
      text
    ) ||
    (/与/.test(title) && /分辨|相似|相同/.test(text)) ||
    (/是.{0,8}的(哥哥|姐姐|妹妹|弟弟|父亲|母亲|儿子|女儿)/.test(text) &&
      summary.length < 80 &&
      !/得知|发现|杀害|杀死/.test(text));

  return staticCue;
}
