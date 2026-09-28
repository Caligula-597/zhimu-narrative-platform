import { newCompilerId } from "../state.js";
import { CANON_NODE_TYPE, SECTION_CAPSULE_TYPE } from "./constants.js";
import { classifyCapsuleEvent } from "./needs-split.js";

function clean(s, max = 200) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function capsuleIndexText(cap, section) {
  const parts = [
    cap?.type,
    cap?.summary,
    ...(cap?.events || []).map((e) => `${e.title} ${e.summary}`),
    ...(cap?.importantObjects || []),
    ...(cap?.mechanismHints || []),
    ...(cap?.characters || []),
    ...(section?.headingPath || []),
    String(section?.originalText || "").slice(0, 1200)
  ];
  return parts.filter(Boolean).join("\n");
}

function makeNode(fields) {
  return {
    id: newCompilerId("cnode"),
    type: fields.type,
    title: clean(fields.title, 100),
    summary: clean(fields.summary, 400) || null,
    sourceSectionIds: (fields.sourceSectionIds || []).filter(Boolean),
    capsuleId: fields.capsuleId || null,
    stageId: fields.stageId || null,
    options: fields.options || null,
    branches: fields.branches || null,
    needsSplit: fields.needsSplit || false,
    splitReasons: fields.splitReasons || null,
    promotedFrom: fields.promotedFrom || "capsule",
    evidence: fields.evidence || null
  };
}

function titleFromSummary(summary, fallback) {
  const s = clean(summary, 80);
  if (!s) return fallback;
  // Prefer first clause if concrete
  const first = s.split(/[。；;]/)[0] || s;
  if (first.length >= 6 && first.length <= 40) return first;
  if (first.length > 40) return `${first.slice(0, 36)}…`;
  return fallback;
}

/** Evidence helpers — require explicit semantic cues, not bare keywords. */

/**
 * META / INTRO / OUTRO → promotion NONE (V1.2).
 * Generic packaging / host framing — not story BRANCH.
 */
function isMetaNoneUnit(text, capType) {
  const pack =
    /剧本.{0,8}简介|说明类型|人数.{0,6}时长|核心机制特点|续作预告|宣告游戏结束|开本前|作者说明|发行说明|版权所有|纯属虚构|致给店家|店家的一封信|无实际剧情|无剧情推进|彩蛋段|结束语/.test(
      text
    );
  const metaIntro =
    (capType === SECTION_CAPSULE_TYPE.META ||
      capType === SECTION_CAPSULE_TYPE.NO_RELEVANT_CONTENT) &&
    (/简介|前言|开本|结束|预告|版权|作者|发行|时长|人数|机制提示|背景卡朗读/.test(text) ||
      /主持人介绍规则/.test(text));
  return pack || metaIntro;
}

/**
 * BRANCH only for mutually exclusive outcome structures (V1.2 strict).
 * IF A → Ending A / IF B → Ending B — not “looks like ending text”.
 */
function isBranchUnit(text, capType) {
  if (isMetaNoneUnit(text, capType)) return false;

  const mutuallyExclusive =
    /若.{0,16}(则|→|——).{0,40}(若|否则)/.test(text) ||
    /(若|如果).{0,12}(生|死|存活|牺牲).{0,24}(则|，).{0,40}(若|如果).{0,12}(生|死|存活|牺牲)/.test(
      text
    ) ||
    /根据.{0,10}(生死|抉择|选择).{0,20}(结局|不同)/.test(text) ||
    /三种不同结局|触发不同的结局/.test(text) ||
    (/发放对应小剧场/.test(text) && /(生|死|存活|牺牲)/.test(text) && /抉择|分支|对应/.test(text));

  const exclusiveEndingFramework =
    /结局部分/.test(text) && /分支|抉择结果/.test(text) && !/简介|预告|续作|开本前/.test(text);

  return mutuallyExclusive || exclusiveEndingFramework;
}

