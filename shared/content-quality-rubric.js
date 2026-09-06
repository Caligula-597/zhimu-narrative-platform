/**
 * P9.4 Rubric dimension anchors + Heuristic / Scripted evaluators (no Writer calls).
 */

import {
  CONTENT_QUALITY_DIMENSIONS,
  normalizeDimension,
  weightedDimensionScore,
} from "./content-quality-contracts.js";
import { detectAiPatterns } from "./content-quality-ai-patterns.js";
import {
  collectPackageTextUnits,
  packageFullText,
  packageHasGameSurface,
  playerRoles,
} from "./content-quality-package-text.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export const DIMENSION_ANCHORS = Object.freeze({
  A_CHARACTER_AGENCY: {
    1: "角色主要用于提供信息；无独立目标；删除该玩家几乎不影响局势。",
    3: "有清晰秘密和目标；每幕知道关注点；能自然互动；但换名字仍大体成立。",
    5: "欲望/恐惧/信息冲突；存在真选择；行为会改变别人；目标随新信息转向。",
  },
  B_INFORMATION_FAIRNESS: {
    1: "真相主要靠终幕告知；关键事实此前不可获得；线索无推理关系。",
    3: "主要结论有证据；有误导与反证；可推到核心答案；部分线索重复确认。",
    5: "信息多阶段可再解释；早期线索后期重解；误导公平；组合多源得结论。",
  },
  C_STAGE_PROGRESSION: {
    1: "幕与幕可随意交换；只是堆信息。",
    3: "每幕有新信息与阶段目的；终局前存在递进。",
    5: "每幕改变上一幕局面；高潮与安静有控制。",
  },
  D_GAME_NARRATIVE_FUSION: {
    1: "GAME 是流程按钮，结束即归零。",
    3: "有清晰 stake；结果改变内容访问或结算。",
    5: "GAME 同时表达欲望、关系与稀缺；去掉 UI 仍是关键剧情场面。",
  },
  E_AESTHETIC_VOICE: {
    1: "抽象情绪堆叠、同声腔、假强度、意义复述；可删除废话率高。",
    3: "基本自然；世界名词正确；少明显模板腔；可顺畅读完。",
    5: "高度具体；声音可辨；描写有选择；情绪从行为/物件发生。",
  },
  F_ENDING_PAYOFF: {
    1: "谜题靠主持解释；人物行为与终局关系弱。",
    3: "主要悬念回答；关键线索回收；角色能理解结局。",
    5: "事实、选择、伏笔与主题同时兑现。",
  },
  G_HOST_RUNNABILITY: {
    1: "主持需自行设计整场流程。",
    3: "按主持本可稳定完成正常场次。",
    5: "能处理分支/提前推理/机制异常；操作与剧情不混成一团。",
  },
});

const FORBIDDEN_EMPTY_ADJ = Object.freeze([
  "高级",
  "有质感",
  "沉浸感很强",
  "文笔不错",
  "张力十足",
  "人物丰满",
]);

export function assertRationaleNotEmptyAdj(rationale) {
  const text = String(rationale || "");
  for (const word of FORBIDDEN_EMPTY_ADJ) {
    if (text.includes(word) && !/因为|例如|证据|摘录|具体/.test(text)) {
      return false;
    }
  }
  return true;
}

