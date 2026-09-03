/**
 * 长生叹 — Host TRUE Timeline gold events（人工抽检，复盘粒度）
 * match: keywords 全中 + anyOf 任一组全中。
 */
export const CHANGSHENG_HOST_TRUE_GOLD = [
  {
    id: "G01",
    title: "开场：众人于墓室苏醒/失忆困局",
    keywords: ["墓室"],
    anyOf: [["苏醒"], ["醒来"], ["失忆"], ["回忆拍卖"]]
  },
  {
    id: "G02",
    title: "陶老板之死 / 吊灯案发",
    keywords: [],
    anyOf: [
      ["吊灯", "砸"],
      ["陶老板", "杀害"],
      ["陶老板", "砸"],
      ["拍卖会", "命案"]
    ]
  },
  {
    id: "G03",
    title: "搜证与投凶推进",
    keywords: [],
    anyOf: [["搜证", "投凶"], ["搜证"], ["投凶"]]
  },
  {
    id: "G04",
    title: "发现刘警探尸体 / 深入主墓室",
    keywords: [],
    anyOf: [["刘警探"], ["警探", "尸体"], ["主墓室"]]
  },
  {
    id: "G05",
    title: "第二幕探索与真相浮现",
    keywords: [],
    anyOf: [["第二幕"], ["长生水", "真相"], ["探索", "长生水"]]
  },
  {
    id: "G06",
    title: "婴儿啼哭 / 晕倒危机",
    keywords: [],
    anyOf: [["啼哭"], ["婴儿"], ["晕倒"]]
  },
  {
    id: "G07",
    title: "第三幕身份揭示",
    keywords: [],
    anyOf: [["第三幕", "身份"], ["揭示身份"], ["人皮面具"], ["杨峥", "面具"]]
  },
  {
    id: "G08",
    title: "杨峥人皮面具 / 傅月生点名",
    keywords: [],
    anyOf: [["人皮"], ["面具"], ["傅月生", "白初"], ["顾怀", "傅月生"]]
  },
  {
    id: "G09",
    title: "长生水真相（公聊/揭示）",
    keywords: ["长生水"],
    anyOf: [["真相"], ["揭示"], ["由来"], ["炼制"]]
  },
  {
    id: "G10",
    title: "阵法启动（局内抉择）",
    keywords: [],
    anyOf: [["阵法", "生门"], ["阵法", "死门"], ["阵法", "抉择规则"]]
  },
  {
    id: "G11",
    title: "生门/死门抉择",
    keywords: [],
    anyOf: [["生门"], ["死门"], ["抉择规则"]]
  },
  {
    id: "G12",
    title: "结局分支框架",
    keywords: ["结局"],
    anyOf: [["分支"], ["旁白"], ["心声"], ["最终"]]
  },
  {
    id: "G13",
    title: "众人齐聚日月山庄（远因）",
    keywords: [],
    anyOf: [["日月山庄"], ["齐聚"], ["山庄"]]
  },
  {
    id: "G14",
    title: "长生水远史/炼制关键节点",
    keywords: ["长生水"],
    anyOf: [["炼制"], ["起源"], ["杨氏"], ["傅月生", "夺"]]
  }
];

function textOf(ev) {
  return `${ev.title || ""} ${ev.summary || ""} ${ev.evidenceQuote || ""}`;
}

function keywordsHit(text, gold) {
  const t = String(text);
  for (const kw of gold.keywords || []) {
    if (!t.includes(kw)) return false;
  }
  if (!gold.anyOf?.length) return true;
  return gold.anyOf.some((group) => {
    const list = Array.isArray(group) ? group : [group];
    return list.every((k) => t.includes(k));
  });
}

/**
 * Score Stage 3A output against gold + structural checks.
 */