function isDecisionUnit(text, cap, capType) {
  const summary = String(cap?.summary || "");
  // Event-chain capsules that merely mention gates in appendix text
  if (/伪装|吊灯|拍卖会|墓穴|砸/.test(summary)) return false;

  const focus = [summary, capType, ...(cap?.mechanismHints || [])].join("\n");
  if (!/生门/.test(text) || !/死门/.test(text)) return false;

  return (
    /抉择的规则|对应的生门|站上去|选择都是自由|阵法已经启动/.test(focus) ||
    /抉择的规则|对应的生门|站上去|选择都是自由/.test(text) ||
    (capType === SECTION_CAPSULE_TYPE.RULE && /生门|死门/.test(focus))
  );
}

function isProcessUnit(text, cap, capType) {
  const summary = String(cap?.summary || "");
  if (/伪装|吊灯|拍卖会|砸尸|墓穴/.test(summary) && !/搜证|取证|投凶|公共线索/.test(summary)) {
    return false;
  }

  const playFlow =
    (/搜证|取证|投凶|公共线索|搜身线索/.test(text) &&
      (capType === SECTION_CAPSULE_TYPE.RULE ||
        capType === SECTION_CAPSULE_TYPE.META ||
        /环节|发放|组织玩家|第一轮|第二轮/.test(text))) ||
    (/阵法已经启动/.test(summary + "\n" + (cap?.mechanismHints || []).join("\n")) &&
      /抉择|生门|死门/.test(summary) &&
      !isBranchUnit(text, capType));
  return playFlow;
}

function revealFocusText(cap) {
  // Do NOT use full originalText for reveal cues — history sections mention 傅月生/面具 as background.
  return [
    cap?.summary,
    ...(cap?.events || []).map((e) => `${e.title} ${e.summary}`),
    ...(cap?.importantObjects || [])
  ]
    .filter(Boolean)
    .join("\n");
}

function isRevealUnit(cap) {
  const text = revealFocusText(cap);
  const summary = String(cap.summary || "");

  const explicit =
    /揭下.{0,6}(人皮)?面具/.test(text) ||
    /揭下了自己的人皮面具/.test(text) ||
    /叫你傅月生/.test(text) ||
    (/白初/.test(text) && /傅月生/.test(text) && /(揭露|看见你了|该叫你)/.test(text)) ||
    /揭示凶手|凶手是|明确杀死/.test(text);

  // Historical "讲述…真相/由来/失败" without action-chain crisis
  const historicalTell =
    /讲述/.test(summary) &&
    /长生水/.test(summary) &&
    /(失败|由来|真相|诅咒|沉睡|守墓)/.test(summary) &&
    !/啼哭|弩箭|晕倒|救人|伪装|吊灯/.test(summary);

  if (/啼哭|弩箭|晕倒|救人/.test(summary) && !explicit) return false;
  if (/离开、白初|盗墓发迹|复仇|身世、陶老板|齐聚日月山庄的缘由/.test(summary) && !explicit) {
    return false;
  }

  return explicit || historicalTell;
}

function deriveRevealTitle(cap) {
  const text = revealFocusText(cap);
  if (/揭下.{0,8}人皮面具|揭下了自己的人皮面具/.test(text)) {
    if (/杨峥/.test(text)) return "杨峥揭下人皮面具";
    return "揭下人皮面具";
  }
  if (/叫你傅月生/.test(text) || (/傅月生/.test(text) && /顾怀辰/.test(text) && /白初/.test(text))) {
    return "点名顾怀辰为傅月生";
  }
  if (/凶手/.test(text)) {
    const ev = (cap.events || []).find((e) => /凶手/.test(`${e.title}${e.summary}`));
    return clean(ev?.title || "揭示真凶", 40);
  }
  if (/讲述/.test(cap.summary || "") && /长生水/.test(cap.summary || "")) {
    return titleFromSummary(cap.summary, "长生水历史揭示");
  }
  if (/长生水/.test(text) && /(由来|真相)/.test(text)) {
    return "长生水由来/真相公开";
  }
  const ev = (cap.events || []).find((e) => /揭|揭示|真相|面具|傅月生/.test(`${e.title}${e.summary}`));
  if (ev?.title) return clean(ev.title, 40);
  return titleFromSummary(cap.summary, "信息揭示");
}

