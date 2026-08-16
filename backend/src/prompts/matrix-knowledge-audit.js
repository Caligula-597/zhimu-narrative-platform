/**
 * Matrix 2.0 — knowledge boundary audit (风格迁移脑补检测).
 * Judges whether script assertions are allowed for this role at this act/time.
 */
import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";
import { actIndex } from "./matrix-prompt-engine.js";

/** Collect allowed fact strings from prior acts for same role. */
export function collectPriorRoleKnowledge(actOutlines, roleKey, actKey, config) {
  const keys = config?.chapterKeys || [];
  const idx = keys.indexOf(actKey);
  const facts = [];
  const unknowns = [];
  const outlines = [];
  if (!actOutlines?.[roleKey] || idx <= 0) return { facts, unknowns, outlines };
  for (const k of keys.slice(0, idx)) {
    const o = actOutlines[roleKey][k];
    if (!o) continue;
    outlines.push({ actKey: k, outline: o.outline?.slice(0, 800) });
    for (const src of o.knowledgeSources || []) {
      if (src.fact) facts.push(src.fact);
    }
    for (const u of o.unknowns || []) unknowns.push(u);
    for (const s of o.signatureClues || []) {
      if (s.detail) facts.push(s.detail);
    }
  }
  return { facts, unknowns, outlines };
}

/** Timeline rows where role participated or may have witnessed. */
export function filterTimelineForRole(truthBible, roleKey) {
  const rows = truthBible?.physicalTimeline || truthBible?.timeline || [];
  return rows
    .filter((t) => {
      const parts = t.participants || [];
      return parts.length === 0 || parts.includes(roleKey);
    })
    .slice(0, 12)
    .map((t) => ({ time: t.time, event: t.event, participants: t.participants }));
}