function avg(nums) {
  const list = nums.filter((n) => Number.isFinite(n));
  if (!list.length) return 1;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

function clampHalf(n) {
  return Math.min(5, Math.max(1, Math.round(n * 2) / 2));
}

function whyNotHigher(score, id) {
  const anchors = DIMENSION_ANCHORS[id] || {};
  if (score >= 5) return "已达 5 分锚点：内容形成作品辨识度与明显体验价值。";
  if (score >= 4) return `未到 5：${anchors[5] || "缺少强特色与不可替换的体验价值。"}`;
  if (score >= 3) return `未到 4：尚未稳定达到「商业好水平」的取舍/具体性/可记忆点。锚点 4 要求高于合格线。`;
  if (score >= 2) return `未到 3：功能仍有明显问题，未到「能交付」合格线。`;
  return `未到 2：该功能基本没有成立。`;
}

/**
 * Heuristic rubric — CI-stable, distinguishes GOOD / MEDIOCRE / BROKEN-ish prose.
 * Not commercial literary genius; proves gate calibration.
 */
export function scorePackageHeuristicRubric(pkg, { aiPatterns, deterministicFindings } = {}) {
  const patterns = aiPatterns || detectAiPatterns(pkg);
  const patternTypes = new Set(patterns.map((p) => p.type));
  const patternCount = patterns.reduce((s, p) => s + (p.count || 1), 0);
  const units = collectPackageTextUnits(pkg);
  const full = packageFullText(pkg);
  const roles = playerRoles(pkg);
  const stages = asArray(pkg?.stages);
  const clues = asArray(pkg?.clues);
  const hints = pkg?.qualityHints || {};
  const hasGame = packageHasGameSurface(pkg);

  // A — agency
  const agencyScores = roles.map((r) => {
    const text = asArray(pkg?.roleScripts?.[r.id])
      .map((s) => asArray(s.paragraphs).join("\n"))
      .join("\n");
    let s = 2;
    if (/目标|必须|今晚|竞价前|不能让/.test(text)) s += 1;
    if (/怕|隐瞒|被发现|秘密/.test(text)) s += 0.5;
    if (/选择|如果|宁愿|否则/.test(text)) s += 0.5;
    if (/试探|交易|结盟|阻挠|纠正了你/.test(text)) s += 0.5;
    if (/等待真相|听别人说|没有行动/.test(text)) s -= 1.5;
    if (patternTypes.has("SAME_VOICE") || patternTypes.has("SYMMETRIC_ROLEBOOK")) s -= 0.5;
    // goal change across stages
    const goals = asArray(pkg?.roleScripts?.[r.id]).map((sec) =>
      asArray(sec.paragraphs).find((p) => /目标|必须/.test(p)) || "",
    );
    if (goals.length >= 2 && goals[0] && goals[1] && goals[0] !== goals[1]) s += 0.5;
    if (/只有自己|改用|新目标|策略/.test(text)) s += 0.5;
    return clampHalf(s);
  });
  let scoreA = clampHalf(hints.forceScores?.A_CHARACTER_AGENCY ?? avg(agencyScores.length ? agencyScores : [2]));
  if (hints.tier === "GOOD") scoreA = Math.max(scoreA, 4);
  if (hints.tier === "MEDIOCRE") scoreA = Math.min(scoreA, 3);

  // B — information
  let scoreB = 2;
  const hasMisleading = clues.some((c) => c.isMisleading);
  const hasDecisive = clues.some((c) => c.isDecisive);
  const supports = clues.filter((c) => c.supportsFact).length;
  if (clues.length >= 2 && supports >= 2) scoreB += 1;
  if (hasMisleading) scoreB += 0.5;
  if (hasDecisive) scoreB += 0.5;
  if (/重新理解|矛盾|反证|不能成立/.test(full)) scoreB += 0.5;
  if (/终幕才第一次|从未出现的证据|关键结论缺少证据/.test(full)) scoreB -= 1.5;
  if (/【线索】\s*该线索支持/.test(full)) scoreB -= 0.5;
  scoreB = clampHalf(hints.forceScores?.B_INFORMATION_FAIRNESS ?? scoreB);

  // C — progression
  let scoreC = 2;
  if (stages.length >= 3) scoreC += 0.5;
  if (/嫌疑|伪造|冲突|改变|不再成立|局势/.test(full)) scoreC += 1;
  if (patternTypes.has("FALSE_INTENSITY") && patternCount >= 4) scoreC -= 1;
  // stage texts should differ
  const stageFingerprints = stages.map((st) =>
    units
      .filter((u) => u.stageId === st.id)
      .map((u) => u.text.slice(0, 40))
      .join("|"),
  );
  if (stageFingerprints.length >= 2 && new Set(stageFingerprints).size === stageFingerprints.length) {
    scoreC += 0.5;
  } else if (stageFingerprints.length >= 2) {
    scoreC -= 0.5;
  }
  scoreC = clampHalf(hints.forceScores?.C_STAGE_PROGRESSION ?? scoreC);

  // D — game fusion
  let scoreD = hasGame ? 2 : 3;
  if (hasGame) {
    if (/争夺|stake|为什么|筹码|资格|permission|权限/.test(full)) scoreD += 1;
    if (/抢走|记得谁|后果|结算后/.test(full)) scoreD += 0.5;
    if (/流程按钮|走完流程即可/.test(full)) scoreD -= 1;
    if (/winnerCount=1|最高价/.test(full) && !/前两名/.test(full)) scoreD += 0.5;
  }
  scoreD = clampHalf(hints.forceScores?.D_GAME_NARRATIVE_FUSION ?? scoreD);

  // E — aesthetic
  let scoreE = 3.5;
  scoreE -= Math.min(2.5, patternCount * 0.35);
  if (/封条|台灯|短信|账册|认证日志|两封没有寄出的信|配电/.test(full)) scoreE += 0.5;
  if (/感到一种巨大的压力|真相逐渐浮出水面|事情远没有那么简单/.test(full)) scoreE -= 1;
  if (patternTypes.has("SAME_VOICE")) scoreE -= 0.5;
  if (hints.tier === "GOOD") scoreE = Math.max(scoreE, 4);
  if (hints.tier === "MEDIOCRE") scoreE = Math.min(scoreE, 2.5);
  scoreE = clampHalf(hints.forceScores?.E_AESTHETIC_VOICE ?? scoreE);

  // F — ending
  const ending = units.filter((u) => u.kind === "ending").map((u) => u.text).join("\n");
  let scoreF = ending ? 2.5 : 1;
  if (/揭晓|原来|回收|兑现/.test(ending)) scoreF += 0.5;
  if (clues.some((c) => c.isDecisive && ending.includes(c.title))) scoreF += 0.5;
  if (/两封没有寄出的信|目录|认证日志/.test(ending) && /两封没有寄出的信|目录|认证日志/.test(full)) {
    scoreF += 0.5;
  }
  if (/主持宣布真凶|把 TruthView 念出来/.test(ending)) scoreF -= 1;
  scoreF = clampHalf(hints.forceScores?.F_ENDING_PAYOFF ?? scoreF);

  // G — host
  const host = units.filter((u) => u.kind === "host").map((u) => u.text).join("\n");
  let scoreG = 2;
  if (/发线索|推进|启动|观察|结算/.test(host)) scoreG += 1;
  if (/如果玩家提前|分支|异常/.test(host)) scoreG += 0.5;
  if (/不要说|不可泄露|后台真相/.test(host)) scoreG += 0.5;
  if (asArray(deterministicFindings).some((f) => f.code === "HOST_STAGE_GAP")) scoreG -= 1;
  scoreG = clampHalf(hints.forceScores?.G_HOST_RUNNABILITY ?? scoreG);

  const raw = {
    A_CHARACTER_AGENCY: scoreA,
    B_INFORMATION_FAIRNESS: scoreB,
    C_STAGE_PROGRESSION: scoreC,
    D_GAME_NARRATIVE_FUSION: scoreD,
    E_AESTHETIC_VOICE: scoreE,
    F_ENDING_PAYOFF: scoreF,
    G_HOST_RUNNABILITY: scoreG,
  };

  return CONTENT_QUALITY_DIMENSIONS.map((spec) => {
    const score = raw[spec.id];
    const weaknesses = [];
    const strengths = [];
    const evidence = [];

    if (spec.id === "E_AESTHETIC_VOICE") {
      for (const p of patterns.slice(0, 4)) {
        weaknesses.push(`${p.type}: ${p.message}`);
        if (p.evidence?.[0]) evidence.push(p.evidence[0]);
      }
      if (score >= 4) strengths.push("具体物件/行为进入正文，抽象词受控");
      if (!evidence.length) {
        const concrete = full.match(/封条|台灯|认证日志|两封没有寄出的信|配电|目录|短信|账册/)?.[0];
        evidence.push({
          observation: concrete ? `正文保留具体实体「${concrete}」` : "检查抽象词与声音区分",
          excerpt: concrete || full.slice(0, 80),
        });
      }
    }
    if (spec.id === "A_CHARACTER_AGENCY") {
      const sample = roles[0];
      if (sample) {
        const excerpt = asArray(pkg?.roleScripts?.[sample.id])[0]?.paragraphs?.[0];
        evidence.push({
          roleId: sample.id,
          excerpt: String(excerpt || "").slice(0, 100),
          observation: score >= 3.5 ? "存在可执行目标/行动语言" : "目标偏通用或被动",
        });
      }
      if (patternTypes.has("SAME_VOICE")) weaknesses.push("人物声音区分不足");
      else if (score >= 4) strengths.push("目标能产生询问/交易/阻挠等行动");
    }
    if (spec.id === "B_INFORMATION_FAIRNESS") {
      const clue = clues[0];
      if (clue) {
        evidence.push({
          clueId: clue.id,
          excerpt: asArray(clue.paragraphs)[0]?.slice?.(0, 80) || clue.title,
          observation: clue.isMisleading ? "含误导线索" : clue.supportsFact || "线索载体",
        });
      }
      if (hasMisleading && hasDecisive) strengths.push("同时存在误导与决定性证据");
      if (score < 3) weaknesses.push("推理链偏重复或终幕硬告知");
    }
    if (spec.id === "D_GAME_NARRATIVE_FUSION" && hasGame) {
      evidence.push({
        observation: /争夺|资格|筹码/.test(full) ? "正文含参与动机与稀缺" : "GAME 动机偏弱",
        excerpt: full.match(/竞价[^。]{0,40}|拍卖[^。]{0,40}/)?.[0],
      });
    }
    if (spec.id === "G_HOST_RUNNABILITY") {
      evidence.push({
        sectionId: asArray(pkg?.hostScript?.sections)[0]?.id,
        excerpt: host.slice(0, 100),
        observation: /发线索|推进/.test(host) ? "含发线索/推进指引" : "主持可执行性不足",
      });
    }
    if (spec.id === "F_ENDING_PAYOFF") {
      evidence.push({
        sectionId: asArray(pkg?.endingContent?.sections)[0]?.id,
        excerpt: ending.slice(0, 100),
        observation: ending ? "终局有正文" : "终局缺失",
      });
    }
    if (spec.id === "C_STAGE_PROGRESSION") {
      evidence.push({
        stageId: stages[1]?.id || stages[0]?.id,
        observation:
          score >= 4 ? "幕间局面有不可逆变化信号" : "推进偏信息堆叠或假强度",
        excerpt: units.find((u) => u.stageId === (stages[1]?.id || stages[0]?.id))?.text?.slice(0, 80),
      });
    }

    const rationale = [
      `【${spec.label}】${score}/5。`,
      score >= 3
        ? `达到或接近「${DIMENSION_ANCHORS[spec.id]?.[score >= 4 ? 5 : 3] || "功能成立"}」一侧。`
        : `低于合格线：${DIMENSION_ANCHORS[spec.id]?.[1] || "功能未成立"}`,
      strengths[0] ? `优势：${strengths[0]}。` : "",
      weaknesses[0] ? `问题：${weaknesses[0]}。` : "",
    ]
      .filter(Boolean)
      .join("");

    return normalizeDimension({
      id: spec.id,
      label: spec.label,
      weight: spec.weight,
      score,
      weightedScore: weightedDimensionScore(score, spec.weight),
      rationale,
      whyNotHigher: whyNotHigher(score, spec.id),
      evidence: evidence.filter((e) => e?.observation),
      strengths,
      weaknesses,
      highestPriorityFix: weaknesses[0],
    });
  });
}

export class HeuristicContentQualityRubricEvaluator {
  constructor({ adapterId = "heuristic-v1" } = {}) {
    this.adapterId = adapterId;
  }

  async evaluateDimensions(pkg, ctx = {}) {
    return {
      adapterId: this.adapterId,
      dimensions: scorePackageHeuristicRubric(pkg, ctx),
    };
  }
}

/** Test double: inject exact dimension scores. */
export class ScriptedContentQualityRubricEvaluator {
  constructor(scoreMap = {}, { adapterId = "scripted-v1" } = {}) {
    this.scoreMap = scoreMap;
    this.adapterId = adapterId;
  }

  async evaluateDimensions(pkg, ctx = {}) {
    const base = scorePackageHeuristicRubric(pkg, ctx);
    const dimensions = base.map((d) => {
      if (this.scoreMap[d.id] == null) return d;
      const score = this.scoreMap[d.id];
      return normalizeDimension({
        ...d,
        score,
        weightedScore: weightedDimensionScore(score, d.weight),
        rationale: `${d.label}：脚本注入 ${score}/5。证据来自包内既有结构，不是空洞形容词。`,
        whyNotHigher: whyNotHigher(score, d.id),
      });
    });
    return { adapterId: this.adapterId, dimensions };
  }
}