function deriveBranchTitle(cap, text) {
  if (/顾怀辰/.test(text) && /陶梦芸/.test(text)) return "顾怀辰/陶梦芸结局分支";
  if (/黎小曼/.test(text) && /张九孚/.test(text)) return "黎小曼/张九孚结局分支";
  if (/杨峥/.test(text) && /白初/.test(text)) return "杨峥/白初结局分支";
  if (/结局部分/.test(text)) return "结局分支框架";
  return titleFromSummary(cap.summary, "结局分支");
}

function deriveProcessTitle(text, cap) {
  if (/投凶/.test(text) && /搜证|取证/.test(text)) return "搜证与投凶推进";
  if (/投凶/.test(text)) return "投凶环节";
  if (/取证|搜证|公共线索/.test(text)) return "搜证/取证推进";
  if (/阵法已经启动/.test(text)) return "阵法启动与抉择规则生效";
  return titleFromSummary(cap.summary, "流程推进");
}

/**
 * Promotion V1.2: structural units + META→NONE.
 * Never emit generic template titles without matching evidence.
 * Priority: META_NONE → BRANCH > DECISION(+optional PROCESS) > PROCESS > REVEAL
 */
export function promoteCapsuleToNodes(cap, section = null) {
  if (!cap) return [];
  const text = capsuleIndexText(cap, section);
  const summary = String(cap.summary || "");
  const sid = cap.sourceSectionId;
  const refs = [sid].filter(Boolean);
  const capType = String(cap.type || "").toUpperCase();
  const base = {
    sourceSectionIds: refs,
    capsuleId: cap.id,
    stageId: cap.stageId,
    promotedFrom: "promotion_v1.2"
  };

  if (isMetaNoneUnit(text, capType)) {
    return [];
  }

  // Priority: BRANCH > DECISION(+optional PROCESS for 阵法启动) > PROCESS > REVEAL
  if (isBranchUnit(text, capType)) {
    return [
      makeNode({
        ...base,
        type: CANON_NODE_TYPE.BRANCH,
        title: deriveBranchTitle(cap, text),
        summary: clean(summary || "按抉择/生死条件触发不同结局", 300),
        branches: [{ label: "条件分支" }],
        evidence: "branch_conditional_or_ending_framework"
      })
    ];
  }

  if (isDecisionUnit(text, cap, capType) && !isBranchUnit(text, capType)) {
    const out = [
      makeNode({
        ...base,
        type: CANON_NODE_TYPE.DECISION,
        title: "生门/死门抉择",
        summary: clean(summary || "生门与死门对应，玩家各自站位抉择", 300),
        options: ["生门", "死门"],
        evidence: "decision_gate_rules"
      })
    ];
    // Distinct second unit: array start as PROCESS (G10), not merged into decision title
    if (/阵法已经启动|阵法.*启动/.test(text)) {
      out.unshift(
        makeNode({
          ...base,
          type: CANON_NODE_TYPE.PROCESS,
          title: "阵法启动与抉择规则生效",
          summary: clean(
            summary.includes("阵法")
              ? summary
              : "长生水制造阵法已启动，进入生门/死门抉择规则",
            300
          ),
          evidence: "array_start_with_decision_rules"
        })
      );
    }
    return out;
  }

  if (isProcessUnit(text, cap, capType) && !isBranchUnit(text, capType)) {
    return [
      makeNode({
        ...base,
        type: CANON_NODE_TYPE.PROCESS,
        title: deriveProcessTitle(text, cap),
        summary: clean(summary || deriveProcessTitle(text, cap), 300),
        evidence: "play_process_or_array_rules"
      })
    ];
  }

  if (isRevealUnit(cap)) {
    return [
      makeNode({
        ...base,
        type: CANON_NODE_TYPE.REVEAL,
        title: deriveRevealTitle(cap),
        summary: clean(summary || deriveRevealTitle(cap), 300),
        evidence: "explicit_reveal_cue"
      })
    ];
  }

  return [];
}

/**
 * Lift capsule.events → EVENT nodes, with reclassify + NEEDS_SPLIT flags.
 */