export function buildKnowledgeBoundaryAuditMessages({
  roleKey,
  actKey,
  characterArchive,
  actOutline,
  priorKnowledge,
  priorScriptBodies = [],
  truthBible,
  infoMatrix,
  matrixRow,
  scriptBody,
  isKiller = false
}) {
  const allowedFacts = [
    ...(actOutline?.knowledgeSources || []).map((k) => ({
      fact: k.fact,
      source: k.source,
      clueId: k.clueId
    })),
    ...(priorKnowledge?.facts || []).map((f) => ({ fact: f, source: "前幕已建立", clueId: null }))
  ];
  const mustNotKnow = [
    ...(actOutline?.unknowns || []),
    ...(priorKnowledge?.unknowns || [])
  ];
  const mustNotInfer = [
    ...(actOutline?.notYetInferred || []),
    ...(actOutline?.forbiddenConclusions || [])
  ];
  const publicAnchors = actOutline?.matrix20?.publicAnchors || infoMatrix?.publicEnvironmentByAct?.[actKey] || [];
  const personalTimeline = actOutline?.matrix20?.personalTimeline || [];

  const system = `你是剧本杀「知识边界审计员」。判断**私人剧本正文**中的事实断言，是否超出该角色在本幕、该时间点**有权知道/有权描写**的范围。

${PRODUCT_BOUNDARY}

【审计目标 — 风格迁移脑补】
LLM 在「文学化/换体裁」时，常擅自给角色补全机关原理、他人动机、未亲历的时间线——这是**过度补偿**，不是文笔问题。
你要抓的是：**她在这个时间应不应该知道/看到这一幕**。

【判定依据 — 按优先级】
1. **knowledgeSources（本幕）+ 前幕已建立事实**：有来源的才可写为确定事实。
2. **unknowns / mustNotKnow**：不得写穿；只能「不清楚」「后来才知」「听说未核实」。
3. **notYetInferred / forbiddenConclusions**：即使已有碎片足够让模型猜到，也不得替玩家完成推论；怀疑只能停在 allowedSuspicionRange。
4. **personalTimeline + 角色档案 timelineActions**：不在场时段不得写亲见他人私密行动。
4. **L2 publicAnchors**：公共场可观察；但不得把公共锚点扩写成全知复盘。
5. **前幕剧本已写内容**：若 ch2 出现 ch1 未铺垫的「想起叔父曾教…」且无 knowledgeSources 支撑 → **high 越界**。
6. **truth 时间线（仅物理可见证）**：角色未参与且不在场的事件，不得写确定事实。

【非凶手额外规则】
- 不得写出完整作案手法链（配重绳+窗栅联动+投毒步骤）除非 knowledgeSources 明确且来源为亲见/线索卡。
- 「想起…教…做机关」类记忆须有前幕或本幕 knowledgeSources 对应。

【勿误报】
- 猜测、误判、task 导向的怀疑 — 允许（标 medium/low 或忽略）。
- 按 setting.pov 锁定人称的心理与感官描写 — 不审文笔，只审**事实断言**。
- 真凶私人本可对己相关物证紧张，但不得冷静复盘「我试图毒死但未成功」式全知报告。

【输出 schema】
{
  "passed": true,
  "verdict": "一句话",
  "leaks": [{
    "excerpt": "正文原句片段",
    "claim": "断言了什么",
    "severity": "high|medium|low",
    "reason": "为何越界（缺来源/不在场/前幕未铺垫/写穿 unknown）",
    "fix": "删改方向"
  }],
  "groundedHighlights": ["写得好的有限视角句，最多2条"]
}`;

  const user = `审计 ${characterArchive?.name || roleKey} / ${actKey}（isKiller=${isKiller}）

${untrustedUserPayload("角色档案", {
  name: characterArchive?.name,
  publicIdentity: characterArchive?.publicIdentity,
  timelineActions: characterArchive?.timelineActions
})}
${untrustedUserPayload("本幕允许知识 knowledgeSources", allowedFacts)}
${untrustedUserPayload("本幕及前幕不得写穿 unknowns", mustNotKnow.slice(0, 10))}
${untrustedUserPayload("本幕不得替玩家完成的推论", mustNotInfer.slice(0, 12))}
${untrustedUserPayload("本幕允许怀疑范围", actOutline?.allowedSuspicionRange || matrixRow?.allowedSuspicionRange || "只能依据已登记事实提出方向性怀疑")}
${untrustedUserPayload("L2 公共锚点", publicAnchors)}
${untrustedUserPayload("本幕个人时间线", personalTimeline)}
${untrustedUserPayload("矩阵行 forbidden", matrixRow?.forbidden || [])}
${untrustedUserPayload("真相时间线（该角色相关物理事件）", filterTimelineForRole(truthBible, roleKey))}
${priorKnowledge?.outlines?.length ? untrustedUserPayload("前幕大纲摘要", priorKnowledge.outlines) : ""}
${priorScriptBodies.length ? untrustedUserPayload("前幕剧本摘录（查铺垫）", priorScriptBodies.map((b, i) => ({ act: i + 1, excerpt: b.slice(0, 1200) }))) : ""}
${untrustedUserPayload("待审计正文", { body: String(scriptBody || "").slice(0, 5000) })}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function validateKnowledgeBoundaryAudit(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const leaks = Array.isArray(value.leaks)
    ? value.leaks.slice(0, 12).map((l) => ({
        excerpt: cleanText(l.excerpt, 200),
        claim: cleanText(l.claim, 200),
        severity: ["high", "medium", "low"].includes(l.severity) ? l.severity : "medium",
        reason: cleanText(l.reason, 400),
        fix: cleanText(l.fix || l.suggestedFix, 400)
      }))
    : [];
  const hasHigh = leaks.some((l) => l.severity === "high");
  return {
    passed: Boolean(value.passed) && !hasHigh,
    verdict: cleanText(value.verdict, 400),
    leaks,
    groundedHighlights: Array.isArray(value.groundedHighlights)
      ? value.groundedHighlights.slice(0, 4).map((h) => cleanText(h, 200))
      : []
  };
}

/**
 * Fast heuristic — flags obvious ungrounded recall / mechanism exposition.
 * Advisory only; pair with LLM audit for pilot scoring.
 */
export function scanKnowledgeLeakHeuristic(body, {
  actOutline,
  priorKnowledgeFacts = [],
  priorScriptBodies = [],
  isKiller = false
} = {}) {
  const raw = String(body || "");
  const hits = [];
  const allowedBlob = [
    ...(actOutline?.knowledgeSources || []).map((k) => k.fact),
    ...priorKnowledgeFacts,
    actOutline?.outline || ""
  ]
    .join(" ")
    .toLowerCase();

  const priorBlob = priorScriptBodies.join(" ").toLowerCase();

  const recallPatterns = [
    /想起[^。！？]{0,50}教[^。！？]{0,40}/g,
    /叔父曾教[^。！？]{4,40}/g,
    /曾教你用[^。！？]{4,40}/g
  ];
  for (const re of recallPatterns) {
    for (const m of raw.match(re) || []) {
      const key = m.slice(0, 12).toLowerCase();
      if (!allowedBlob.includes("教") && !priorBlob.includes(key) && !priorBlob.includes("教")) {
        hits.push({ type: "ungrounded_recall", excerpt: m.slice(0, 80) });
      }
    }
  }

  const mechanismExplain =
    /(细绳|配重绳).{0,20}(套|拉|联动).{0,30}(窗栅|插销)/.test(raw) ||
    /从窗外拉动，亦可扣上或拉开/.test(raw);
  const mechanismAllowed =
    allowedBlob.includes("配重") ||
    allowedBlob.includes("窗栅") ||
    allowedBlob.includes("机关") ||
    priorBlob.includes("配重");
  if (mechanismExplain && !mechanismAllowed && !isKiller) {
    hits.push({ type: "mechanism_exposition", excerpt: "完整描述窗栅/配重绳联动" });
  }

  if (/试图用.+毒死|但未成功/.test(raw)) {
    hits.push({ type: "crime_report", excerpt: "事后犯罪复盘句" });
  }

  return {
    passed: hits.length === 0,
    advisory: true,
    hits: hits.slice(0, 8)
  };
}