export function scoreHostTrueTimeline(events, gold = CHANGSHENG_HOST_TRUE_GOLD, { sourceSections = [] } = {}) {
  const list = Array.isArray(events) ? events : [];
  const sectionById = new Map((sourceSections || []).map((s) => [s.id, s]));

  const usedEventIds = new Set();
  const coverage = gold.map((g) => {
    const hit = list.find((ev) => !usedEventIds.has(ev.id) && keywordsHit(textOf(ev), g));
    if (hit) usedEventIds.add(hit.id);
    return {
      goldId: g.id,
      goldTitle: g.title,
      covered: Boolean(hit),
      matchedEventId: hit?.id || null,
      matchedTitle: hit?.title || null
    };
  });
  const coveredCount = coverage.filter((c) => c.covered).length;

  const hallucinationFlags = [];
  for (const ev of list) {
    const refs = ev.sourceSectionIds || [];
    if (!refs.length) {
      hallucinationFlags.push({ eventId: ev.id, title: ev.title, reason: "NO_SOURCE_REF" });
      continue;
    }
    const joined = refs
      .map((id) => sectionById.get(id)?.originalText || "")
      .join("\n");
    const quote = String(ev.evidenceQuote || "").replace(/\s+/g, "");
    if (quote.length >= 8) {
      const soft = quote.slice(0, Math.min(24, quote.length));
      if (joined.replace(/\s+/g, "").includes(soft) === false) {
        const titleBits = String(ev.title || "").replace(/[：:·\s]/g, "").slice(0, 6);
        if (titleBits && !joined.includes(titleBits.slice(0, 2))) {
          hallucinationFlags.push({
            eventId: ev.id,
            title: ev.title,
            reason: "EVIDENCE_NOT_IN_SOURCE"
          });
        }
      }
    }
  }

  const micro = list.filter((ev) => {
    const t = textOf(ev);
    return /走过去|抬手|坐下来|点了点头|看了一眼/.test(t) && t.length < 40;
  });

  const endingSplinters = list.filter((ev) =>
    /结局/.test(textOf(ev)) && /生.*死|死.*生|余生|老死|共赴/.test(textOf(ev))
  );

  const orderPairs = [];
  const goldOrder = coverage.filter((c) => c.covered);
  for (let i = 0; i < goldOrder.length - 1; i += 1) {
    const a = list.find((e) => e.id === goldOrder[i].matchedEventId);
    const b = list.find((e) => e.id === goldOrder[i + 1].matchedEventId);
    if (!a || !b) continue;
    orderPairs.push({
      earlier: goldOrder[i].goldId,
      later: goldOrder[i + 1].goldId,
      ok: a.order < b.order
    });
  }
  const orderOk = orderPairs.length ? orderPairs.filter((p) => p.ok).length / orderPairs.length : null;

  const withRefs = list.filter((e) => (e.sourceSectionIds || []).length > 0).length;

  return {
    eventCount: list.length,
    coverage: {
      covered: coveredCount,
      total: gold.length,
      rate: gold.length ? coveredCount / gold.length : 0,
      detail: coverage
    },
    hallucination: {
      flagged: hallucinationFlags.length,
      rate: list.length ? hallucinationFlags.length / list.length : 0,
      detail: hallucinationFlags
    },
    granularity: {
      microActionSuspects: micro.length,
      endingSplinterSuspects: endingSplinters.length,
      detail: micro.map((e) => ({ id: e.id, title: e.title })),
      targetBand: "canonical events preserved; display groups compress UI"
    },
    order: {
      pairRate: orderOk,
      pairs: orderPairs
    },
    sourceRefs: {
      withRefs,
      total: list.length,
      rate: list.length ? withRefs / list.length : 0
    }
  };
}

/**
 * Stage 3A V2 scorecard — recall + coverage audits (not final display count).
 */
export function scoreHostTrueTimelineV2({
  candidates = [],
  canonicalEvents = [],
  displayGroups = [],
  sourceDispositions = [],
  candidateDispositions = [],
  hostSectionIds = [],
  gold = CHANGSHENG_HOST_TRUE_GOLD,
  sourceSections = []
} = {}) {
  const base = scoreHostTrueTimeline(canonicalEvents, gold, { sourceSections });

  const sectionIds =
    hostSectionIds.length > 0
      ? hostSectionIds
      : (sourceSections || []).map((s) => s.id).filter(Boolean);
  const dispSet = new Set((sourceDispositions || []).map((d) => d.sourceSectionId));
  const missingDisp = sectionIds.filter((id) => !dispSet.has(id));

  const candIds = new Set(
    (candidates || []).map((c) => c.candidateId || c.id).filter(Boolean)
  );
  const dispCand = new Map(
    (candidateDispositions || []).map((d) => [d.candidateId, d])
  );
  let silentLoss = 0;
  for (const id of candIds) {
    if (!dispCand.has(id)) silentLoss += 1;
  }
  const rejectedWithoutReason = (candidateDispositions || []).filter(
    (d) => d.type === "REJECTED" && !d.reason
  ).length;

  const canonIds = new Set((canonicalEvents || []).map((e) => e.id));
  const grouped = new Set((displayGroups || []).flatMap((g) => g.eventIds || []));
  const missingInDisplay = [...canonIds].filter((id) => !grouped.has(id));

  const sourceless = (canonicalEvents || []).filter(
    (e) => !(e.sourceSectionIds || []).length
  ).length;

  return {
    ...base,
    v2: {
      candidateCount: candidates.length,
      canonicalEventCount: canonicalEvents.length,
      displayGroupCount: displayGroups.length,
      majorGoldRecall: base.coverage,
      hallucination: base.hallucination,
      sourceRefCoverage: base.sourceRefs,
      sourceDispositionCoverage: {
        covered: sectionIds.length - missingDisp.length,
        total: sectionIds.length,
        rate: sectionIds.length ? 1 - missingDisp.length / sectionIds.length : 1,
        missing: missingDisp
      },
      silentCandidateLoss: silentLoss,
      rejectedWithoutReason,
      goldTemporalConsistency: base.order,
      canonicalDisplayPreservation: {
        covered: canonIds.size - missingInDisplay.length,
        total: canonIds.size,
        rate: canonIds.size ? 1 - missingInDisplay.length / canonIds.size : 1,
        missing: missingInDisplay
      },
      sourcelessEvents: sourceless,
      targets: {
        majorGoldRecall: ">=13/14",
        hallucination: 0,
        sourceRefCoverage: 1,
        sourceDispositionCoverage: 1,
        silentCandidateLoss: 0,
        goldTemporalConsistency: ">=0.9",
        canonicalDisplayPreservation: 1,
        sourcelessEvents: 0
      }
    }
  };
}