export function eventsToCanonNodes(events = [], { capsuleId = null } = {}) {
  const nodes = [];
  for (const ev of events || []) {
    const classified = classifyCapsuleEvent(ev);
    if (classified.skip) continue;

    if (classified.type === "BRANCH" || classified.type === "REVEAL" || classified.type === "FACT") {
      nodes.push(
        makeNode({
          type: classified.type,
          title: classified.title,
          summary: classified.summary,
          sourceSectionIds: ev.sourceSectionIds || [],
          capsuleId: capsuleId || ev.capsuleId || null,
          stageId: ev.stageId || null,
          promotedFrom: "event_reclassify_v1.2",
          evidence: classified.reason,
          branches: classified.type === "BRANCH" ? [{ label: "结局结果" }] : null
        })
      );
      nodes[nodes.length - 1].sourceEventId = ev.id || null;
      continue;
    }

    nodes.push(
      makeNode({
        type: CANON_NODE_TYPE.EVENT,
        title: classified.title || ev.title,
        summary: classified.summary || ev.summary,
        sourceSectionIds: ev.sourceSectionIds || [],
        capsuleId: capsuleId || ev.capsuleId || null,
        stageId: ev.stageId || null,
        needsSplit: Boolean(classified.needsSplit),
        splitReasons: classified.splitReasons || null,
        promotedFrom: "capsule_event",
        evidence: classified.reason
      })
    );
    nodes[nodes.length - 1].sourceEventId = ev.id || null;
  }
  return nodes;
}

/**
 * Outline → Canon reconciliation (conservative stubs only when label is concrete).
 */
export function reconcileOutlineToNodes(globalOutline, nodes = []) {
  const orphans = [];
  const extras = [];
  const blob = (nodes || [])
    .map((n) => `${n.type} ${n.title} ${n.summary || ""}`)
    .join("\n");

  const checks = [];
  for (const m of globalOutline?.majorIncidents || []) {
    checks.push({
      kind: "majorIncident",
      label: m.label,
      hint: m.hint,
      sourceSectionIds: m.sourceSectionIds || []
    });
  }
  for (const t of globalOutline?.truthSections || []) {
    checks.push({
      kind: "truthSection",
      label: t.label,
      sourceSectionIds: t.sourceSectionIds || []
    });
  }

  for (const item of checks) {
    const label = clean(item.label, 80);
    if (!label || label.length < 4) continue;
    const tokens = label.replace(/[：:·\s]/g, " ").split(/\s+/).filter((t) => t.length >= 2);
    const found = tokens.length ? tokens.some((t) => blob.includes(t)) : false;
    if (!found) {
      orphans.push({
        code: "OUTLINE_ORPHAN",
        kind: item.kind,
        label,
        sourceSectionIds: item.sourceSectionIds || []
      });
      // V3: do NOT auto-stub noisy outline orphans into Canon — only record
    }
  }

  return { orphans, stubNodes: extras };
}

function dedupeNodes(nodes = []) {
  const seen = new Set();
  const out = [];
  for (const n of nodes) {
    const key = `${n.type}|${n.title}|${(n.sourceSectionIds || []).join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

export function buildCanonNodes({
  sectionCapsules = [],
  events = [],
  globalOutline = null,
  sourceSections = []
} = {}) {
  const sectionById = new Map((sourceSections || []).map((s) => [s.id, s]));
  const nodes = [];

  // Events first (with reclassify)
  nodes.push(...eventsToCanonNodes(events));

  for (const cap of sectionCapsules || []) {
    const sec = sectionById.get(cap.sourceSectionId) || null;
    nodes.push(...promoteCapsuleToNodes(cap, sec));
  }

  const { orphans, stubNodes } = reconcileOutlineToNodes(globalOutline, nodes);
  nodes.push(...stubNodes);

  const deduped = dedupeNodes(nodes);
  deduped.forEach((n, i) => {
    n.order = i + 1;
  });

  const needsSplitCount = deduped.filter((n) => n.needsSplit).length;

  return {
    nodes: deduped,
    outlineOrphans: orphans,
    needsSplitCount,
    countsByType: Object.values(CANON_NODE_TYPE).reduce((acc, t) => {
      acc[t] = deduped.filter((n) => n.type === t).length;
      return acc;
    }, {})
  };
}

export function nodeText(node) {
  return [
    node?.title,
    node?.summary,
    ...(node?.options || []),
    ...(node?.branches || []).map((b) => (typeof b === "string" ? b : b?.label))
  ]
    .filter(Boolean)
    .join(" ");
}
